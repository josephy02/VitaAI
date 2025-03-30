// API service for interacting with the backend

// Base URLs for the two backend services
const VIDEO_API_BASE_URL = "http://localhost:8000/api"
const WORKOUT_API_BASE_URL = "http://localhost:8001/api"

// Types based on backend models
export interface VideoAnalysis {
  id?: string
  title?: string
  video_url?: string
  summary_prompt?: string
  transcript?: string
  summary: string | any
  platform?: string
  metadata?: any
  date_saved?: string
  date_modified?: string
  tags: string[]
}

export interface WorkoutData {
  id?: string
  title?: string
  summary: string
  date_saved?: string
  date_modified?: string
}

export interface ChatMessage {
  role: string
  content: string
}

export interface UserProfile {
  name: string
  birthdate: string
  height: string
  weight?: string
  experience: string
  socialMedia: string[]
}

// Mock data for preview environment
const MOCK_WORKOUTS: VideoAnalysis[] = [
  {
    id: "1",
    title: "Vacation Workout: Superset Pump and Tone Routine",
    summary: {
      current_workout:
        "1. Superset lat pull downs with single leg deadlifts, three rounds total with 12 reps on the first and 12 reps on each leg for the second exercise.\n2. Superset chest press with hip thrusts, three rounds with 12 reps of each exercise.\n3. Rest for 1-2 minutes between each round. \n4. Perform lateral raises for three sets of 15 reps as a standalone exercise. \n5. Finish with plank shoulder taps for three sets of 20 reps.",
      user_request: "Make this workout more intense",
      text: "1. Superset lat pull downs with single leg deadlifts, three rounds total with 15 reps on the first and 15 reps on each leg for the second exercise.\n2. Superset chest press with hip thrusts, three rounds with 15 reps of each exercise.\n3. Rest for 1 minute between each round.\n4. Perform lateral raises for three sets of 20 reps as a standalone exercise.\n5. Finish with plank shoulder taps for three sets of 25 reps.",
    },
    video_url: "https://www.instagram.com/sophietfitness___/reel/DGRaMd4xd7c/",
    platform: "instagram",
    metadata: {
      uploader: "sophietfitness___",
      duration_seconds: 2730,
      thumbnail: "/placeholder.svg?height=200&width=400",
    },
    date_saved: "2025-03-19 23:43:15",
    date_modified: "2025-03-19 23:43:50",
    tags: ["chest"],
  },
  {
    id: "2",
    title: "Bodyweight Squat: Form and Benefits",
    summary:
      "1. Stand with feet wider than shoulder-width apart.\n2. Cross arms in front of body, right hand on left shoulder, left hand on right shoulder.\n3. Keep elbows pointing straight ahead.\n4. Shift weight onto balls of feet.\n5. Bend knees to 90-degree angle.\n6. Push up to starting position.\n7. Repeat for sets to strengthen thighs, butt, and improve posture. \n\nBenefits:\n- Strengthens quadriceps and glutes\n- Improves posture",
    platform: "youtube",
    metadata: {
      uploader: "fitnessexpert",
      duration_seconds: 1800,
      thumbnail: "/placeholder.svg?height=200&width=400",
    },
    date_saved: "2025-03-20 00:16:25",
    date_modified: "2025-03-20 00:17:06",
    tags: [
      "thighs",
      "butt",
      "posture",
      "quadriceps",
      "glutes",
      "strength training",
      "lower body workout",
      "bodyweight exercise",
    ],
  },
]

// Video analysis service
export const videoService = {
  // Analyze a video from a URL
  async analyzeVideoUrl(videoUrl: string, summaryPrompt: string): Promise<VideoAnalysis> {
    try {
      const response = await fetch(`${VIDEO_API_BASE_URL}/analyze-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_url: videoUrl,
          summary_prompt: summaryPrompt,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze video")
      }

      return response.json()
    } catch (error) {
      console.error("API error:", error)
      // Return mock data for preview
      return {
        id: Date.now().toString(),
        title: "New Workout from " + videoUrl.split("/").pop(),
        summary: "This is a mock workout summary generated for preview purposes.",
        tags: ["preview", "mock"],
        metadata: {
          uploader: "preview",
          duration_seconds: 1800,
        },
      }
    }
  },

  // Save a video analysis
  async saveAnalysis(analysis: VideoAnalysis): Promise<{ id: string }> {
    try {
      const response = await fetch(`${VIDEO_API_BASE_URL}/analyses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(analysis),
      })

      if (!response.ok) {
        throw new Error("Failed to save analysis")
      }

      return response.json()
    } catch (error) {
      console.error("API error:", error)
      // Return mock response for preview
      return { id: Date.now().toString() }
    }
  },

  // Get all saved analyses
  async getAnalyses(): Promise<VideoAnalysis[]> {
    try {
      const response = await fetch(`${VIDEO_API_BASE_URL}/analyses`)

      if (!response.ok) {
        throw new Error("Failed to fetch analyses")
      }

      return response.json()
    } catch (error) {
      console.error("API error:", error)
      // Return mock data for preview
      return MOCK_WORKOUTS
    }
  },

  // Get a specific analysis by ID
  async getAnalysisById(id: string): Promise<VideoAnalysis> {
    try {
      const response = await fetch(`${VIDEO_API_BASE_URL}/analyses/${id}`)

      if (!response.ok) {
        throw new Error("Analysis not found")
      }

      return response.json()
    } catch (error) {
      console.error("API error:", error)
      // Return mock data for preview
      const mockWorkout = MOCK_WORKOUTS.find((w) => w.id === id)
      if (mockWorkout) {
        return mockWorkout
      }
      // If ID not found in mock data, return the first one
      return MOCK_WORKOUTS[0]
    }
  },
}

// Workout service
export const workoutService = {
  // Modify a workout
  async modifyWorkout(workoutId: string, message: string): Promise<any> {
    try {
      const response = await fetch(`${WORKOUT_API_BASE_URL}/workouts/${workoutId}/modify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workout_id: workoutId,
          message,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to modify workout")
      }

      return response.json()
    } catch (error) {
      console.error("API error:", error)
      // Return mock response for preview
      const mockWorkout = MOCK_WORKOUTS.find((w) => w.id === workoutId) || MOCK_WORKOUTS[0]
      return {
        success: true,
        explanation: `I've modified the workout based on your request: "${message}"`,
        workout: {
          ...mockWorkout,
          summary: mockWorkout.summary + "\n\nModified based on your request.",
        },
      }
    }
  },

  // Get chat history for a workout
  async getChatHistory(workoutId: string): Promise<ChatMessage[]> {
    try {
      const response = await fetch(`${WORKOUT_API_BASE_URL}/workouts/${workoutId}/history`)

      if (!response.ok) {
        throw new Error("Failed to fetch chat history")
      }

      const data = await response.json()
      return data.conversation_history
    } catch (error) {
      console.error("API error:", error)
      // Return mock data for preview
      return [
        {
          role: "assistant",
          content: "Hello! I can help you modify this workout. What changes would you like to make?",
        },
      ]
    }
  },

  // Generate a new workout
  async generateWorkout(requirements: string): Promise<WorkoutData> {
    try {
      const response = await fetch(`${WORKOUT_API_BASE_URL}/workouts/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requirements }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate workout")
      }

      const data = await response.json()
      return data.workout
    } catch (error) {
      console.error("API error:", error)
      // Return mock data for preview
      return {
        id: Date.now().toString(),
        title: "Custom Workout",
        summary: `Custom workout based on: ${requirements}\n\n1. Warm-up - 5 minutes\n2. Main exercises - 20 minutes\n3. Cool down - 5 minutes`,
        date_saved: new Date().toISOString(),
      }
    }
  },
}

// User service for authentication and profile management
export const userService = {
  // Save user profile
  async saveProfile(profile: UserProfile): Promise<boolean> {
    // In a real app, this would send the profile to the backend
    console.log("Saving profile:", profile)

    // Store in localStorage for now
    localStorage.setItem("userProfile", JSON.stringify(profile))
    return true
  },

  // Get user profile
  getProfile(): UserProfile | null {
    try {
      const profile = localStorage.getItem("userProfile")
      return profile ? JSON.parse(profile) : null
    } catch (error) {
      console.error("Error getting profile:", error)
      return null
    }
  },

  // Check if user is logged in
  isLoggedIn(): boolean {
    return !!localStorage.getItem("userProfile")
  },

  // Login user
  login(username: string, password: string): boolean {
    // In a real app, this would validate credentials with the backend
    // For now, just simulate a successful login
    if (username && password) {
      localStorage.setItem(
        "userProfile",
        JSON.stringify({
          name: username,
          birthdate: "",
          height: "",
          experience: "",
          socialMedia: [],
        }),
      )
      return true
    }
    return false
  },

  // Logout user
  logout(): void {
    localStorage.removeItem("userProfile")
  },
}

