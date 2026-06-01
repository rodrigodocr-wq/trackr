import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'
import ordersData from '../../../public/br-orders-data.json'

export const dynamic = 'force-dynamic'

const SHOP_DOMAIN = 'kzuf1z-kh.myshopify.com'
const BATCH_SIZE = 50
const ORDERS = ordersData as Array<{
  number: string; shopifyId: string; name: string; email: string;
  product: string; address: string; created: string;
}>

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchNum = parseInt(req.nextUrl.searchParams.get('batch') || '0')
  const start = batchNum * BATCH_SIZE
  const batch = ORDERS.slice(start, start + BATCH_SIZE)

  if (batch.length === 0) {
    return NextResponse.json({ ok: true, done: true, message: 'All batches processed' })
  }

  const supabase = createServiceClient()
  const results = []

  let { data: store } = await supabase
    .from('stores').select('id').eq('shop_domain', SHOP_DOMAIN).maybeSingle()

  if (!store) {
    const { data: ns } = await supabase
      .from('stores')
      .insert({ shop_domain: SHOP_DOMAIN, access_token: '', name: 'Zenvita BR' })
      .select('id').single()
    store = ns
  }

  for (const o of batch) {
    try {
      const { data: existing } = await supabase.from('orders').select('id, tracking_id').eq('shopify_order_id', o.shopifyId).maybeSingle()
      if (existing) { results.push({ order: o.number, status: 'skipped', trackingId: existing.tracking_id }); continue }

      let { data: customer } = await supabase.from('customers').select('id').eq('store_id', store!.id).eq('email', o.email).maybeSingle()
      if (!customer) {
        const { data: nc } = await supabase.from('customers').insert({ store_id: store!.id, shopify_customer_id: o.shopifyId, name: o.name, email: o.email }).select('id').single()
        customer = nc
      }

      let trackingId = generateTrackingId()
      for (let i = 0; i < 5; i++) {
        const { data: ex } = await supabase.from('orders').select('id').eq('tracking_id', trackingId).maybeSingle()
        if (!ex) break
        trackingId = generateTrackingId()
      }

      const { data: newOrder } = await supabase.from('orders').insert({
        store_id: store!.id, customer_id: customer!.id, shopify_order_id: o.shopifyId,
        order_number: o.number, product_name: o.product, shipping_address: o.address,
        status: 'processing', tracking_id: trackingId, created_at: o.created,
      }).select('id, created_at').single()

      const { data: tr } = await supabase.from('tracking_records').insert({
        order_id: newOrder!.id, tracking_id: trackingId, current_day: 0,
        expires_at: getExpiresAt(o.created, 120),
      }).select('id').single()

      await supabase.from('tracking_events').insert({
        tracking_record_id: tr!.id, day: 0,
        title: 'Pedido Confirmado', description: 'Seu pedido foi recebido e confirmado.',
      })

      results.push({ order: o.number, status: 'created', trackingId })
    } catch (err: any) {
      results.push({ order: o.number, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({
    ok: true, batch: batchNum, processed: batch.length,
    total: ORDERS.length, remaining: Math.max(0, ORDERS.length - (start + BATCH_SIZE)),
    nextBatch: start + BATCH_SIZE < ORDERS.length ? batchNum + 1 : null,
    results,
  })
}
