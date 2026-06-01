import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'
import { getLocale, translations } from '@/lib/i18n'
import { sendOrderConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Debug: checar variáveis
  const envCheck = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    shopDomain: !!process.env.SHOPIFY_SHOP_DOMAIN,
    resendKey: !!process.env.RESEND_API_KEY,
    appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    cronSecret: !!process.env.CRON_SECRET,
  }
  console.log('ENV CHECK:', JSON.stringify(envCheck))

  const supabase = createServiceClient()

  // Dados de teste
  const testOrder = {
    shopDomain: req.nextUrl.searchParams.get('shop') || process.env.SHOPIFY_SHOP_DOMAIN!,
    shopifyOrderId: 'TEST-' + Date.now(),
    orderNumber: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
    productName: 'Anti-Snoring Mouthguard — Premium',
    shippingAddress: 'London, United Kingdom',
    customer: {
      shopifyCustomerId: 'TEST-CUSTOMER-001',
      name: 'Test Customer',
      email: req.nextUrl.searchParams.get('email') || 'rodrigodocr@gmail.com',
    }
  }

  // Buscar ou criar store
  let { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('shop_domain', testOrder.shopDomain)
    .single()

  if (!store) {
    const { data: newStore } = await supabase
      .from('stores')
      .insert({ shop_domain: testOrder.shopDomain, access_token: 'test', name: 'Wellvita Site' })
      .select('id').single()
    store = newStore
  }

  // Criar customer
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('store_id', store!.id)
    .eq('shopify_customer_id', testOrder.customer.shopifyCustomerId)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({
        store_id: store!.id,
        shopify_customer_id: testOrder.customer.shopifyCustomerId,
        name: testOrder.customer.name,
        email: testOrder.customer.email,
      })
      .select('id').single()
    customer = newCustomer
  }

  // Gerar Tracking ID único
  let trackingId = generateTrackingId()

  // Criar pedido
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      store_id: store!.id,
      customer_id: customer!.id,
      shopify_order_id: testOrder.shopifyOrderId,
      order_number: testOrder.orderNumber,
      product_name: testOrder.productName,
      shipping_address: testOrder.shippingAddress,
      status: 'processing',
      tracking_id: trackingId,
    })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Criar tracking record
  const { data: trackingRecord } = await supabase
    .from('tracking_records')
    .insert({
      order_id: order.id,
      tracking_id: trackingId,
      current_day: 0,
      expires_at: getExpiresAt(order.created_at, 120),
    })
    .select('id').single()

  // Inserir evento inicial no idioma correcto
  const locale = getLocale(testOrder.shopDomain)
  const firstMilestone = translations[locale].milestones[0]
  await supabase.from('tracking_events').insert({
    tracking_record_id: trackingRecord!.id,
    day: 0,
    title: firstMilestone.title,
    description: firstMilestone.description,
  })

  // Enviar email
  const emailResult = await sendOrderConfirmationEmail({
    to: testOrder.customer.email,
    customerName: testOrder.customer.name,
    orderNumber: testOrder.orderNumber,
    productName: testOrder.productName,
    trackingId,
    shippingAddress: testOrder.shippingAddress,
  })

  // Log do email
  await supabase.from('email_logs').insert({
    order_id: order.id,
    tracking_id: trackingId,
    email_to: testOrder.customer.email,
    subject: `Your order #${testOrder.orderNumber} is confirmed — Tracking: ${trackingId}`,
    status: emailResult.error ? 'failed' : 'sent',
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  return NextResponse.json({
      ok: true,
      trackingId,
      orderNumber: testOrder.orderNumber,
      emailSent: !emailResult.error,
      emailError: emailResult.error,
      trackingUrl: `${appUrl}/track/${trackingId}`,
      adminUrl: `${appUrl}/admin`,
    })
  } catch (err: any) {
    console.error('TEST ORDER ERROR:', err)
    return NextResponse.json({
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
    }, { status: 500 })
  }
}
