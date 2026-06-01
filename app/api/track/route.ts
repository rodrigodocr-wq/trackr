import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const trackingId = req.nextUrl.searchParams.get('id')
  if (!trackingId) {
    return NextResponse.json({ error: 'Tracking ID required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      product_name,
      shipping_address,
      status,
      tracking_id,
      created_at,
      customers ( name, email ),
      stores ( shop_domain ),
      tracking_records (
        id,
        current_day,
        expires_at,
        tracking_events (
          id,
          day,
          title,
          description,
          triggered_at
        )
      )
    `)
    .eq('tracking_id', trackingId.toUpperCase())
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const shopDomain = (order.stores as any)?.shop_domain
  const locale = getLocale(shopDomain)
  const record = (order.tracking_records as any[])?.[0]
  const events = (record?.tracking_events || []).sort((a: any, b: any) => a.day - b.day)
  const isExpired = record?.expires_at ? new Date(record.expires_at) < new Date() : false

  return NextResponse.json({
    locale,
    order: {
      orderNumber: order.order_number,
      productName: order.product_name,
      shippingAddress: order.shipping_address,
      status: order.status,
      trackingId: order.tracking_id,
      createdAt: order.created_at,
      customerName: (order.customers as any)?.name,
    },
    tracking: {
      currentDay: record?.current_day || 0,
      expiresAt: record?.expires_at,
      isExpired,
      events,
    }
  })
}
