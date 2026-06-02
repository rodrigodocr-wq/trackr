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
