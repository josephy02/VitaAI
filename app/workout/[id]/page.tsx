"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"
import { videoService, workoutService, type ChatMessage } from "@/services/api"
import { WorkoutChatService, type WebSocketMessage } from "@/services/websocket"
import { v4 as uuidv4 } from "uuid"
import { WorkoutThumbnail } from "@/utils/thumbnail-generator"

export default function WorkoutDetail() {
  const { id } = useParams() as { id: string }
  const [workout, setWorkout] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)

  // Use refs to maintain stable references
  const chatServiceRef = useRef<WorkoutChatService | null>(null);
  const clientId = useRef(uuidv4()).current; // Generate client ID once per component lifecycle

  // Fetch workout data
  useEffect(() => {
    const fetchWorkout = async () => {
      try {
        const data = await videoService.getAnalysisById(id)
        setWorkout(data)

        // Also fetch chat history
        const history = await workoutService.getChatHistory(id)
        setMessages(history || [])
      } catch (err) {
        console.error("Failed to fetch workout:", err)
        setError("Failed to load workout")
      } finally {
        setIsLoading(false)
      }
    }

    fetchWorkout()
  }, [id])

  // Set up WebSocket connection
  useEffect(() => {
    // Only attempt connection if we have the workout data
    if (!workout) return;

    // Skip if we already have a connection
    if (chatServiceRef.current && isConnected) return;

    const setupChat = async () => {
      // Prevent multiple connection attempts
      if (isConnecting) return;

      setIsConnecting(true);
      console.log("Attempting to set up chat connection...");

      try {
        // Only create a new service if one doesn't exist
        if (!chatServiceRef.current) {
          console.log(`Creating new chat service with clientId: ${clientId} and workoutId: ${id}`);
          chatServiceRef.current = new WorkoutChatService(clientId, id);

          // Set up message handler
          chatServiceRef.current.onMessage((message: WebSocketMessage) => {
            console.log("Received message:", message);

            if (message.type === "chat_response" && message.content) {
              setMessages((prev) => [...prev, { role: "assistant", content: message.content ?? "" }]);

              // Update workout if it was modified
              if (message.workout) {
                console.log("Updating workout with:", message.workout);
                setWorkout(message.workout);
              }
            }
          });
        }

        // Connect to WebSocket
        try {
          await chatServiceRef.current.connect();
          setIsConnected(true);
          setUsingFallback(false);
        } catch (connErr) {
          console.error("WebSocket connection failed:", connErr);
          // Fall back to direct API calls instead of WebSocket
          setUsingFallback(true);
          // We'll still set isConnected so the UI remains usable
          setIsConnected(true);
        }
      } catch (err) {
        console.error("Failed to set up chat:", err);
        setError("Failed to connect to chat service");
      } finally {
        setIsConnecting(false);
      }
    };

    setupChat();

    // Clean up WebSocket on unmount
    return () => {
      if (chatServiceRef.current) {
        console.log("Disconnecting chat service");
        chatServiceRef.current.disconnect();
      }
    };
  }, [workout, id, clientId, isConnected, isConnecting]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || (!chatServiceRef.current && !usingFallback) || (!isConnected && !usingFallback)) return;

    // Add user message to the list
    setMessages((prev) => [...prev, { role: "user", content: newMessage }]);
    setIsSending(true);
    const messageContent = newMessage;
    setNewMessage(""); // Clear input field immediately for better UX

    try {
      if (usingFallback) {
        console.log("Using fallback API for message:", messageContent);
        // Use direct API call as fallback when WebSocket fails
        const result = await workoutService.modifyWorkout(id, messageContent);

        if (result && result.success) {
          // Add assistant message
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: result.explanation || "I've updated the workout based on your request."
          }]);

          // Update workout if it was modified
          if (result.workout) {
            console.log("Updating workout with API result:", result.workout);
            setWorkout(result.workout);
          }
        } else {
          throw new Error("Failed to process request via API");
        }
      } else {
        // Send message via WebSocket
        console.log("Sending message via WebSocket:", messageContent);
        chatServiceRef.current!.sendMessage(messageContent);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message. Please try again.");

      // If WebSocket fails, switch to fallback mode
      if (!usingFallback) {
        console.log("Switching to fallback mode after error");
        setUsingFallback(true);
      }
    } finally {
      setIsSending(false);
    }
  };

  // Helper function to format workout summary
  const formatWorkoutSummary = () => {
    if (!workout) return "";

    // Handle different summary formats
    if (typeof workout.summary === "object" && workout.summary.text) {
      return workout.summary.text;
    } else if (typeof workout.summary === "string") {
      return workout.summary;
    } else if (typeof workout.summary === "object" && workout.summary.current_workout) {
      return workout.summary.current_workout;
    }

    return JSON.stringify(workout.summary);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="h-8 w-8 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-red-500 mb-4">{error || "Workout not found"}</p>
        <Link href="/" className="text-white bg-card px-4 py-2 rounded-md">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header with thumbnail */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-gray-800">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="flex items-center">
            {workout.metadata?.thumbnail && (
              <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                <WorkoutThumbnail workout={workout} width={40} height={40} className="w-10 h-10 rounded-full" />
              </div>
            )}
            <h1 className="text-xl font-bold">{workout.title}</h1>
          </div>
        </div>
      </div>

      {/* Workout Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Optional: Show full thumbnail at the top of the workout detail */}
        <div className="mb-4 rounded-lg overflow-hidden">
          <WorkoutThumbnail workout={workout} className="w-full h-48" />
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Workout Summary</h2>
          <div className="whitespace-pre-line">{formatWorkoutSummary()}</div>
        </div>

        {/* Chat Messages */}
        <div className="space-y-4 mb-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-card text-white ml-auto max-w-[80%]"
                  : "bg-gray-800 text-white mr-auto max-w-[80%]"
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Input */}
      <div className="sticky bottom-0 bg-background p-4 border-t border-gray-800">
        {usingFallback && (
          <div className="text-center text-yellow-400 text-sm mb-2">
            Using direct API connection (WebSocket unavailable)
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask to modify this workout..."
            className="flex-1 bg-gray-800 text-white rounded-l-full px-4 py-2 focus:outline-none"
            disabled={(!isConnected && !usingFallback) || isSending}
          />
          <button
            type="submit"
            className="bg-card text-white rounded-r-full px-4 py-2 focus:outline-none disabled:opacity-50"
            disabled={(!isConnected && !usingFallback) || isSending || !newMessage.trim()}
          >
            {isSending ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>

        {!isConnected && !usingFallback && !error && (
          <p className="text-center text-sm text-gray-400 mt-2">
            {isConnecting ? "Connecting to chat..." : "Chat disconnected"}
          </p>
        )}
      </div>
    </div>
  );
}

