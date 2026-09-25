import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendOrderConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shopDomain = req.nextUrl.searchParams.get('shop') || 'ez1exp-4e.myshopify.com'
  const supabase = createServiceClient()

  // Buscar pedidos sem email enviado
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, product_name, shipping_address, tracking_id,
      customers ( name, email ),
      stores ( name, shop_domain )
    `)
    .eq('stores.shop_domain', shopDomain)
    .not('id', 'in', 
      supabase.from('email_logs').select('order_id').eq('status', 'sent')
    )
    .order('order_number')

  if (!orders || orders.length === 0) {
    return NextResponse.json({ message: 'No pending orders found', sent: 0 })
  }

  const results = []
  let sent = 0
  let failed = 0

  for (const order of orders) {
    const customer = order.customers as any
    const store = order.stores as any

    if (!customer?.email) {
      results.push({ order: order.order_number, status: 'skipped', reason: 'no email' })
      continue
    }

    try {
      const emailResult = await sendOrderConfirmationEmail({
        to: customer.email,
        customerName: customer.name || 'Customer',
        orderNumber: order.order_number,
        productName: order.product_name,
        trackingId: order.tracking_id,
        shippingAddress: order.shipping_address,
        storeName: store?.name || 'Benevita',
      })

      const success = !emailResult.error

      await supabase.from('email_logs').insert({
        order_id: order.id,
        tracking_id: order.tracking_id,
        email_to: customer.email,
        subject: `Your order #${order.order_number} is confirmed — Tracking: ${order.tracking_id}`,
        status: success ? 'sent' : 'failed',
      })

      if (success) {
        sent++
        results.push({ order: order.order_number, status: 'sent', to: customer.email, trackingId: order.tracking_id })
      } else {
        failed++
        results.push({ order: order.order_number, status: 'failed', error: emailResult.error })
      }
    } catch (err: any) {
      failed++
      results.push({ order: order.order_number, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({
    ok: true,
    summary: { total: orders.length, sent, failed },
    results,
  })
}
