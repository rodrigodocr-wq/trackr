import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const callbackUrl = `${appUrl}/api/webhooks/shopify`

  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          topic
          callbackUrl
          format
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  const variables = {
    topic: 'ORDERS_CREATE',
    webhookSubscription: {
      callbackUrl,
      format: 'JSON',
    },
  }

  // Tentar todos os formatos de auth que a Shopify suporta
  const authHeaders = [
    { 'X-Shopify-Access-Token': accessToken },
    { 'Shopify-Token': accessToken },
    { 'Authorization': `Bearer ${accessToken}` },
  ]

  const results: any[] = []

  for (const headers of authHeaders) {
    const res = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query: mutation, variables }),
    })
    const data = await res.json()
    results.push({ headers: Object.keys(headers)[0], status: res.status, data })
    if (res.status === 200) break
  }

  return NextResponse.json({ ok: true, results })
}
