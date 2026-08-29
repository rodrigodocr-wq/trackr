import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrderDay } from '@/lib/tracking'
import { sendTrackingUpdateEmail, sendOrderConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Proteção por secret key (configurar no Vercel Cron)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Busca todos os tracking records ativos (não expirados)
  const { data: records, error } = await supabase
    .from('tracking_records')
    .select(`
      id,
      tracking_id,
      current_day,
      expires_at,
      orders (
        id,
        order_number,
        product_name,
        status,
        customers ( name, email ),
        stores ( id )
      )
    `)
    .gt('expires_at', new Date().toISOString())

  if (error) {
    console.error('Erro ao buscar tracking records:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let processed = 0
  let emailsSent = 0

  for (const record of records || []) {
    const order = record.orders as any
    if (!order) continue

    // Buscar settings da store para pegar os milestones
    const { data: settings } = await supabase
      .from('settings')
      .select('timeline_milestones')
      .eq('store_id', order.stores?.id)
      .single()

    const milestones: Array<{ day: number; title: string; description: string }> =
      settings?.timeline_milestones || []

    // Calcular dia atual do pedido
    const { data: orderData } = await supabase
      .from('orders')
      .select('created_at')
      .eq('id', order.id)
      .single()

    if (!orderData) continue

    const currentDay = getOrderDay(orderData.created_at)

    // Busca eventos já disparados para este record
    const { data: existingEvents } = await supabase
      .from('tracking_events')
      .select('day')
      .eq('tracking_record_id', record.id)

    const triggeredDays = new Set((existingEvents || []).map((e: any) => e.day))

    // Dispara milestones que ainda não foram inseridos e já chegaram no dia
    for (const milestone of milestones) {
      if (milestone.day <= currentDay && !triggeredDays.has(milestone.day)) {
        // Inserir evento
        await supabase.from('tracking_events').insert({
          tracking_record_id: record.id,
          day: milestone.day,
          title: milestone.title,
          description: milestone.description,
        })

        // Enviar emails em dias importantes
        const updateDays = [5, 12, 20, 30, 50, 70, 90, 115]
        const customer = order.customers as any

        if (customer?.email) {
          let emailResult: any = null

          // Dia 3: email de confirmação com código TRK (primeiro email)
          if (milestone.day === 3) {
            // Buscar dados completos do pedido
            const { data: fullOrder } = await supabase
              .from('orders')
              .select('product_name, shipping_address')
              .eq('id', order.id)
              .single()

            emailResult = await sendOrderConfirmationEmail({
              to: customer.email,
              customerName: customer.name,
              orderNumber: order.order_number,
              productName: fullOrder?.product_name || '',
              trackingId: record.tracking_id,
              shippingAddress: fullOrder?.shipping_address || '',
            })

            await supabase.from('email_logs').insert({
              order_id: order.id,
              tracking_id: record.tracking_id,
              email_to: customer.email,
              subject: `Your order #${order.order_number} is confirmed — Tracking: ${record.tracking_id}`,
              status: emailResult?.error ? 'failed' : 'sent',
            })

            if (!emailResult?.error) emailsSent++

          // Outros dias: email de update
          } else if (updateDays.includes(milestone.day)) {
            emailResult = await sendTrackingUpdateEmail({
              to: customer.email,
              customerName: customer.name,
              orderNumber: order.order_number,
              trackingId: record.tracking_id,
              updateTitle: milestone.title,
              updateDescription: milestone.description,
              day: milestone.day,
            })

            await supabase.from('email_logs').insert({
              order_id: order.id,
              tracking_id: record.tracking_id,
              email_to: customer.email,
              subject: `Order #${order.order_number} update — ${milestone.title}`,
              status: emailResult?.error ? 'failed' : 'sent',
            })

            if (!emailResult?.error) emailsSent++
          }
        }
      }
    }

    // Atualizar current_day no tracking record
    await supabase
      .from('tracking_records')
      .update({ current_day: currentDay, last_updated: new Date().toISOString() })
      .eq('id', record.id)

    processed++
  }

  console.log(`✅ Cron executado: ${processed} pedidos | ${emailsSent} emails`)

  return NextResponse.json({
    ok: true,
    processed,
    emailsSent,
    timestamp: new Date().toISOString(),
  })
}
