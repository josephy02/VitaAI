"use client"

import type React from "react"

import { ArrowDown, ArrowUp } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { videoService } from "@/services/api"
import { useAuth } from "@/contexts/auth-context"

export default function WelcomePage() {
  const [link, setLink] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useAuth()
  const firstName = user?.name?.split(" ")[0] || "First Name"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!link) {
      setError("Please enter a video link")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Call the backend to analyze the video
      const analysis = await videoService.analyzeVideoUrl(
        link,
        "Extract the workout routine from this video, including exercises, sets, reps, and rest periods.",
      )

      // Save the analysis
      const result = await videoService.saveAnalysis(analysis)

      // Redirect to the dashboard
      router.push("/")
    } catch (err) {
      setError("Failed to process video. Please check the URL and try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-4">
      {/* App Title */}
      <div className="flex justify-center mt-2 mb-12">
        <h1 className="text-xl font-semibold">Vita.</h1>
      </div>

      {/* Welcome Message */}
      <div className="px-8 mb-6">
        <h1 className="text-5xl font-bold mb-4">Welcome Back {firstName}</h1>
        <p className="text-2xl">Got a video you like? Be sure to send us the link</p>
      </div>

      {/* Spacer */}
      <div className="flex-grow"></div>

      {/* Upload Link Section */}
      <div className="px-8 mb-4">
        <form onSubmit={handleSubmit}>
          <div className="bg-[#4b4b4b] rounded-full p-4 flex justify-between items-center">
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Upload a link here!"
              className="bg-transparent border-none outline-none text-lg ml-4 w-full"
              disabled={isLoading}
            />
            <button type="submit" className="focus:outline-none" disabled={isLoading}>
              {isLoading ? (
                <div className="h-6 w-6 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              ) : (
                <ArrowUp className="h-6 w-6" />
              )}
            </button>
          </div>
        </form>

        {error && <div className="mt-2 text-red-500">{error}</div>}

        <div className="mt-4 flex items-center">
          <span className="text-lg">Not sure where to get the link?</span>
          <Link href="#" className="text-card ml-2 text-lg">
            See Here
          </Link>
        </div>
      </div>

      {/* Navigation Arrow */}
      <div className="flex justify-center mb-8 mt-16">
        <Link href="/">
          <ArrowDown className="w-10 h-10" />
        </Link>
      </div>
    </div>
  )
}

