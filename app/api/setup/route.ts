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

  try {
    // 1. Listar webhooks existentes
    const listRes = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    })
    const { webhooks } = await listRes.json()

    // 2. Deletar webhooks antigos apontando para nossa URL
    for (const wh of webhooks || []) {
      if (wh.address?.includes('trackr')) {
        await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks/${wh.id}.json`, {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': accessToken }
        })
      }
    }

    // 3. Criar webhook correto
    const createRes = await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhook: {
          topic: 'orders/create',
          address: `${appUrl}/api/webhooks/shopify`,
          format: 'json'
        }
      })
    })

    const result = await createRes.json()

    return NextResponse.json({
      ok: true,
      webhook: result.webhook,
      errors: result.errors
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
