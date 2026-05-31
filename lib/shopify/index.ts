import crypto from 'crypto'

export function verifyShopifyWebhook(rawBody: Buffer, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET!
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader))
  } catch {
    return false
  }
}

export function extractOrderData(order: any) {
  const lineItems = order.line_items || []
  const productName = lineItems.map((i: any) => i.name).join(', ') || 'Produto'

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
      name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Cliente',
      email: order.customer?.email || order.email || '',
    },
  }
}
