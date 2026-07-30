import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'
import { sendOrderConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const NINJA_DOMAIN = '2b9mrg-5j.myshopify.com'
const NINJA_TOKEN = process.env.NINJA_ACCESS_TOKEN || ''

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sendEmails = req.nextUrl.searchParams.get('emails') === 'true'
  const supabase = createServiceClient()

  try {
    // 1. Buscar store no banco
    const { data: store } = await supabase
      .from('stores')
      .select('id, name')
      .eq('shop_domain', NINJA_DOMAIN)
      .single()

    if (!store) {
      return NextResponse.json({ error: 'Ninja UK store not found in database' }, { status: 404 })
    }

    // 2. Buscar últimos 52 pedidos na Shopify
    const shopifyRes = await fetch(
      `https://${NINJA_DOMAIN}/admin/api/2024-01/orders.json?limit=52&status=any&fields=id,name,email,created_at,line_items,shipping_address,customer`,
      { headers: { 'X-Shopify-Access-Token': NINJA_TOKEN } }
    )

    if (!shopifyRes.ok) {
      const err = await shopifyRes.text()
      return NextResponse.json({ error: 'Shopify API error', details: err }, { status: 500 })
    }

    const { orders } = await shopifyRes.json()

    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No orders found', total: 0 })
    }

    const results = []
    let imported = 0
    let skipped = 0
    let failed = 0

    for (const order of orders) {
      try {
        const shopifyOrderId = String(order.id)
        const orderNumber = order.name?.replace('#', '') || shopifyOrderId
        const customerEmail = order.email || order.customer?.email || ''
        const customerName = order.customer
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
          : 'Customer'
        const productName = order.line_items?.[0]?.title || 'Ninja Product'
        const shippingAddress = order.shipping_address
          ? `${order.shipping_address.city || ''}, ${order.shipping_address.country || ''}`.trim().replace(/^,\s*/, '')
          : 'United Kingdom'

        // Verificar se já foi importado
        const { data: existing } = await supabase
          .from('orders')
          .select('id, tracking_id')
          .eq('shopify_order_id', shopifyOrderId)
          .eq('store_id', store.id)
          .maybeSingle()

        if (existing) {
          skipped++
          results.push({ orderNumber, status: 'skipped', trackingId: existing.tracking_id })
          continue
        }

        // Criar ou buscar customer
        const shopifyCustomerId = String(order.customer?.id || `guest-${shopifyOrderId}`)
        let { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('store_id', store.id)
          .eq('shopify_customer_id', shopifyCustomerId)
          .maybeSingle()

        if (!customer) {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              store_id: store.id,
              shopify_customer_id: shopifyCustomerId,
              name: customerName,
              email: customerEmail,
            })
            .select('id')
            .single()
          customer = newCustomer
        }

        // Gerar tracking ID
        const trackingId = generateTrackingId()

        // Criar pedido
        const { data: newOrder } = await supabase
          .from('orders')
          .insert({
            store_id: store.id,
            customer_id: customer!.id,
            shopify_order_id: shopifyOrderId,
            order_number: orderNumber,
            product_name: productName,
            shipping_address: shippingAddress,
            status: 'processing',
            tracking_id: trackingId,
          })
          .select('id, created_at')
          .single()

        // Criar tracking record
        const { data: trackingRecord } = await supabase
          .from('tracking_records')
          .insert({
            order_id: newOrder!.id,
            tracking_id: trackingId,
            current_day: 0,
            expires_at: getExpiresAt(newOrder!.created_at, 120),
          })
          .select('id')
          .single()

        // Evento inicial
        await supabase.from('tracking_events').insert({
          tracking_record_id: trackingRecord!.id,
          day: 0,
          title: 'Order Confirmed',
          description: 'Your order has been received and confirmed.',
        })

        // Enviar email (opcional)
        let emailSent = false
        if (sendEmails && customerEmail) {
          const emailResult = await sendOrderConfirmationEmail({
            to: customerEmail,
            customerName,
            orderNumber,
            productName,
            trackingId,
            shippingAddress,
            storeName: store.name,
          })
          emailSent = !emailResult.error

          await supabase.from('email_logs').insert({
            order_id: newOrder!.id,
            tracking_id: trackingId,
            email_to: customerEmail,
            subject: `Your order #${orderNumber} is confirmed — Tracking: ${trackingId}`,
            status: emailSent ? 'sent' : 'failed',
          })
        }

        imported++
        results.push({ orderNumber, status: 'imported', trackingId, emailSent, customer: customerName })

      } catch (err: any) {
        failed++
        results.push({ orderNumber: order.name, status: 'error', error: err.message })
      }
    }

    return NextResponse.json({
      ok: true,
      summary: { total: orders.length, imported, skipped, failed },
      results,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
