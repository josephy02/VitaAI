"use client"

import React from "react"
import Image from "next/image"

// Map of platform-specific default thumbnails
const PLATFORM_THUMBNAILS: Record<string, string> = {
  youtube: "/platform-thumbnails/youtube.jpg",
  instagram: "/platform-thumbnails/instagram.jpg",
  tiktok: "/platform-thumbnails/tiktok.jpg",
  default: "/platform-thumbnails/default.jpg",
}

/**
 * Get a thumbnail URL for a workout
 * Uses the following priority:
 * 1. Actual thumbnail URL from metadata
 * 2. Platform-specific default thumbnail
 * 3. Generic placeholder
 */
export function getThumbnailUrl(workout: any): string {
  // If there's a thumbnail in metadata, use it
  if (workout?.metadata?.thumbnail) {
    return workout.metadata.thumbnail
  }

  // If we know the platform, use a platform-specific thumbnail
  if (workout?.platform && PLATFORM_THUMBNAILS[workout.platform]) {
    return PLATFORM_THUMBNAILS[workout.platform]
  }

  // Default placeholder
  return "/placeholder.svg?height=200&width=400"
}

/**
 * Generate a color based on workout tags
 * This creates a consistent color for similar workouts
 */
export function getWorkoutColor(tags: string[] = []): string {
  if (!tags || tags.length === 0) return "#625eeb" // Default card color

  // Map common workout types to specific colors
  const tagColorMap: Record<string, string> = {
    cardio: "#ff5e5b",
    strength: "#625eeb",
    hiit: "#ff9e4f",
    yoga: "#4ecdc4",
    core: "#7b68ee",
    chest: "#ff7eb6",
    legs: "#42a5f5",
    arms: "#66bb6a",
    back: "#5c6bc0",
    fullbody: "#8d6e63",
  }

  // Find the first tag that has a mapped color
  for (const tag of tags) {
    for (const [key, color] of Object.entries(tagColorMap)) {
      if (tag.toLowerCase().includes(key)) {
        return color
      }
    }
  }

  // If no matching tag, return default
  return "#625eeb"
}

interface WorkoutThumbnailProps {
  workout: any
  width?: number
  height?: number
  className?: string
  onClick?: () => void
}

/**
 * Interactive workout thumbnail component
 * Handles loading, errors, and displays platform-appropriate thumbnails
 */
export function WorkoutThumbnail({
  workout,
  width = 400,
  height = 200,
  className = "",
  onClick,
}: WorkoutThumbnailProps) {
  const [error, setError] = React.useState(false)
  const thumbnailUrl = error ? "/placeholder.svg?height=200&width=400" : getThumbnailUrl(workout)

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <Image
        src={thumbnailUrl || "/placeholder.svg"}
        alt={workout?.title || "Workout thumbnail"}
        width={width}
        height={height}
        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        unoptimized={!!workout?.metadata?.thumbnail}
        onError={() => setError(true)}
      />

      {/* Platform badge */}
      {workout?.platform && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
          {workout.platform}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  )
}

/**
 * Workout card component that displays a workout with thumbnail and details
 */
export function WorkoutCard({ workout, onClick }: { workout: any; onClick?: () => void }) {
  return (
    <div
      className="relative mb-4 rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(to bottom, ${getWorkoutColor(workout.tags)}33, ${getWorkoutColor(workout.tags)})`,
      }}
      onClick={onClick}
    >
      <WorkoutThumbnail workout={workout} className="w-full h-72" />

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
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 18L15 12L9 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
  )
}

