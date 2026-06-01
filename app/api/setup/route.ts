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

  try {
    // Usar GraphQL Admin API com token de automação
    const mutation = `
      mutation {
        webhookSubscriptionCreate(
          topic: ORDERS_CREATE
          webhookSubscription: {
            format: JSON
            callbackUrl: "${callbackUrl}"
          }
        ) {
          webhookSubscription {
            id
            topic
            callbackUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const res = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: mutation }),
    })

    const data = await res.json()
    const result = data?.data?.webhookSubscriptionCreate

    return NextResponse.json({
      ok: true,
      status: res.status,
      webhook: result?.webhookSubscription,
      errors: result?.userErrors,
      raw: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
