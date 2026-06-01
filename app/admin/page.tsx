'use client'

import { useEffect, useState } from 'react'

interface Order {
  id: string
  orderNumber: string
  productName: string
  status: string
  trackingId: string
  createdAt: string
  customerName: string
  customerEmail: string
}

interface Metrics {
  totalOrders: number
  activeOrders: number
  deliveredOrders: number
  totalEmails: number
  totalTracking: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:          { label: 'Pending',          color: 'bg-yellow-100 text-yellow-700' },
  processing:       { label: 'Processing',       color: 'bg-blue-100 text-blue-700' },
  in_transit:       { label: 'In Transit',       color: 'bg-indigo-100 text-indigo-700' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-100 text-purple-700' },
  delivered:        { label: 'Delivered',        color: 'bg-green-100 text-green-700' },
  cancelled:        { label: 'Cancelled',        color: 'bg-red-100 text-red-700' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetch('/api/admin', { headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_CRON_SECRET || '' } })
      .then(r => r.json())
      .then(d => { setMetrics(d.metrics); setOrders(d.orders || []) })
      .finally(() => setLoading(false))
  }, [])

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.trackingId?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerEmail?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white py-4 px-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-widest">TRACKR</h1>
            <p className="text-gray-400 text-xs">Admin Dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Wellvita Site</p>
            <p className="text-gray-500 text-xs">nhde1w-4m.myshopify.com</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total orders',        value: metrics.totalOrders,     color: 'text-gray-900' },
              { label: 'Active orders',       value: metrics.activeOrders,    color: 'text-blue-600' },
              { label: 'Delivered',           value: metrics.deliveredOrders, color: 'text-green-600' },
              { label: 'Tracking IDs issued', value: metrics.totalTracking,   color: 'text-purple-600' },
              { label: 'Emails sent',         value: metrics.totalEmails,     color: 'text-orange-600' },
            ].map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">{m.label}</p>
                <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by order, tracking ID or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Orders</h2>
            <span className="text-xs text-gray-400">{filtered.length} results</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No orders found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Order', 'Customer', 'Product', 'Tracking ID', 'Status', 'Date', 'Action'].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(order => {
                    const s = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' }
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">#{order.orderNumber}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{order.customerName}</p>
                          <p className="text-gray-400 text-xs">{order.customerEmail}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{order.productName}</td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-700">{order.trackingId}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(order.createdAt)}</td>
                        <td className="px-6 py-4">
                          <a href={`/track/${order.trackingId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-black underline hover:no-underline">
                            View tracking
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
