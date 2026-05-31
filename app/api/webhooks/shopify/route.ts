import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyShopifyWebhook, extractOrderData } from '@/lib/shopify'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'
import { sendOrderConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rawBody = Buffer.from(await req.arrayBuffer())
    const hmac = req.headers.get('x-shopify-hmac-sha256') || ''
    const topic = req.headers.get('x-shopify-topic') || ''
    const shopDomain = req.headers.get('x-shopify-shop-domain') || ''

    // 1. Verificar assinatura do webhook
    if (!verifyShopifyWebhook(rawBody, hmac)) {
      console.error('Webhook inválido — assinatura incorreta')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Só processa pedidos novos
    if (topic !== 'orders/create') {
      return NextResponse.json({ ok: true, skipped: topic })
    }

    const order = JSON.parse(rawBody.toString())
    const { shopifyOrderId, orderNumber, productName, shippingAddress, customer } = extractOrderData(order)

    if (!customer.email) {
      console.warn(`Pedido #${orderNumber} sem email — ignorado`)
      return NextResponse.json({ ok: true, skipped: 'no_email' })
    }

    const supabase = createServiceClient()

    // 3. Buscar ou criar store
    let { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single()

    if (!store) {
      const { data: newStore, error: storeErr } = await supabase
        .from('stores')
        .insert({
          shop_domain: shopDomain,
          access_token: process.env.SHOPIFY_ACCESS_TOKEN || '',
          name: shopDomain,
        })
        .select('id')
        .single()

      if (storeErr) throw storeErr
      store = newStore
    }

    // 4. Buscar ou criar customer
    let { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('store_id', store.id)
      .eq('shopify_customer_id', customer.shopifyCustomerId)
      .maybeSingle()

    if (!existingCustomer) {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          store_id: store.id,
          shopify_customer_id: customer.shopifyCustomerId,
          name: customer.name,
          email: customer.email,
        })
        .select('id')
        .single()

      if (custErr) throw custErr
      existingCustomer = newCustomer
    }

    // 5. Gerar Tracking ID único
    let trackingId = generateTrackingId()
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('tracking_id', trackingId)
        .maybeSingle()
      if (!existing) break
      trackingId = generateTrackingId()
      attempts++
    }

    // 6. Criar pedido
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        store_id: store.id,
        customer_id: existingCustomer.id,
        shopify_order_id: shopifyOrderId,
        order_number: orderNumber,
        product_name: productName,
        shipping_address: shippingAddress,
        status: 'processing',
        tracking_id: trackingId,
      })
      .select('id, created_at')
      .single()

    if (orderErr) throw orderErr

    // 7. Criar tracking record
    const { data: trackingRecord, error: trackErr } = await supabase
      .from('tracking_records')
      .insert({
        order_id: newOrder.id,
        tracking_id: trackingId,
        current_day: 0,
        expires_at: getExpiresAt(newOrder.created_at, 120),
      })
      .select('id')
      .single()

    if (trackErr) throw trackErr

    // 8. Inserir primeiro evento (Dia 0)
    await supabase.from('tracking_events').insert({
      tracking_record_id: trackingRecord.id,
      day: 0,
      title: 'Order Confirmed',
      description: 'Your order has been received and confirmed.',
    })

    // 9. Enviar email de confirmação
    const emailResult = await sendOrderConfirmationEmail({
      to: customer.email,
      customerName: customer.name,
      orderNumber,
      productName,
      trackingId,
      shippingAddress,
    })

    // 10. Registrar email no log
    await supabase.from('email_logs').insert({
      order_id: newOrder.id,
      tracking_id: trackingId,
      email_to: customer.email,
      subject: `Seu pedido #${orderNumber} foi confirmado! Código: ${trackingId}`,
      status: emailResult.error ? 'failed' : 'sent',
    })

    console.log(`✅ Pedido #${orderNumber} processado — Tracking: ${trackingId}`)

    return NextResponse.json({
      ok: true,
      trackingId,
      orderNumber,
      emailSent: !emailResult.error,
    })
  } catch (err: any) {
    console.error('Erro no webhook:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
