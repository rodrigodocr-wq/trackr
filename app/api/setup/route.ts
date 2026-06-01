import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN!
  const clientId = process.env.SHOPIFY_CLIENT_ID!
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const callbackUrl = `${appUrl}/api/webhooks/shopify`

  try {
    // Step 1: Token exchange — trocar atkn_ por online access token via client_credentials
    const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return NextResponse.json({ 
        error: 'Token exchange failed', 
        tokenStatus: tokenRes.status,
        tokenData 
      }, { status: 400 })
    }

    const shopToken = tokenData.access_token

    // Step 2: Criar webhook com o token correto
    const mutation = `
      mutation {
        webhookSubscriptionCreate(
          topic: ORDERS_CREATE
          webhookSubscription: {
            format: JSON
            callbackUrl: "${callbackUrl}"
          }
        ) {
          webhookSubscription { id topic callbackUrl }
          userErrors { field message }
        }
      }
    `

    const webhookRes = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopToken,
      },
      body: JSON.stringify({ query: mutation }),
    })

    const webhookData = await webhookRes.json()
    const result = webhookData?.data?.webhookSubscriptionCreate

    return NextResponse.json({
      ok: true,
      generatedToken: shopToken,
      webhook: result?.webhookSubscription,
      errors: result?.userErrors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
