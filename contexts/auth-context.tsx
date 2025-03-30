"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { userService, type UserProfile } from "@/services/api"

interface AuthContextType {
  user: UserProfile | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  saveProfile: (profile: UserProfile) => Promise<boolean>
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in on mount
    const profile = userService.getProfile()
    setUser(profile)
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    const success = userService.login(username, password)
    if (success) {
      const profile = userService.getProfile()
      setUser(profile)
      return true
    }
    return false
  }

  const logout = () => {
    userService.logout()
    setUser(null)
    router.push("/login")
  }

  const saveProfile = async (profile: UserProfile) => {
    const success = await userService.saveProfile(profile)
    if (success) {
      setUser(profile)
    }
    return success
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        saveProfile,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

