from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import json
import os
import sys
from uuid import uuid4
from datetime import datetime
import asyncio
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.agents import Tool, AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferMemory
from langchain.chains import LLMChain
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

# constant variables
DATA_FILE = 'saved_analyses.json'

# initialize LLM models with different temperature settings
llm_gpt4 = ChatOpenAI(model="gpt-4o", api_key=os.getenv("OPENAI_API_KEY"))
llm_gpt4_creative = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=os.getenv("OPENAI_API_KEY"))
llm_gpt35 = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.2, api_key=os.getenv("OPENAI_API_KEY"))


class ChatMessage(BaseModel):
    role: str  # this value can be "user" or "assistant" for example
    content: str

class ChatRequest(BaseModel):
    workout_id: str
    message: str

class WorkoutUpdateRequest(BaseModel):
    workout_id: str
    content: str  # updated workout content to be saved / displayed

# define LangChain prompts and chains -- WE NEED TO REWRITE THESE
workout_modifier_prompt = ChatPromptTemplate.from_template("""
You are a fitness expert that helps modify workout routines.
When modifying workouts:
1. Maintain the same format as the original workout
2. Keep numbered lists for workout steps
3. Keep bullet points for benefits
4. Respect the user's specific modification requests
5. Return ONLY modified workout content, do NOT provide explanations or additional text

ORIGINAL WORKOUT:
{current_workout}

USER REQUEST:
{user_request}

MODIFIED WORKOUT:
""")

workout_explanation_prompt = ChatPromptTemplate.from_template("""
You are a fitness expert that explains workout modifications.
Provide a helpful explanation of why the changes were made and how they benefit the user.

ORIGINAL WORKOUT:
{original_workout}

MODIFIED WORKOUT:
{modified_workout}

USER REQUEST:
{user_request}

Explain what changes were made and why these changes are beneficial:
""")

# again, LangChain chains for workout modifications
# workout_modifier_chain = LLMChain(
#     llm=llm_gpt35,
#     prompt=workout_modifier_prompt,
#     output_parser=StrOutputParser()
# )

# workout_explanation_chain = LLMChain(
#     llm=llm_gpt4,
#     prompt=workout_explanation_prompt,
#     output_parser=StrOutputParser()
# )
workout_modifier_chain = workout_modifier_prompt | llm_gpt35 | StrOutputParser()
workout_explanation_chain = workout_explanation_prompt | llm_gpt4 | StrOutputParser()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.workspace_memory: Dict[str, ConversationBufferMemory] = {}
        self.agent_executors: Dict[str, AgentExecutor] = {}

    async def connect(self, websocket: WebSocket, client_id: str, workout_id: str):
        await websocket.accept()

        if client_id not in self.active_connections:
            self.active_connections[client_id] = {}

        self.active_connections[client_id][workout_id] = websocket

        # initialize memory for this workspace if it doesn't exist -- SHORT TERM
        if workout_id not in self.workspace_memory:
            self.workspace_memory[workout_id] = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True
            )

    def disconnect(self, client_id: str, workout_id: str):
        if client_id in self.active_connections:
            if workout_id in self.active_connections[client_id]:
                del self.active_connections[client_id][workout_id]

            if not self.active_connections[client_id]:
                del self.active_connections[client_id]

    async def send_message(self, client_id: str, workout_id: str, message: Dict):
        if client_id in self.active_connections and workout_id in self.active_connections[client_id]:
            await self.active_connections[client_id][workout_id].send_json(message)

    def get_memory(self, workout_id: str) -> ConversationBufferMemory:
        """Get conversation memory for a specific workout context"""
        if workout_id not in self.workspace_memory:
            self.workspace_memory[workout_id] = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True
            )
        return self.workspace_memory[workout_id]

    def get_agent_executor(self, workout_id: str) -> AgentExecutor:
        """Get or create an agent executor for a specific workout context"""
        if workout_id not in self.agent_executors:
            # create tools for this specific workout context
            tools = [
                Tool(
                    name="GetCurrentWorkout",
                    func=lambda: get_analysis_by_id(workout_id).get('summary', 'No workout content available'),
                    description="Retrieves the current workout content"
                ),
                Tool(
                    name="ModifyWorkout",
                    func=lambda request: modify_workout_tool(workout_id, request),
                    description="Modifies the workout based on the user's request",
                    coroutine=modify_workout_tool
                ),
                Tool(
                    name="ExplainModifications",
                    func=lambda orig, mod, req: explain_modifications_tool(orig, mod, req),
                    description="Explains the modifications made to the workout",
                    coroutine=explain_modifications_tool
                )
            ]

            # create a ReAct agent with the tools -- NOT production ready, fine for now though
            agent_prompt = ChatPromptTemplate.from_messages([
                ("system", """You are a helpful fitness assistant that can modify workouts based on user requests.
                You have access to tools that can retrieve the current workout, modify it, and explain the modifications.
                Follow these steps:
                1. First use GetCurrentWorkout to see what the workout currently looks like
                2. Use ModifyWorkout with the user's request to modify the workout
                3. Use ExplainModifications to generate an explanation of the changes

                Always be helpful, positive and encouraging. Focus on making the workout better for the user."""),
                ("human", "{input}"),
                ("ai", "{agent_scratchpad}")
            ])

            agent = create_react_agent(llm_gpt4, tools, agent_prompt)

            # create the agent executor with memory
            self.agent_executors[workout_id] = AgentExecutor(
                agent=agent,
                tools=tools,
                memory=self.get_memory(workout_id),
                verbose=True,
                handle_parsing_errors=True
            )

        return self.agent_executors[workout_id]

# define LangChain tools for the workout agent
async def get_workout_tool(workout_id: str) -> str:
    """Tool to retrieve the current workout content."""
    workout = get_analysis_by_id(workout_id)
    if not workout:
        return "Workout not found"
    return workout.get('summary', 'No workout content available')

async def modify_workout_tool(workout_id: str, modification_request: str) -> str:
    """Tool to modify a workout based on the user's request."""
    workout = get_analysis_by_id(workout_id)
    if not workout:
        return "Error: Workout not found"

    current_content = workout.get('summary', '')

    try:
        # use chain from earlier to modify
        modified_content = await workout_modifier_chain.ainvoke({
            "current_workout": current_content,
            "user_request": modification_request
        })

        # update the workout in storage
        success = update_analysis(workout_id, {
            'summary': modified_content,
            'date_modified': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })

        if success:
            return modified_content
        else:
            return "Error: Failed to save modified workout"

    except Exception as e:
        print(f"Error modifying workout: {e}")
        return f"Error: {str(e)}"

async def explain_modifications_tool(original_content: str, modified_content: str, user_request: str) -> str:
    """Tool to explain the modifications made to a workout."""
    try:
        explanation = await workout_explanation_chain.ainvoke({
            "original_workout": original_content,
            "modified_workout": modified_content,
            "user_request": user_request
        })
        return explanation
    except Exception as e:
        print(f"Error generating explanation: {e}")
        return "I've modified the workout according to your request."

# more helper functions for working with workout data
def load_analyses():
    """Load all saved analyses/workouts from the data file."""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading analyses: {e}")
        return []

def get_analysis_by_id(analysis_id):
    """Get a specific analysis/workout by ID."""
    analyses = load_analyses()
    for analysis in analyses:
        if analysis.get('id') == analysis_id:
            return analysis
    return None

def save_analysis(analysis_data):
    """Save a new analysis/workout to the data file."""
    analyses = load_analyses()

    if not analysis_data.get('id'):
        analysis_data['id'] = str(uuid4())

    # add timestamp if not provided
    if not analysis_data.get('date_saved'):
        analysis_data['date_saved'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    analyses.append(analysis_data)

    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(analyses, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving analysis: {e}")
        return False


def update_analysis(analysis_id, updated_data):
    """Update an existing analysis/workout."""
    analyses = load_analyses()

    updated = False
    for i, analysis in enumerate(analyses):
        if analysis.get('id') == analysis_id:
            # preserves the ID and date_saved
            if 'id' not in updated_data:
                updated_data['id'] = analysis_id
            if 'date_saved' not in updated_data and 'date_saved' in analysis:
                updated_data['date_saved'] = analysis['date_saved']
            updated_data['date_modified'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # update the analysis while preserving fields not in updated_data
            for key, value in updated_data.items():
                analysis[key] = value

            analyses[i] = analysis
            updated = True
            break

    if updated:
        # ensure updated content is pushed to data store
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump(analyses, f, indent=2)
            return True
        except Exception as e:
            print(f"Error updating analysis: {e}")

    return False

async def modify_workout(workout_id: str, user_request: str):
    """Modify a workout based on user request using LangChain."""
    workout = get_analysis_by_id(workout_id)
    if not workout:
        return {
            "success": False,
            "message": "Workout not found"
        }
    current_content = workout.get('summary', '')

    try:
        modified_content = await workout_modifier_chain.ainvoke({
            "current_workout": current_content,
            "user_request": user_request
        })

        explanation = await workout_explanation_chain.ainvoke({
            "original_workout": current_content,
            "modified_workout": modified_content,
            "user_request": user_request
        })

        update_success = update_analysis(workout_id, {
            'summary': modified_content,
            'date_modified': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })

        return {
            "success": update_success,
            "modified_content": modified_content,
            "explanation": explanation,
            "workout": get_analysis_by_id(workout_id)  # get the updated workout again
        }

    except Exception as e:
        print(f"Error modifying workout: {e}")
        return {
            "success": False,
            "message": f"Error modifying workout: {str(e)}"
        }


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # NOT PRODUCTION READY
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()

# websocket endpoint for chat ('coach', see LangCoach.py)
@app.websocket("/ws/{client_id}/{workout_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, workout_id: str):
    await manager.connect(websocket, client_id, workout_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message.get("type") == "chat_message":
                    user_message = message.get("content", "")


                    await manager.send_message(
                        client_id,
                        workout_id,
                        {
                            "type": "status",
                            "status": "processing"
                        }
                    )

                    # Two implementation options:
                    # 1. Use the agent-based approach
                    if message.get("use_agent", False):
                        # get or create an agent executor for this workout
                        agent_executor = manager.get_agent_executor(workout_id)

                        # run the agent with the user's message
                        agent_result = await agent_executor.ainvoke({"input": user_message})
                        result = {
                            "success": True,
                            "content": agent_result.get("output", "No response from agent"),
                            "workout": get_analysis_by_id(workout_id)
                        }

                    # 2. use the direct workflow approach
                    else:
                        # process the modification request using our standard workflow
                        result = await modify_workout(workout_id, user_message)

                    # send the processing result
                    await manager.send_message(
                        client_id,
                        workout_id,
                        {
                            "type": "chat_response",
                            "success": result.get("success", False),
                            "content": result.get("explanation", result.get("content", "Unable to process request")),
                            "workout": result.get("workout")
                        }
                    )

                    # update the agent's memory with this interaction
                    memory = manager.get_memory(workout_id)
                    memory.chat_memory.add_user_message(user_message)
                    memory.chat_memory.add_ai_message(result.get("explanation", result.get("content", "")))

            except json.JSONDecodeError:
                await manager.send_message(
                    client_id,
                    workout_id,
                    {
                        "type": "error",
                        "message": "Invalid message format"
                    }
                )
    except WebSocketDisconnect:
        manager.disconnect(client_id, workout_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(client_id, workout_id)


@app.post("/api/workouts/{workout_id}/modify")
async def modify_workout_endpoint(workout_id: str, request: ChatRequest):
    """Modify a workout via direct API call"""
    result = await modify_workout(workout_id, request.message)
    return result

@app.post("/api/workouts/{workout_id}/agent")
async def workout_agent_endpoint(workout_id: str, request: ChatRequest):
    """Perform workout modifications using the agent-based approach"""
    try:
        # get or create the agent executor for this workout
        agent_executor = manager.get_agent_executor(workout_id)

        # run the agent with the user's message
        result = await agent_executor.ainvoke({"input": request.message})

        # return a formatted response -- AGAIN, THIS NEEDS TO BE MORE EXPLICITLY DEFINED BY US
        return {
            "success": True,
            "content": result.get("output", "No response generated"),
            "workout": get_analysis_by_id(workout_id)
        }
    except Exception as e:
        print(f"Agent error: {e}")
        return {
            "success": False,
            "message": f"Error processing request: {str(e)}"
        }

@app.get("/api/workouts/{workout_id}/history")
async def get_conversation_history(workout_id: str):
    """Get the conversation history for a specific workout"""
    try:
        memory = manager.get_memory(workout_id)
        messages = memory.chat_memory.messages

        # format the messages for API response
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "role": "user" if isinstance(msg, HumanMessage) else "assistant",
                "content": msg.content
            })

        return {
            "workout_id": workout_id,
            "conversation_history": formatted_messages
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation history: {str(e)}")

@app.post("/api/workouts/generate")
async def generate_workout(request: Dict[str, Any] = Body(...)):
    """Generate a new workout based on user requirements"""
    try:
        # create a workout generation prompt
        workout_generator_prompt = ChatPromptTemplate.from_template("""
        You are a fitness expert creating a personalized workout plan.

        USER REQUIREMENTS:
        {requirements}

        Create a detailed workout plan that includes:
        1. A title for the workout
        2. A numbered list of exercises with sets and reps
        3. Bullet points for benefits and tips
        4. Rest periods between exercises

        Ensure the workout is appropriate for the user's fitness level, goals, and any limitations mentioned.
        """)


        workout_generator_chain = workout_generator_prompt | llm_gpt4_creative | StrOutputParser()


        requirements = request.get("requirements", "")
        generated_workout = await workout_generator_chain.ainvoke({"requirements": requirements})

        title_prompt = ChatPromptTemplate.from_template(
            "Create a catchy, short title (max 5 words) for this workout: {workout}"
        )
        title_chain = title_prompt | llm_gpt35 | StrOutputParser()

        title = await title_chain.ainvoke({"workout": generated_workout[:500]})


        workout_data = {
            "title": title,
            "summary": generated_workout,
            "transcript": f"Generated workout based on requirements: {requirements}",
            "tags": ["generated", "custom"],
            "date_saved": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        save_analysis(workout_data)

        return {
            "success": True,
            "workout": workout_data
        }

    except Exception as e:
        print(f"Error generating workout: {e}")
        return {
            "success": False,
            "message": f"Error generating workout: {str(e)}"
        }

@app.post("/api/workouts/analyze")
async def analyze_workout(request: Dict[str, Any] = Body(...)):
    """Analyze a workout and provide feedback and suggestions"""
    try:
        workout_content = request.get("workout", "")
        user_profile = request.get("user_profile", {})

        # analysis chain with LangChain
        workout_analysis_prompt = ChatPromptTemplate.from_template("""
        You are a fitness expert analyzing a workout routine.

        WORKOUT:
        {workout}

        USER PROFILE:
        {user_profile}

        Analyze this workout and provide:
        1. Overall assessment of the workout's effectiveness
        2. Strengths of the workout plan
        3. Areas for improvement
        4. Recommendations for modifications based on user profile
        5. Safety considerations

        Format your response in markdown with clear section headings.
        """)

        workout_analysis_chain = workout_analysis_prompt | llm_gpt4 | StrOutputParser()


        analysis = await workout_analysis_chain.ainvoke({
            "workout": workout_content,
            "user_profile": json.dumps(user_profile)
        })

        return {
            "success": True,
            "analysis": analysis
        }
    except Exception as e:
        print(f"Error analyzing workout: {e}")
        return {
            "success": False,
            "message": f"Error analyzing workout: {str(e)}"
        }

# health check endpoint
@app.get("/")
async def root():
    return {"status": "healthy", "message": "Workout agent service is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)  # needs to run on a different port than the main app