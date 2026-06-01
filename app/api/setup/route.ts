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
    // Shopify token exchange para apps customizadas
    // POST /admin/oauth/access_token com grant_type=urn:ietf:params:oauth:grant-type:token-exchange
    const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        subject_token: accessToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      }).toString(),
    })

    const rawToken = await tokenRes.text()
    let tokenData: any
    try { tokenData = JSON.parse(rawToken) } catch { tokenData = { raw: rawToken.substring(0, 200) } }

    if (!tokenData.access_token) {
      return NextResponse.json({ 
        step: 'token_exchange_failed',
        status: tokenRes.status,
        tokenData,
      })
    }

    const shopToken = tokenData.access_token

    // Criar webhook com o token correto
    const mutation = `mutation {
      webhookSubscriptionCreate(topic: ORDERS_CREATE, webhookSubscription: {format: JSON, callbackUrl: "${callbackUrl}"}) {
        webhookSubscription { id topic callbackUrl }
        userErrors { field message }
      }
    }`

    const webhookRes = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': shopToken },
      body: JSON.stringify({ query: mutation }),
    })

    const webhookData = await webhookRes.json()
    const result = webhookData?.data?.webhookSubscriptionCreate

    return NextResponse.json({
      ok: true,
      shopToken,
      webhook: result?.webhookSubscription,
      errors: result?.userErrors,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
