import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'

export const dynamic = 'force-dynamic'

const SHOP_DOMAIN = 'kgvimi-7m.myshopify.com'

const ORDERS = [
  { number: '1001', shopifyId: '7794687181133', name: 'belle zan',                          email: 'lojazanbelle@gmail.com',            product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-07-09T12:00:00+00:00' },
  { number: '1003', shopifyId: '7913991078221', name: 'Mark Guyett',                         email: 'markguyett@yahoo.com',              product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T07:32:00+00:00' },
  { number: '1004', shopifyId: '7914011525453', name: 'Lorraine Phillips',                   email: 'lainep1989@gmail.com',              product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T07:49:00+00:00' },
  { number: '1005', shopifyId: '7914256335181', name: 'Lorraine Gamblin',                    email: 'lorsg58@gmail.com',                 product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T10:04:00+00:00' },
  { number: '1006', shopifyId: '7916506939725', name: 'Jason Jones',                         email: 'lordjasonjones@hotmail.com',        product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T19:59:00+00:00' },
  { number: '1007', shopifyId: '7916985549133', name: 'Colin Mcqueen',                       email: 'colinmcqueen59@gmail.com',          product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T23:04:00+00:00' },
  { number: '1008', shopifyId: '7917029196109', name: 'Aurela Domi',                         email: 'ladihoxha2222@gmail.com',           product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T23:45:00+00:00' },
  { number: '1009', shopifyId: '7917033685325', name: 'Tracy Reynolds',                      email: 'reynoldstracy448@gmail.com',        product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-25T23:51:00+00:00' },
  { number: '1010', shopifyId: '7917108330829', name: 'Hentry Kalappurakkudi Poulose',       email: 'hentryka74@gmail.com',              product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-26T02:15:00+00:00' },
  { number: '1011', shopifyId: '7918802075981', name: 'Lorraine Phillips',                   email: 'lainep1989@gmail.com',              product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-26T12:00:00+00:00' },
  { number: '1012', shopifyId: '7925806432589', name: 'Jennifer Cole',                       email: 'clarkej68@sky.com',                 product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-28T12:20:00+00:00' },
  { number: '1013', shopifyId: '7925929443661', name: 'Elizabeth Irwin',                     email: 'melizabethirwin1956@outlook.com',   product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-28T12:57:00+00:00' },
  { number: '1014', shopifyId: '7926281634125', name: 'Mark Morrison',                       email: 'katemorrison17@yahoo.co.uk',        product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-28T15:02:00+00:00' },
  { number: '1015', shopifyId: '7926337732941', name: 'Caroline Drew',                       email: 'kazdrew57@gmail.com',               product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-28T15:26:00+00:00' },
  { number: '1017', shopifyId: '7927107846477', name: 'Sarah Whittingham',                   email: 'sarahwhittingham@mail.com',         product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: 'GB', created: '2026-08-28T22:05:00+00:00' },
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = []

  let { data: store } = await supabase.from('stores').select('id').eq('shop_domain', SHOP_DOMAIN).maybeSingle()
  if (!store) {
    const { data: ns } = await supabase.from('stores').insert({ shop_domain: SHOP_DOMAIN, access_token: '', name: 'NINJA' }).select('id').single()
    store = ns
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
      }).select('id').single()

      const { data: tr } = await supabase.from('tracking_records').insert({
        order_id: newOrder!.id, tracking_id: trackingId, current_day: 0,
        expires_at: getExpiresAt(o.created, 120),
      }).select('id').single()

      await supabase.from('tracking_events').insert({
        tracking_record_id: tr!.id, day: 0,
        title: 'Order Confirmed', description: 'Your order has been received and confirmed.',
      })

      results.push({ order: o.number, status: 'created', trackingId, email: o.email })
    } catch (err: any) {
      results.push({ order: o.number, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ok: true, total: ORDERS.length, results })
}
