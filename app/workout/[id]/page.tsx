"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"
import { videoService, workoutService, type ChatMessage } from "@/services/api"
import { WorkoutChatService, type WebSocketMessage } from "@/services/websocket"
import { v4 as uuidv4 } from "uuid"

export default function WorkoutDetail() {
  const { id } = useParams() as { id: string }
  const [workout, setWorkout] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatService, setChatService] = useState<WorkoutChatService | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const clientId = uuidv4() // Generate a unique client ID

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
    if (!workout) return

    const setupChat = async () => {
      setIsConnecting(true)
      try {
        const service = new WorkoutChatService(clientId, id)

        // Set up message handler
        service.onMessage((message: WebSocketMessage) => {
          if (message.type === "chat_response" && message.content) {
            setMessages((prev) => [...prev, { role: "assistant", content: message.content }])

            // Update workout if it was modified
            if (message.workout) {
              setWorkout(message.workout)
            }
          }
        })

        // Connect to WebSocket
        await service.connect()
        setChatService(service)
        setIsConnected(true)
      } catch (err) {
        console.error("Failed to connect to chat:", err)
        setError("Failed to connect to chat service")
      } finally {
        setIsConnecting(false)
      }
    }

    setupChat()

    // Clean up WebSocket on unmount
    return () => {
      if (chatService) {
        chatService.disconnect()
      }
    }
  }, [workout, id, clientId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !chatService || !isConnected) return

    // Add user message to the list
    setMessages((prev) => [...prev, { role: "user", content: newMessage }])
    setIsSending(true)

    try {
      // Send message via WebSocket
      chatService.sendMessage(newMessage)
      setNewMessage("")
    } catch (err) {
      console.error("Failed to send message:", err)
      setError("Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  // Helper function to format workout summary
  const formatWorkoutSummary = () => {
    if (!workout) return ""

    // Handle different summary formats
    if (typeof workout.summary === "object" && workout.summary.text) {
      return workout.summary.text
    } else if (typeof workout.summary === "string") {
      return workout.summary
    } else if (typeof workout.summary === "object" && workout.summary.current_workout) {
      return workout.summary.current_workout
    }

    return JSON.stringify(workout.summary)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="h-8 w-8 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !workout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-red-500 mb-4">{error || "Workout not found"}</p>
        <Link href="/" className="text-white bg-card px-4 py-2 rounded-md">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background p-4 border-b border-gray-800">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold">{workout.title}</h1>
        </div>
      </div>

      {/* Workout Content */}
      <div className="flex-1 overflow-auto p-4">
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
        <form onSubmit={handleSendMessage} className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask to modify this workout..."
            className="flex-1 bg-gray-800 text-white rounded-l-full px-4 py-2 focus:outline-none"
            disabled={!isConnected || isSending}
          />
          <button
            type="submit"
            className="bg-card text-white rounded-r-full px-4 py-2 focus:outline-none disabled:opacity-50"
            disabled={!isConnected || isSending || !newMessage.trim()}
          >
            {isSending ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>

        {!isConnected && !error && (
          <p className="text-center text-sm text-gray-400 mt-2">
            {isConnecting ? "Connecting to chat..." : "Chat disconnected"}
          </p>
        )}
      </div>
    </div>
  )
}

