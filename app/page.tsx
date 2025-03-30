"use client"

import { ArrowUp, ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { videoService, type VideoAnalysis } from "@/services/api"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<VideoAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isLoggedIn, isLoading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect to login if not logged in
    if (!authLoading && !isLoggedIn) {
      router.push("/login")
    }
  }, [isLoggedIn, authLoading, router])

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const analyses = await videoService.getAnalyses()
        setWorkouts(analyses)
      } catch (err) {
        console.error("Failed to fetch workouts:", err)
        setError("Failed to load workouts")
      } finally {
        setIsLoading(false)
      }
    }

    if (isLoggedIn) {
      fetchWorkouts()
    }
  }, [isLoggedIn])

  // Calculate stats
  const workoutsCompleted = workouts.length
  const calculateAverageTime = () => {
    if (workouts.length === 0) return "00:00"

    // Try to extract duration from metadata or use a default value
    const totalSeconds = workouts.reduce((total, workout) => {
      const durationSeconds = workout.metadata?.duration_seconds || 0
      return total + durationSeconds
    }, 0)

    const avgSeconds = Math.floor(totalSeconds / workouts.length)
    const minutes = Math.floor(avgSeconds / 60)
    const seconds = avgSeconds % 60

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="h-8 w-8 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-4">
      {/* App Title */}
      <div className="flex justify-center mt-2 mb-6">
        <h1 className="text-xl font-semibold">Vita.</h1>
      </div>

      {/* Upload Video Link */}
      <div className="flex items-center gap-2 px-8 mb-4 text-muted">
        <Link href="/welcome" className="flex items-center gap-2">
          <span>Upload Video Link</span>
          <ArrowUp className="w-5 h-5" />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 px-8 mb-8">
        <div className="flex-1 bg-card rounded-3xl p-6 flex flex-col justify-between">
          <h2 className="text-accent text-2xl font-medium">Workouts Completed</h2>
          <p className="text-accent text-7xl font-light mt-auto">{workoutsCompleted}</p>
        </div>
        <div className="flex-1 bg-card rounded-3xl p-6 flex flex-col justify-between">
          <h2 className="text-accent text-2xl font-medium">Average Workout Time</h2>
          <p className="text-accent text-7xl font-light mt-auto">{calculateAverageTime()}</p>
        </div>
      </div>

      {/* Stored Videos */}
      <div className="px-8">
        <h2 className="text-xl font-medium mb-4">Stored Videos</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted">
            <p className="mb-4">Unable to connect to the backend service.</p>
            <p>Using preview data instead.</p>
          </div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-8 text-muted">No workouts found. Upload a video to get started!</div>
        ) : (
          /* Workout Cards */
          workouts.map((workout) => (
            <Link href={`/workout/${workout.id}`} key={workout.id} className="block">
              <div className="relative mb-4 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10" />
                <Image
                  src={workout.metadata?.thumbnail || "/placeholder.svg?height=200&width=400"}
                  alt="Workout thumbnail"
                  width={400}
                  height={200}
                  className="w-full h-72 object-cover"
                />

                <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-end">
                  <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
                    <Image
                      src="/placeholder.svg?height=48&width=48"
                      alt="Influencer avatar"
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-bold">{workout.title || "Workout Generated Name"}</h3>
                      <ChevronRight className="w-6 h-6" />
                    </div>
                    <p className="text-muted">@{workout.metadata?.uploader || "Influencer Name"}</p>
                    <p className="mt-2">
                      Time:{" "}
                      {workout.metadata?.duration_seconds
                        ? `${Math.floor(workout.metadata.duration_seconds / 60)} min`
                        : "35 min"}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

