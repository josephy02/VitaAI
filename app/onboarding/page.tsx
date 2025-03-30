"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import type { UserProfile } from "@/services/api"

export default function OnboardingPage() {
  const { user, saveProfile } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<UserProfile>({
    name: user?.name || "",
    birthdate: "",
    height: "",
    experience: "beginner",
    socialMedia: [],
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleSocialMediaChange = (platform: string, checked: boolean) => {
    setProfile((prev) => {
      const socialMedia = checked ? [...prev.socialMedia, platform] : prev.socialMedia.filter((p) => p !== platform)
      return { ...prev, socialMedia }
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      await saveProfile(profile)
      router.push("/welcome")
    } catch (error) {
      console.error("Error saving profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-center p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Vita.</h1>
      </div>

      <div className="flex-1 flex flex-col px-8 py-6">
        <h2 className="text-2xl font-bold mb-2">Before we get started</h2>
        <p className="text-muted mb-6">Help us personalize your experience and grow.</p>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Birthdate</label>
              <input
                type="date"
                name="birthdate"
                value={profile.birthdate}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-800 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Height (cm)</label>
              <input
                type="number"
                name="height"
                value={profile.height}
                onChange={handleChange}
                placeholder="Height in cm"
                className="w-full p-3 rounded-md bg-gray-800 text-white"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Experience Level</label>
              <select
                name="experience"
                value={profile.experience}
                onChange={handleChange}
                className="w-full p-3 rounded-md bg-gray-800 text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-3">Social Media Platforms</label>

              <div className="space-y-2">
                {["Instagram", "TikTok", "YouTube", "Facebook"].map((platform) => (
                  <div key={platform} className="flex items-center">
                    <input
                      type="checkbox"
                      id={platform}
                      checked={profile.socialMedia.includes(platform)}
                      onChange={(e) => handleSocialMediaChange(platform, e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor={platform}>{platform}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-6 space-y-4">
          {step > 1 && (
            <button onClick={handleBack} className="w-full p-3 rounded-md border border-gray-700 text-white">
              Back
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={isLoading}
            className="w-full p-3 rounded-md bg-card text-white font-medium"
          >
            {step < 3 ? "Next" : isLoading ? "Saving..." : "Start Vita"}
          </button>
        </div>
      </div>
    </div>
  )
}

