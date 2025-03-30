import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"

export const metadata: Metadata = {
  title: "Vita - Bring your feed to life",
  description: "AI-powered fitness application that repurposes your fitness social media content",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="dark">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}



import './globals.css'