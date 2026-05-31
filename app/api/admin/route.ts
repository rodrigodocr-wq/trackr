import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const [ordersRes, emailsRes, trackingRes] = await Promise.all([
    supabase.from('orders').select('id, order_number, product_name, status, tracking_id, created_at, customers(name, email)', ).order('created_at', { ascending: false }).limit(50),
    supabase.from('email_logs').select('id', { count: 'exact' }),
    supabase.from('tracking_records').select('id', { count: 'exact' }),
  ])

  const orders = ordersRes.data || []
  const totalOrders = orders.length
  const activeOrders = orders.filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled').length
  const deliveredOrders = orders.filter((o: any) => o.status === 'delivered').length
  const totalEmails = emailsRes.count || 0
  const totalTracking = trackingRes.count || 0

  return NextResponse.json({
    metrics: {
      totalOrders,
      activeOrders,
      deliveredOrders,
      totalEmails,
      totalTracking,
    },
    orders: orders.map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      productName: o.product_name,
      status: o.status,
      trackingId: o.tracking_id,
      createdAt: o.created_at,
      customerName: (o.customers as any)?.name,
      customerEmail: (o.customers as any)?.email,
    }))
  })
}
