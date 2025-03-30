"use client"

import type React from "react"

import { ArrowUp } from "lucide-react"
import { useState } from "react"

export function LinkUploadForm() {
  const [link, setLink] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle the link submission here
    console.log("Submitted link:", link)
    // Reset the form
    setLink("")
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-[#4b4b4b] rounded-full p-4 flex justify-between items-center">
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Upload a link here!"
          className="bg-transparent border-none outline-none text-lg ml-4 w-full"
        />
        <button type="submit" className="focus:outline-none">
          <ArrowUp className="w-6 h-6" />
        </button>
      </div>
    </form>
  )
}

