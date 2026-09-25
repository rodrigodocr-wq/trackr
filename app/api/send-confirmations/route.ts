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

  // Buscar store
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('shop_domain', shopDomain)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Buscar todos os pedidos da loja
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, product_name, shipping_address, tracking_id, customers(name, email)')
    .eq('store_id', store.id)
    .order('order_number')

  if (!orders || orders.length === 0) {
    return NextResponse.json({ message: 'No orders found', sent: 0 })
  }

  // Buscar emails já enviados
  const { data: sentLogs } = await supabase
    .from('email_logs')
    .select('order_id')
    .eq('status', 'sent')
    .in('order_id', orders.map(o => o.id))

  const sentOrderIds = new Set((sentLogs || []).map((l: any) => l.order_id))

  // Filtrar pedidos sem email enviado
  const pending = orders.filter(o => !sentOrderIds.has(o.id))

  if (pending.length === 0) {
    return NextResponse.json({ message: 'All orders already have emails sent', sent: 0 })
  }

  const results = []
  let sent = 0
  let failed = 0

  for (const order of pending) {
    const customer = order.customers as any
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
        storeName: store.name,
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
    summary: { total: pending.length, sent, failed },
    results,
  })
}
