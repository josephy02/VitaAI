import os
import json
import uuid
from datetime import datetime
import tempfile
import shutil
import subprocess
from urllib.parse import urlparse
from typing import Optional, Dict, Any, List
import uvicorn
import sys
from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from moviepy import VideoFileClip
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from langchain_core.output_parsers import StrOutputParser
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_community.document_loaders.parsers.audio import OpenAIWhisperParser # USE THISSSSSS
# from langchain_community.document_loaders import AssemblyAIAudioTranscriptLoader
from openai import OpenAI
from db import collection  # make sure this import is at the top



load_dotenv()
# here we initialize LLM models, decided to manually pass in OpenAI key
llm_gpt4 = ChatOpenAI(model="gpt-4", api_key=os.getenv("OPENAI_API_KEY"))
llm_gpt35 = ChatOpenAI(model="gpt-3.5-turbo", api_key=os.getenv("OPENAI_API_KEY"))
llm_whisper = ChatOpenAI(model="whisper-1", api_key=os.getenv("OPENAI_API_KEY"))

# set up data models (think of these as agents for now)
class VideoUrlRequest(BaseModel):
    video_url: str
    summary_prompt: str

class VideoAnalysisResponse(BaseModel):
    title: Optional[str] = None
    platform: Optional[str] = None
    uploader: Optional[str] = None
    duration_seconds: Optional[float] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SavedAnalysisModel(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    video_url: Optional[str] = None
    summary_prompt: str
    transcript: str
    summary: str
    platform: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    date_saved: Optional[str] = None
    date_modified: Optional[str] = None
    tags: List[str] = []

# constatnt (global) variables, we'll need to send this to MongoDB soon
DATA_FILE = 'saved_analyses.json'
TEMP_DIR = 'temp_files'

# temp directory that should be cleared with logic later on
os.makedirs(TEMP_DIR, exist_ok=True)

# initialize FastAPI
app = FastAPI(
    title="Video Analysis API",
    description="Backend API for video downloading, transcription, and summarization",
    version="1.0.0"
)

os.makedirs("public/thumbnails", exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory="public/thumbnails"), name="thumbnails")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # in production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# this is important to remember, LangChain Chains, think of these as a sequences of calls - whether to an LLM, a tool, or a data preprocessing step.
# modern LangChain syntax (recommended)
title_prompt = ChatPromptTemplate.from_template(
    "You are a title generator for videos. Create a concise, descriptive title "
    "(maximum 8 words) based on the content provided. Return ONLY the title with "
    "no additional text, quotes, or explanation.\n\nContent: {content}"
)
title_generator_chain = title_prompt | llm_gpt35 | StrOutputParser()


summarize_chain = ChatPromptTemplate.from_template(
    "You are an expert video summarizer. You receive a video transcript to summarize and turn into a list.\n\n"
    "Transcript content: {transcript}\n\n"
    "Summarize according to this request: {user_prompt}"
) | llm_gpt4 | StrOutputParser()

tag_extraction_chain = ChatPromptTemplate.from_template(
    "Extract relevant tags from the following fitness content. "
    "Return only a comma-separated list of tags. Focus on workout types, muscle groups, "
    "and fitness concepts mentioned.\n\nContent: {content}"
) | llm_gpt35 | StrOutputParser()

# these are the the 'helper' functions ... eg. Social Media Downloader Functions that as tools
def download_social_media_video(url, output_path):
    """
    Download a video from any supported social media platform.

    Args:
        url (str): URL to the social media post containing video
        output_path (str): Path where the video will be saved

    Returns:
        dict: Metadata about the downloaded video, or None if download failed
    """
    temp_json_path = None

    try:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or '.', exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as temp_json:
            temp_json_path = temp_json.name

        # this url parser is to determine which social media you're looking at
        domain = urlparse(url).netloc
        platform = domain.split('.')[-2] if len(domain.split('.')) > 1 else domain

        # for instagram, we'll try to normalize the URL
        if 'instagram' in domain:
            # extract the shortcode if it's a user-specific reel URL
            if '/reel/' in url:
                parts = url.split('/reel/')
                if len(parts) > 1:
                    shortcode = parts[1].split('/')[0]
                    normalized_url = f"https://www.instagram.com/reel/{shortcode}/"
                    url = normalized_url

        # yt-dlp
        cmd = [
            "yt-dlp",
            "--verbose",
            "--no-warnings",
            "-f", "best",
            "--write-info-json", temp_json_path,
            "-o", output_path,
            url
        ]


        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            timeout=180
        )


        if process.returncode != 0:
            # try direct system call as a fallback
            direct_cmd = f"yt-dlp --verbose -f best -o {output_path} {url}"
            exit_code = os.system(direct_cmd)

            if exit_code != 0:
                return None


        if not os.path.exists(output_path):
            # try to find the file with a similar name (yt-dlp might have added an extension)
            base_dir = os.path.dirname(os.path.abspath(output_path)) or '.'
            base_name = os.path.basename(output_path)

            possible_files = [f for f in os.listdir(base_dir)
                            if f.startswith(base_name) or base_name in f]

            if possible_files:
                actual_file = os.path.join(base_dir, possible_files[0])
                shutil.move(actual_file, output_path)


        if not os.path.exists(output_path):
            return None

        # try block for reading metadata
        try:
            if os.path.exists(temp_json_path) and os.path.getsize(temp_json_path) > 0:
                with open(temp_json_path, 'r') as f:
                    metadata = json.load(f)
                info = {
                    "title": metadata.get("title"),
                    "uploader": metadata.get("uploader"),
                    "platform": platform,
                    "duration_seconds": metadata.get("duration"),
                    "upload_date": metadata.get("upload_date"),
                    "view_count": metadata.get("view_count"),
                    "like_count": metadata.get("like_count"),
                    "comment_count": metadata.get("comment_count"),
                    "description": metadata.get("description"),
                    "thumbnail": metadata.get("thumbnail")
                }
                return info
            else:
                # return basic information
                if os.path.exists(output_path):
                    return {
                        "platform": platform,
                        "note": "Metadata unavailable but file was downloaded"
                    }
                return None

        except (json.JSONDecodeError, FileNotFoundError):
            # for now, if we can't read metadata but the video downloaded, still return success -- THIS NEEDS TO CHANGE
            if os.path.exists(output_path):
                return {
                    "platform": platform,
                    "note": "Metadata unavailable but file was downloaded"
                }
            return None

    except subprocess.TimeoutExpired:
        return None
    except Exception:
        return None
    finally:
        # clean up the temporary JSON file
        if temp_json_path and os.path.exists(temp_json_path):
            try:
                os.unlink(temp_json_path)
            except:
                pass


def extract_thumbnail(video_path, output_dir='public/thumbnails'):
    """
    Extract a thumbnail from a video file

    Args:
        video_path (str): Path to the video file
        output_dir (str): Directory to save the thumbnail

    Returns:
        str: URL path to the thumbnail that can be accessed from frontend
    """
    # Create thumbnails directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    # Generate a unique filename for the thumbnail
    thumbnail_id = str(uuid.uuid4())
    thumbnail_path = os.path.join(output_dir, f"{thumbnail_id}.jpg")

    try:
        # Use ffmpeg to extract a thumbnail at 1 second
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-ss", "00:00:01.000",  # Position at 1 second
            "-vframes", "1",        # Extract 1 frame
            "-q:v", "2",            # High quality
            thumbnail_path
        ]

        # Run the command
        process = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False
        )

        # Check if the command was successful
        if process.returncode == 0 and os.path.exists(thumbnail_path):
            # The URL path that frontend will use (adjust based on your static file serving setup)
            # url_path = f"/thumbnails/{thumbnail_id}.jpg"
            url_path = f"http://localhost:8000/thumbnails/{thumbnail_id}.jpg"
            return url_path
        else:
            # Log the error for debugging
            print(f"ffmpeg stderr: {process.stderr}")
    except Exception as e:
        print(f"Error extracting thumbnail: {e}")

    return None


async def generate_title_from_content(transcript=None, summary=None):
    """
    Generate a descriptive title based on the transcript or summary.
    """
    content = summary if summary else transcript

    # if neither is available, return a generic title
    if not content:
        return "Untitled Video"

    try:
        # create a direct OpenAI client call instead of using LangChain
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # ensure content is a string and truncate it
        if isinstance(content, str):
            truncated_content = content[:1000]
        else:
            truncated_content = str(content)[:1000]
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a title generator for videos. Create a concise, descriptive title (maximum 8 words) based on the content provided. Return ONLY the title with no additional text, quotes, or explanation."},
                {"role": "user", "content": f"Content: {truncated_content}"}
            ],
            temperature=0.7,
            max_tokens=20
        )
        title = response.choices[0].message.content.strip()
        title = title.replace('"', '').replace("'", "")
        return title
    except Exception as e:
        print(f"Error generating title: {str(e)}")
        return "Untitled Video"


async def get_analysis_by_id(analysis_id):
    """Get a specific analysis/workout by ID and ensure it has a title."""
    analyses = load_saved_analyses()
    for analysis in analyses:
        if analysis.get('id') == analysis_id:
            # if no title...
            if not analysis.get('title'):
                analysis['title'] = await generate_title_from_content(
                    transcript=analysis.get('transcript'),
                    summary=analysis.get('summary')
                )
                # save the generated title back to the data store
                update_analysis(analysis_id, {'title': analysis['title']})
            return analysis
    return None

def get_supported_sites():
    """Get a list of sites supported by yt-dlp"""
    try:
        process = subprocess.run(
            ["yt-dlp", "--list-extractors"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )

        sites = process.stdout.strip().split('\n')
        return sites
    except subprocess.SubprocessError:
        return []

# these are the video processing helper functions
def extract_audio(video_path: str, audio_path: str) -> None:
    """Extract audio track from the video file and save to 'audio_path'."""
    with VideoFileClip(video_path) as video:
        audio = video.audio
        audio.write_audiofile(audio_path)

# LangChain's AudioLoader no longer exists, we'll use Whisper for now.. but consider AssemblyAI
async def transcribe_audio(audio_path: str) -> str:
    """
    Use OpenAI Whisper API to transcribe the audio file, returning the text.
    This is a direct implementation without relying on AudioLoader.
    """
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # open the audio file
        with open(audio_path, "rb") as audio_file:
            # use the OpenAI Whisper API for transcription
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        # return the transcribed text
        return transcript.text
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return ""

async def summarize_transcript(transcript: str, user_prompt: str) -> str:
    """Summarize the transcript using LangChain."""
    # split transcript into manageable chunks IF it's very long
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=4000,
        chunk_overlap=200
    )

    if len(transcript) > 5000:
        # for these longer transcripts, split and process in chunks
        chunks = text_splitter.split_text(transcript)
        docs = [Document(page_content=chunk) for chunk in chunks]

        summaries = []
        for doc in docs:
            chunk_summary = await summarize_chain.ainvoke({
                "transcript": doc.page_content,
                "user_prompt": user_prompt
            })
            summaries.append(chunk_summary)

        # create a combined summary
        combined_summary = "\n\n".join(summaries)
        # llm call to make cohesive summary
        final_summary = await summarize_chain.ainvoke({
            "transcript": combined_summary,
            "user_prompt": f"Create a concise, unified summary from these segment summaries. {user_prompt}"
        })
        return final_summary
    else:
        # for shorter transcripts, process directly
        return await summarize_chain.ainvoke({"transcript": transcript, "user_prompt": user_prompt})

def load_saved_analyses():
    """Load all saved analyses from the data file."""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception:
        return []

def save_analysis(analysis_data):
    """Save a new analysis to the data file."""
    analyses = load_saved_analyses()

    # unique ID if not provided
    if not analysis_data.get('id'):
        analysis_data['id'] = str(uuid.uuid4())

    # add timestamp if not provided
    if not analysis_data.get('date_saved'):
        analysis_data['date_saved'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    analyses.append(analysis_data)

    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(analyses, f)
        return True
    except Exception:
        return False

def delete_analysis(analysis_id):
    """Delete an analysis by ID."""
    analyses = load_saved_analyses()
    analyses = [a for a in analyses if a.get('id') != analysis_id]

    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(analyses, f)
        return True
    except Exception:
        return False

def update_analysis(analysis_id, updated_data):
    """Update an existing analysis."""
    analyses = load_saved_analyses()

    for i, analysis in enumerate(analyses):
        if analysis.get('id') == analysis_id:
            # preserve the ID and date_saved
            updated_data['id'] = analysis_id
            if 'date_saved' in analysis:
                updated_data['date_saved'] = analysis['date_saved']
            updated_data['date_modified'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            analyses[i] = updated_data
            break

    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(analyses, f)
        return True
    except Exception:
        return False

async def extract_tags(content):
    """Extract relevant tags from content using LangChain."""
    if not content or (not isinstance(content, str) and not hasattr(content, '__str__')):
        return ["video"]

    try:
        content_str = str(content) if not isinstance(content, str) else content
        tags_text = await tag_extraction_chain.ainvoke({"content": content_str[:2000]})
        tags = [tag.strip() for tag in tags_text.split(',') if tag.strip()]

        # return default --- WE NEED TO CHANGE TAG LOGIC
        if not tags:
            return ["video"]

        return tags
    except Exception as e:
        print(f"Error extracting tags: {e}")
        return ["video"]

async def process_video(video_path, user_prompt):
    """Process a video file to extract audio, transcribe, and summarize."""
    temp_audio_path = os.path.join(TEMP_DIR, f"temp_audio_{uuid.uuid4()}.wav")

    try:
        extract_audio(video_path, temp_audio_path)
        transcript = await transcribe_audio(temp_audio_path)
        summary = await summarize_transcript(transcript, user_prompt)
        return {
            "transcript": transcript,
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing video: {str(e)}")
    finally:
        try:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)
        except Exception:
            pass

# here are the API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Video Analysis API is running"}

@app.get("/api/supported-sites")
async def supported_sites():
    """Get a list of sites supported for video downloading"""
    sites = get_supported_sites()
    return {"supported_sites": sites}

@app.post("/api/analyze-url")
async def analyze_url(request: VideoUrlRequest):
    """Analyze a video from a URL"""
    try:
        temp_video_path = os.path.join(TEMP_DIR, f"temp_video_{uuid.uuid4()}.mp4")
        metadata = download_social_media_video(request.video_url, temp_video_path)
        if not metadata or not os.path.exists(temp_video_path):
            raise HTTPException(status_code=400, detail="Failed to download the video")

         # Extract thumbnail before processing video
        thumbnail_url = extract_thumbnail(temp_video_path)
        if thumbnail_url:
            # Add thumbnail URL to metadata
            if metadata is None:
                metadata = {}
            metadata["thumbnail"] = thumbnail_url
        results = await process_video(temp_video_path, request.summary_prompt)

        # generate a title if one isn't there
        title = metadata.get("title")
        if not title:
            title = await generate_title_from_content(
                transcript=results["transcript"],
                summary=results["summary"]
            )


        response_data = {
            "title": title,
            "platform": metadata.get("platform"),
            "uploader": metadata.get("uploader"),
            "duration_seconds": metadata.get("duration_seconds"),
            "transcript": results["transcript"],
            "summary": results["summary"],
            "metadata": metadata,
            "video_url": request.video_url
        }

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing video URL: {str(e)}")

    finally:
        try:
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)
        except Exception:
            pass

@app.post("/api/analyze-upload")
async def analyze_upload(
    file: UploadFile = File(...),
    summary_prompt: str = Form(...)
):
    """Analyze an uploaded video file"""
    temp_video_path = os.path.join(TEMP_DIR, f"temp_upload_{uuid.uuid4()}.mp4")

    try:
        with open(temp_video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract thumbnail
        thumbnail_url = extract_thumbnail(temp_video_path)

        results = await process_video(temp_video_path, summary_prompt)
        with VideoFileClip(temp_video_path) as video:
            duration = video.duration

        title = await generate_title_from_content(
            transcript=results["transcript"],
            summary=results["summary"]
        )
        tags = await extract_tags(results["transcript"] + " " + results["summary"])

        # Create metadata with thumbnail
        metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": os.path.getsize(temp_video_path)
        }

        if thumbnail_url:
            metadata["thumbnail"] = thumbnail_url

        return {
            "title": title if title else file.filename,  # use generated title, fallback to filename
            "duration_seconds": duration,
            "transcript": results["transcript"],
            "summary": results["summary"],
            "tags": tags,
            "metadata": metadata
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing uploaded video: {str(e)}")

    finally:
        try:
            if os.path.exists(temp_video_path):
                os.remove(temp_video_path)
        except Exception:
            pass

@app.get("/api/analyses")
async def get_analyses():
    """Get all saved analyses"""
    analyses = load_saved_analyses()
    return analyses

@app.post("/api/analyses")
async def create_analysis(analysis: Dict[str, Any] = Body(...)):
    """Save a new analysis"""
    try:
        if 'title' not in analysis or not analysis['title']:
            analysis['title'] = await generate_title_from_content(
                transcript=analysis.get('transcript'),
                summary=analysis.get('summary')
            )

        if ('transcript' in analysis or 'summary' in analysis) and ('tags' not in analysis or not analysis['tags']):
            content = analysis.get('transcript', '') + ' ' + analysis.get('summary', '')
            analysis['tags'] = await extract_tags(content)

        success = save_analysis(analysis)
        if success:
            return {"success": True, "id": analysis.get('id'), "message": "Analysis saved successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save analysis")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving analysis: {str(e)}")

@app.get("/api/analyses/{analysis_id}")
async def get_analysis_endpoint(analysis_id: str):
    """Get a specific analysis by ID"""
    analysis = await get_analysis_by_id(analysis_id)
    if analysis:
        return analysis
    else:
        raise HTTPException(status_code=404, detail="Analysis not found")

@app.put("/api/analyses/{analysis_id}")
async def update_analysis_endpoint(analysis_id: str, analysis: Dict[str, Any] = Body(...)):
    """Update an existing analysis"""
    try:
        # get existing analysis to check
        existing_analysis = await get_analysis_by_id(analysis_id)
        if ('title' not in analysis or not analysis['title']) and existing_analysis:
            # check if summary changed (regenerate title if it did)
            summary_changed = ('summary' in analysis and existing_analysis.get('summary') != analysis['summary'])
            if summary_changed or not existing_analysis.get('title'):
                analysis['title'] = await generate_title_from_content(
                    transcript=analysis.get('transcript', existing_analysis.get('transcript')),
                    summary=analysis.get('summary', existing_analysis.get('summary'))
                )
            else:
                analysis['title'] = existing_analysis.get('title')

        if ('transcript' in analysis or 'summary' in analysis) and ('tags' not in analysis or not analysis['tags']):
            content = analysis.get('transcript', '') + ' ' + analysis.get('summary', '')
            analysis['tags'] = await extract_tags(content)

        success = update_analysis(analysis_id, analysis)
        if success:
            return {"success": True, "message": "Analysis updated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update analysis")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating analysis: {str(e)}")

@app.delete("/api/analyses/{analysis_id}")
async def delete_analysis_endpoint(analysis_id: str):
    """Delete an analysis by ID"""
    success = delete_analysis(analysis_id)
    if success:
        return {"success": True, "message": "Analysis deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete analysis")

if __name__ == "__main__":
    # allow running directly from the backend directory
    # by adding the parent directory to the system path
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, parent_dir)

    # run the FastAPI app with the correct module path
    # when running from the backend directory, we need to use the relative path
    print(f"Starting server from {os.path.abspath(__file__)}")
    uvicorn.run("LangApp:app", host="127.0.0.1", port=8000, reload=True)


@app.get("/api/test-mongo")
async def test_mongo_connection():
    try:
        # Run a simple command to check the connection
        await collection.database.command("ping")
        return {"success": True, "message": "MongoDB connection successful"}
    except Exception as e:
        return {"success": False, "error": str(e)}