import crypto from 'crypto'

export function verifyShopifyWebhook(rawBody: Buffer, hmacHeader: string, shopDomain?: string): boolean {
  // Suporta múltiplas lojas — cada loja tem o seu secret
  const secrets: string[] = [
    process.env.SHOPIFY_WEBHOOK_SECRET || '',
    process.env.SHOPIFY_WEBHOOK_SECRET_2 || '',
    process.env.SHOPIFY_WEBHOOK_SECRET_3 || '',
    process.env.SHOPIFY_WEBHOOK_SECRET_4 || '',
  ].filter(Boolean)

  for (const secret of secrets) {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64')
    try {
      if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader))) {
        return true
      }
    } catch {}
  }

  return false
}

export function extractOrderData(order: any) {
  const lineItems = order.line_items || []
  const productName = lineItems.map((i: any) => i.name).join(', ') || 'Product'

  const addr = order.shipping_address || order.billing_address || {}
  const shipping = [addr.address1, addr.city, addr.province, addr.country]
    .filter(Boolean)
    .join(', ')

  return {
    shopifyOrderId: String(order.id),
    orderNumber: String(order.order_number || order.name || order.id),
    productName,
    shippingAddress: shipping,
    customer: {
      shopifyCustomerId: String(order.customer?.id || ''),
      name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Customer',
      email: order.customer?.email || order.email || '',
    },
  }
}

export async function fulfillShopifyOrder(params: {
  shopDomain: string
  shopifyOrderId: string
  trackingId: string
  accessToken: string
}) {
  const { shopDomain, shopifyOrderId, trackingId, accessToken } = params

  try {
    // 1. Buscar fulfillment orders
    const foRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillment_orders.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    )

    if (!foRes.ok) return { ok: false, error: `fulfillment_orders: ${foRes.status}` }

    const foData = await foRes.json()
    const fulfillmentOrders = foData.fulfillment_orders || []
    const openFO = fulfillmentOrders.filter((fo: any) => fo.status === 'open')

    if (openFO.length === 0) return { ok: false, error: 'No open fulfillment orders' }

    // 2. Criar fulfillment com tracking
    const fulfillRes = await fetch(
      `https://${shopDomain}/admin/api/2024-01/fulfillments.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          fulfillment: {
            line_items_by_fulfillment_order: openFO.map((fo: any) => ({
              fulfillment_order_id: fo.id,
            })),
            tracking_info: {
              number: trackingId,
              url: `${process.env.NEXT_PUBLIC_APP_URL}/track/${trackingId}`,
            },
            notify_customer: false,
          },
        }),
      }
    )

    const fulfillData = await fulfillRes.json()

    if (!fulfillRes.ok) return { ok: false, error: fulfillData.errors || fulfillRes.status }

    return { ok: true, fulfillment: fulfillData.fulfillment }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
