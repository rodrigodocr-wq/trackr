'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface TrackingEvent {
  id: string
  day: number
  title: string
  description: string
  triggered_at: string
}

interface TrackingData {
  order: {
    orderNumber: string
    productName: string
    shippingAddress: string
    status: string
    trackingId: string
    createdAt: string
    customerName: string
  }
  tracking: {
    currentDay: number
    expiresAt: string
    isExpired: boolean
    events: TrackingEvent[]
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:           { label: 'Pending',           color: 'bg-yellow-100 text-yellow-800' },
    processing:        { label: 'Processing',        color: 'bg-blue-100 text-blue-800' },
    in_transit:        { label: 'In Transit',        color: 'bg-indigo-100 text-indigo-800' },
    out_for_delivery:  { label: 'Out for Delivery',  color: 'bg-purple-100 text-purple-800' },
    delivered:         { label: 'Delivered',         color: 'bg-green-100 text-green-800' },
    cancelled:         { label: 'Cancelled',         color: 'bg-red-100 text-red-800' },
  }
  const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

export default function TrackingPage() {
  const { trackingId } = useParams<{ trackingId: string }>()
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/track?id=${trackingId}`)
        if (!res.ok) throw new Error('Order not found')
        const json = await res.json()
        setData(json)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [trackingId])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading your order details...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h2>
        <p className="text-gray-500 text-sm">Please check your tracking code and try again.</p>
        <p className="text-gray-400 text-xs mt-2 font-mono">{trackingId}</p>
      </div>
    </div>
  )

  if (!data) return null

  const { order, tracking } = data
  const lastEvent = tracking.events[tracking.events.length - 1]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-widest">TRACKR</h1>
          <span className="text-gray-400 text-xs">Order Tracking System</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-black px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-xs mb-1">Tracking code</p>
                <p className="text-white text-2xl font-bold tracking-widest">{order.trackingId}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Order number</p>
                <p className="text-sm font-semibold text-gray-900">#{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Order date</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(order.createdAt)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">Product</p>
                <p className="text-sm font-semibold text-gray-900">{order.productName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-1">Delivery address</p>
                <p className="text-sm font-semibold text-gray-900">{order.shippingAddress}</p>
              </div>
            </div>

            {lastEvent && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-500 font-medium mb-1">Latest update</p>
                <p className="text-sm font-semibold text-blue-900">{lastEvent.title}</p>
                <p className="text-xs text-blue-700 mt-1">{lastEvent.description}</p>
                <p className="text-xs text-blue-400 mt-2">{formatDateTime(lastEvent.triggered_at)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-6">Tracking history</h2>

          {tracking.events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No updates yet.</p>
              <p className="text-gray-300 text-xs mt-1">Updates will appear here shortly.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {[...tracking.events].reverse().map((event, idx) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${idx === 0 ? 'bg-black' : 'bg-gray-300'}`} />
                    {idx < tracking.events.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 my-1 min-h-[24px]" />
                    )}
                  </div>
                  <div className="pb-5 flex-1">
                    <p className={`text-sm font-semibold ${idx === 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                      {event.title}
                    </p>
                    <p className={`text-xs mt-0.5 ${idx === 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">{formatDateTime(event.triggered_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Tracking available until {formatDate(tracking.expiresAt)} · {order.trackingId}
        </p>
      </div>
    </div>
  )
}
