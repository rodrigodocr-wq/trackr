import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'

export const dynamic = 'force-dynamic'

const SHOP_DOMAIN = 'wfejcz-45.myshopify.com'

const ORDERS = [
  { number: '1001', shopifyId: '7228036546818', name: 'Margaret Salisbury', email: 'salisburym28@gmail.com',       product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '78 Church Street, Old Town, Eastbourne, BN21 1QJ, England', created: '2026-05-31T12:59:21+00:00' },
  { number: '1002', shopifyId: '7228390670594', name: 'Mark Simmons',       email: 'msimmons.500@btinternet.com', product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '9 The Cedars, Reigate, RH2 0RS, England',                  created: '2026-05-31T16:47:51+00:00' },
  { number: '1003', shopifyId: '7229883187458', name: 'Arthur Webster',     email: 'webster666@btinternet.com',   product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '14 Bruce Hiuse, Hazelhead, Aberdeen, AB15 8EQ, Scotland',  created: '2026-06-01T09:11:44+00:00' },
  { number: '1004', shopifyId: '7229913727234', name: 'Derek Rodgers',      email: 'derek.rodgers99@outlook.com', product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '34 Highfields Avenue, Dublin Road, Newry, BT35 8UG, Northern Ireland', created: '2026-06-01T09:56:02+00:00' },
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = []

  let { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('shop_domain', SHOP_DOMAIN)
    .maybeSingle()

  if (!store) {
    const { data: newStore } = await supabase
      .from('stores')
      .insert({ shop_domain: SHOP_DOMAIN, access_token: process.env.SHOPIFY_ACCESS_TOKEN_2 || '', name: 'Reino Unido HTML' })
      .select('id')
      .single()
    store = newStore
  }

  for (const o of ORDERS) {
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
        order_id: newOrder!.id, tracking_id: trackingId, current_day: 0, expires_at: getExpiresAt(o.created, 120),
      }).select('id').single()

      await supabase.from('tracking_events').insert({ tracking_record_id: tr!.id, day: 0, title: 'Order Confirmed', description: 'Your order has been received and confirmed.' })

      results.push({ order: o.number, status: 'created', trackingId, email: o.email })
    } catch (err: any) {
      results.push({ order: o.number, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
