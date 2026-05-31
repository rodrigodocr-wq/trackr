'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [trackingId, setTrackingId] = useState('')
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const id = trackingId.trim().toUpperCase()
    if (id) router.push(`/track/${id}`)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold text-white tracking-widest mb-2">TRACKR</h1>
        <p className="text-gray-400 text-sm mb-10">Track your order in real time</p>

        <form onSubmit={handleSearch} className="space-y-3">
          <input
            type="text"
            placeholder="Enter your code — e.g. TRK938475UK"
            value={trackingId}
            onChange={e => setTrackingId(e.target.value)}
            className="w-full bg-white/10 text-white placeholder-gray-500 border border-white/20 rounded-xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 text-center tracking-widest uppercase"
          />
          <button
            type="submit"
            className="w-full bg-white text-black font-semibold py-4 rounded-xl text-sm hover:bg-gray-100 transition-colors"
          >
            Track my order
          </button>
        </form>

        <p className="text-gray-600 text-xs mt-8">
          Your tracking code was sent by email after your order was confirmed.
        </p>
      </div>
    </div>
  )
}
