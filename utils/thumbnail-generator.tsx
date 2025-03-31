// "use client"

// import React from "react"
// import Image from "next/image"

// // Map of platform-specific default thumbnails
// const PLATFORM_THUMBNAILS: Record<string, string> = {
//   youtube: "/platform-thumbnails/youtube.jpg",
//   instagram: "/platform-thumbnails/instagram.jpg",
//   tiktok: "/platform-thumbnails/tiktok.jpg",
//   default: "/platform-thumbnails/default.jpg",
// }

// /**
//  * Get a thumbnail URL for a workout
//  * Uses the following priority:
//  * 1. Actual thumbnail URL from metadata
//  * 2. Platform-specific default thumbnail
//  * 3. Generic placeholder
//  */
// export function getThumbnailUrl(workout: any): string {
//   // If there's a thumbnail in metadata, use it
//   if (workout?.metadata?.thumbnail) {
//     return workout.metadata.thumbnail
//   }

//   // If we know the platform, use a platform-specific thumbnail
//   if (workout?.platform && PLATFORM_THUMBNAILS[workout.platform]) {
//     return PLATFORM_THUMBNAILS[workout.platform]
//   }

//   // Default placeholder
//   return "/placeholder.svg?height=200&width=400"
// }

// /**
//  * Generate a color based on workout tags
//  * This creates a consistent color for similar workouts
//  */
// export function getWorkoutColor(tags: string[] = []): string {
//   if (!tags || tags.length === 0) return "#625eeb" // Default card color

//   // Map common workout types to specific colors
//   const tagColorMap: Record<string, string> = {
//     cardio: "#ff5e5b",
//     strength: "#625eeb",
//     hiit: "#ff9e4f",
//     yoga: "#4ecdc4",
//     core: "#7b68ee",
//     chest: "#ff7eb6",
//     legs: "#42a5f5",
//     arms: "#66bb6a",
//     back: "#5c6bc0",
//     fullbody: "#8d6e63",
//   }

//   // Find the first tag that has a mapped color
//   for (const tag of tags) {
//     for (const [key, color] of Object.entries(tagColorMap)) {
//       if (tag.toLowerCase().includes(key)) {
//         return color
//       }
//     }
//   }

//   // If no matching tag, return default
//   return "#625eeb"
// }

// interface WorkoutThumbnailProps {
//   workout: any
//   width?: number
//   height?: number
//   className?: string
//   onClick?: () => void
// }

// /**
//  * Interactive workout thumbnail component
//  * Handles loading, errors, and displays platform-appropriate thumbnails
//  */
// export function WorkoutThumbnail({
//   workout,
//   width = 400,
//   height = 200,
//   className = "",
//   onClick,
// }: WorkoutThumbnailProps) {
//   const [error, setError] = React.useState(false)
//   const thumbnailUrl = error ? "/placeholder.svg?height=200&width=400" : getThumbnailUrl(workout)

//   return (
//     <div
//       className={`relative overflow-hidden ${className}`}
//       onClick={onClick}
//       style={{ cursor: onClick ? "pointer" : "default" }}
//     >
//       <Image
//         src={thumbnailUrl || "/placeholder.svg"}
//         alt={workout?.title || "Workout thumbnail"}
//         width={width}
//         height={height}
//         className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
//         unoptimized={!!workout?.metadata?.thumbnail}
//         onError={() => setError(true)}
//       />

//       {/* Platform badge */}
//       {workout?.platform && (
//         <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
//           {workout.platform}
//         </div>
//       )}

//       {/* Gradient overlay */}
//       <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
//     </div>
//   )
// }

// /**
//  * Workout card component that displays a workout with thumbnail and details
//  */
// export function WorkoutCard({ workout, onClick }: { workout: any; onClick?: () => void }) {
//   return (
//     <div
//       className="relative mb-4 rounded-2xl overflow-hidden"
//       style={{
//         background: `linear-gradient(to bottom, ${getWorkoutColor(workout.tags)}33, ${getWorkoutColor(workout.tags)})`,
//       }}
//       onClick={onClick}
//     >
//       <WorkoutThumbnail workout={workout} className="w-full h-72" />

//       <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex items-end">
//         <div className="w-12 h-12 rounded-full overflow-hidden mr-4">
//           <Image
//             src="/placeholder.svg?height=48&width=48"
//             alt="Influencer avatar"
//             width={48}
//             height={48}
//             className="w-full h-full object-cover"
//           />
//         </div>

//         <div className="flex-1">
//           <div className="flex justify-between items-center">
//             <h3 className="text-2xl font-bold">{workout.title || "Workout Generated Name"}</h3>
//             <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//               <path
//                 d="M9 18L15 12L9 6"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//               />
//             </svg>
//           </div>
//           <p className="text-muted">@{workout.metadata?.uploader || "Influencer Name"}</p>
//           <p className="mt-2">
//             Time:{" "}
//             {workout.metadata?.duration_seconds
//               ? `${Math.floor(workout.metadata.duration_seconds / 60)} min`
//               : "35 min"}
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }
"use client"

import React from "react"
import Image from "next/image"

// Map of platform-specific default thumbnails
const PLATFORM_THUMBNAILS: Record<string, string> = {
  youtube: "/platform-thumbnails/youtube.jpg",
  instagram: "/platform-thumbnails/instagram.jpg",
  tiktok: "/platform-thumbnails/tiktok.jpg",
  vimeo: "/platform-thumbnails/vimeo.jpg",
  twitter: "/platform-thumbnails/twitter.jpg",
  facebook: "/platform-thumbnails/facebook.jpg",
  default: "/platform-thumbnails/default.jpg",
}

/**
 * Extract YouTube thumbnail from video URL or ID
 * YouTube offers several thumbnail qualities: default, hqdefault, mqdefault, sddefault, maxresdefault
 */
function getYouTubeThumbnail(videoId: string): string {
  if (!videoId) return PLATFORM_THUMBNAILS.youtube

  // Try maxresdefault first (highest quality), fallback to hqdefault if that fails
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  // Alternative option: return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Extract YouTube video ID from different URL formats
 */
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null

  // Handle various YouTube URL formats
  const regexPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/watch\?.*v=)([^&\s]+)/,
    /youtube.com\/shorts\/([^&\s]+)/
  ]

  for (const pattern of regexPatterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Extract Vimeo thumbnail from video URL or ID
 * Note: For production, it's better to use Vimeo's oEmbed API
 * This is a fallback that uses Vimeo's thumbnail pattern
 */
function getVimeoThumbnailFromId(videoId: string): string {
  if (!videoId) return PLATFORM_THUMBNAILS.vimeo

  // This is just a fallback pattern - ideally use the API for reliable thumbnails
  return `https://vumbnail.com/${videoId}.jpg`
}

/**
 * Extract Vimeo video ID from URL
 */
function extractVimeoVideoId(url: string): string | null {
  if (!url) return null

  const regex = /vimeo\.com\/(?:video\/)?(\d+)/
  const match = url.match(regex)

  return match && match[1] ? match[1] : null
}

/**
 * Extract TikTok thumbnail from video metadata
 * TikTok offers cover images in their API responses
 */
function getTikTokThumbnail(metadata: any): string {
  // TikTok thumbnails might be in various locations based on the API response
  if (metadata?.cover_image_url) return metadata.cover_image_url
  if (metadata?.thumbnail_url) return metadata.thumbnail_url
  if (metadata?.thumbnails && metadata.thumbnails.length > 0) return metadata.thumbnails[0]
  if (metadata?.images && metadata.images.length > 0) return metadata.images[0]

  return PLATFORM_THUMBNAILS.tiktok
}

/**
 * Extract Instagram thumbnail from video metadata
 */
function getInstagramThumbnail(metadata: any): string {
  // Instagram media might have thumbnails in various locations
  if (metadata?.thumbnail_url) return metadata.thumbnail_url
  if (metadata?.images && metadata.images.standard_resolution?.url) {
    return metadata.images.standard_resolution.url
  }
  if (metadata?.thumbnail_resources && metadata.thumbnail_resources.length > 0) {
    // Get the largest thumbnail available
    const sortedResources = [...metadata.thumbnail_resources].sort(
      (a, b) => (b.width * b.height) - (a.width * a.height)
    )
    return sortedResources[0].src
  }

  return PLATFORM_THUMBNAILS.instagram
}

/**
 * Extract Twitter/X thumbnail from video metadata
 */
function getTwitterThumbnail(metadata: any): string {
  // Twitter video metadata formats
  if (metadata?.media_url_https) return metadata.media_url_https
  if (metadata?.extended_entities?.media?.[0]?.media_url_https) {
    return metadata.extended_entities.media[0].media_url_https
  }

  return PLATFORM_THUMBNAILS.twitter
}

/**
 * Extract Facebook thumbnail from video metadata
 */
function getFacebookThumbnail(metadata: any): string {
  // Facebook video metadata formats
  if (metadata?.thumbnails?.data && metadata.thumbnails.data.length > 0) {
    return metadata.thumbnails.data[0].uri
  }
  if (metadata?.picture) return metadata.picture

  return PLATFORM_THUMBNAILS.facebook
}

/**
 * Get a thumbnail URL for a workout
 * Uses the following priority:
 * 1. Platform-specific thumbnail extraction from metadata
 * 2. Directly provided thumbnail URL from metadata
 * 3. Platform-specific default thumbnail
 * 4. Generic placeholder
 */
export function getThumbnailUrl(workout: any): string {
  console.log("Workout metadata for thumbnail:", workout?.metadata);
  const platform = workout?.platform?.toLowerCase()
  const metadata = workout?.metadata || {}
  const videoUrl = metadata.video_url || metadata.url || ""

  // First try platform-specific extraction methods
  if (platform === "youtube") {
    // Try to extract from metadata or URL
    const videoId = metadata.youtube_id || extractYouTubeVideoId(videoUrl)
    if (videoId) {
      return getYouTubeThumbnail(videoId)
    }
  } else if (platform === "vimeo") {
    const videoId = metadata.vimeo_id || extractVimeoVideoId(videoUrl)
    if (videoId) {
      return getVimeoThumbnailFromId(videoId)
    }
  } else if (platform === "tiktok") {
    const tiktokThumbnail = getTikTokThumbnail(metadata)
    if (tiktokThumbnail !== PLATFORM_THUMBNAILS.tiktok) {
      return tiktokThumbnail
    }
  } else if (platform === "instagram") {
    const instagramThumbnail = getInstagramThumbnail(metadata)
    if (instagramThumbnail !== PLATFORM_THUMBNAILS.instagram) {
      return instagramThumbnail
    }
  } else if (platform === "twitter" || platform === "x") {
    const twitterThumbnail = getTwitterThumbnail(metadata)
    if (twitterThumbnail !== PLATFORM_THUMBNAILS.twitter) {
      return twitterThumbnail
    }
  } else if (platform === "facebook") {
    const facebookThumbnail = getFacebookThumbnail(metadata)
    if (facebookThumbnail !== PLATFORM_THUMBNAILS.facebook) {
      return facebookThumbnail
    }
  }

  // If there's a direct thumbnail in metadata, use it
  if (metadata.thumbnail) {
    return metadata.thumbnail
  }

  // If all else fails, use platform-specific default or generic placeholder
  if (platform && PLATFORM_THUMBNAILS[platform]) {
    return PLATFORM_THUMBNAILS[platform]
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
        unoptimized={true} // Better for external thumbnails
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