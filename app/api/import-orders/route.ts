import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateTrackingId, getExpiresAt } from '@/lib/tracking'

export const dynamic = 'force-dynamic'

const ORDERS = [
  { number: '1001', shopifyId: '6954150592747', name: 'Shelle Daly',      email: '',                             product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '8 Hawthorne Close, Congleton, CW12 4UF, England', created: '2026-05-30T09:25:37+00:00' },
  { number: '1002', shopifyId: '6955920031979', name: 'Alison Oczabruk',  email: 'a.oczabruk09@icloud.com',     product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '1 Blwckthorn Close, Calderdale, HX3 7WH, England', created: '2026-05-31T06:34:00+00:00' },
  { number: '1003', shopifyId: '6955928322283', name: 'Maria Agrela',     email: 'mariaagrela636@gmail.com',    product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '24 Snowdrop Close, Crawley, RH11 9EG, England',   created: '2026-05-31T06:45:48+00:00' },
  { number: '1004', shopifyId: '6955998118123', name: 'Jeff Bevan',       email: 'jeffbevan200200@gmail.com',   product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: "2 Ty'r Orsaf, Port Talbot, SA13 1JD, Wales",      created: '2026-05-31T08:20:58+00:00' },
  { number: '1005', shopifyId: '6956101959915', name: 'Mark Garnett',     email: 'markgarnett1066@gmail.com',   product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '54 Wedgewood Court, Caerphilly, CF83 1RD, Wales', created: '2026-05-31T10:39:31+00:00' },
  { number: '1006', shopifyId: '6956514705643', name: 'Rebecca Brealey',  email: 'brealey1997@gmail.com',       product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '49 The Homestead Bentley, Doncaster, DN5 0RT, England', created: '2026-05-31T16:08:06+00:00' },
  { number: '1007', shopifyId: '6956907299051', name: 'Michelle Harding', email: 'michelleharding771@yahoo.com',product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: '3 Brohaul, Water Street, Newcastle Emlyn, SA38 9BJ, Wales', created: '2026-05-31T19:55:02+00:00' },
  { number: '1009', shopifyId: '6957676331243', name: 'Philip Daley',     email: 'phil50daley@yahoo.co.uk',     product: 'Ninja StaySharp 14-Piece Stainless Knife Set', address: "17 St John's Court, Waterloo, Liverpool, L22 9RH, England", created: '2026-06-01T05:51:31+00:00' },
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = []

  // Buscar store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('shop_domain', process.env.SHOPIFY_SHOP_DOMAIN!)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  for (const o of ORDERS) {
    try {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('orders')
        .select('id, tracking_id')
        .eq('shopify_order_id', o.shopifyId)
        .maybeSingle()

      if (existing) {
        results.push({ order: o.number, status: 'skipped', trackingId: existing.tracking_id })
        continue
      }

      // Criar ou buscar customer
      let { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('store_id', store.id)
        .eq('email', o.email || `noemail_${o.shopifyId}@placeholder.com`)
        .maybeSingle()

      if (!customer) {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            store_id: store.id,
            shopify_customer_id: o.shopifyId,
            name: o.name,
            email: o.email || `noemail_${o.shopifyId}@placeholder.com`,
          })
          .select('id')
          .single()
        customer = newCustomer
      }

      // Gerar tracking ID único
      let trackingId = generateTrackingId()
      for (let i = 0; i < 5; i++) {
        const { data: ex } = await supabase.from('orders').select('id').eq('tracking_id', trackingId).maybeSingle()
        if (!ex) break
        trackingId = generateTrackingId()
      }

      // Criar pedido
      const { data: newOrder } = await supabase
        .from('orders')
        .insert({
          store_id: store.id,
          customer_id: customer!.id,
          shopify_order_id: o.shopifyId,
          order_number: o.number,
          product_name: o.product,
          shipping_address: o.address,
          status: 'processing',
          tracking_id: trackingId,
          created_at: o.created,
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
          expires_at: getExpiresAt(o.created, 120),
        })
        .select('id')
        .single()

      // Inserir evento inicial
      await supabase.from('tracking_events').insert({
        tracking_record_id: trackingRecord!.id,
        day: 0,
        title: 'Order Confirmed',
        description: 'Your order has been received and confirmed.',
      })

      results.push({ order: o.number, status: 'created', trackingId, email: o.email || 'no email' })
    } catch (err: any) {
      results.push({ order: o.number, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
