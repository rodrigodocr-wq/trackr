import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const shop = searchParams.get('shop')

  if (state !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 401 })
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID!
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!

  // Trocar code por access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    })
  })

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token

  if (!accessToken) {
    return NextResponse.json({ error: 'Failed to get token', details: tokenData }, { status: 400 })
  }

  // Mostrar o token para o admin copiar para o Vercel
  return NextResponse.json({
    ok: true,
    message: 'Copy this token to SHOPIFY_ACCESS_TOKEN in Vercel env vars',
    access_token: accessToken,
    shop,
  })
}
