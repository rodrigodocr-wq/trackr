import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'
import { sendOrderConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const NINJA_DOMAIN = '2b9mrg-5j.myshopify.com'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sendEmails = req.nextUrl.searchParams.get('emails') === 'true'
  const ninjaToken = process.env.NINJA_ACCESS_TOKEN || ''
  const supabase = createServiceClient()

  try {
    // 1. Buscar store
    const { data: store } = await supabase
      .from('stores')
      .select('id, name')
      .eq('shop_domain', NINJA_DOMAIN)
      .single()

    if (!store) return NextResponse.json({ error: 'Ninja UK not found' }, { status: 404 })

    // 2. Buscar pedidos via GraphQL (suportado pelo atkn_)
    const query = `{
      orders(first: 52, reverse: true) {
        edges {
          node {
            id
            name
            email
            createdAt
            displayFulfillmentStatus
            shippingAddress { city country }
            customer { id firstName lastName email }
            lineItems(first: 1) {
              edges { node { title } }
            }
          }
        }
      }
    }`

    const gqlRes = await fetch(
      `https://${NINJA_DOMAIN}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': ninjaToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    )

    const gqlData = await gqlRes.json()

    if (gqlData.errors) {
      return NextResponse.json({ error: 'GraphQL error', details: gqlData.errors }, { status: 500 })
    }

    const orders = gqlData.data?.orders?.edges?.map((e: any) => e.node) || []

    if (orders.length === 0) {
      return NextResponse.json({ message: 'No orders found', total: 0 })
    }

    let imported = 0, skipped = 0, failed = 0
    const results = []

    for (const order of orders) {
      try {
        // ID numérico do Shopify
        const shopifyOrderId = order.id.replace('gid://shopify/Order/', '')
        const orderNumber = order.name?.replace('#', '') || shopifyOrderId
        const customerEmail = order.email || order.customer?.email || ''
        const customerName = order.customer
          ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim()
          : 'Customer'
        const productName = order.lineItems?.edges?.[0]?.node?.title || 'Ninja Product'
        const shippingAddress = order.shippingAddress
          ? `${order.shippingAddress.city || ''}, ${order.shippingAddress.country || ''}`.replace(/^,\s*/, '')
          : 'United Kingdom'

        // Verificar se já existe
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

        // Customer
        const shopifyCustomerId = order.customer?.id?.replace('gid://shopify/Customer/', '') || `guest-${shopifyOrderId}`
        let { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('store_id', store.id)
          .eq('shopify_customer_id', shopifyCustomerId)
          .maybeSingle()

        if (!customer) {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({ store_id: store.id, shopify_customer_id: shopifyCustomerId, name: customerName, email: customerEmail })
            .select('id').single()
          customer = newCustomer
        }

        const trackingId = generateTrackingId()

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
          .select('id, created_at').single()

        const { data: trackingRecord } = await supabase
          .from('tracking_records')
          .insert({ order_id: newOrder!.id, tracking_id: trackingId, current_day: 0, expires_at: getExpiresAt(newOrder!.created_at, 120) })
          .select('id').single()

        await supabase.from('tracking_events').insert({
          tracking_record_id: trackingRecord!.id,
          day: 0,
          title: 'Order Confirmed',
          description: 'Your order has been received and confirmed.',
        })

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
