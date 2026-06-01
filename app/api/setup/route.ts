import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN!
  const clientId = process.env.SHOPIFY_CLIENT_ID || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  // Tentar com X-Shopify-Access-Token primeiro
  // Se falhar, tentar Basic auth com client_id:token
  const headers1: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  }

  const basicAuth = clientId
    ? 'Basic ' + Buffer.from(`${clientId}:${accessToken}`).toString('base64')
    : null

  const headers2: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(basicAuth ? { 'Authorization': basicAuth } : {}),
  }

  try {
    // 1. Listar webhooks existentes
    let listRes = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
      headers: headers1
    })

    if (listRes.status === 401 && basicAuth) {
      listRes = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
        headers: headers2
      })
    }

    const listData = await listRes.json()
    const webhooks = listData.webhooks || []

    // 2. Deletar webhooks antigos do Trackr
    for (const wh of webhooks) {
      if (wh.address?.includes('trackr')) {
        await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks/${wh.id}.json`, {
          method: 'DELETE',
          headers: listRes.status < 400 ? headers1 : headers2
        })
      }
    }

    // 3. Criar webhook
    let createRes = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: headers1,
      body: JSON.stringify({
        webhook: {
          topic: 'orders/create',
          address: `${appUrl}/api/webhooks/shopify`,
          format: 'json'
        }
      })
    })

    if (createRes.status === 401 && basicAuth) {
      createRes = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: headers2,
        body: JSON.stringify({
          webhook: {
            topic: 'orders/create',
            address: `${appUrl}/api/webhooks/shopify`,
            format: 'json'
          }
        })
      })
    }

    const result = await createRes.json()

    return NextResponse.json({
      ok: true,
      authUsed: createRes.status < 400 ? 'token' : 'basic',
      statusCode: createRes.status,
      webhook: result.webhook,
      errors: result.errors,
      existingWebhooks: webhooks.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
