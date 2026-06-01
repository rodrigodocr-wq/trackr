import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN!
  const clientId = process.env.SHOPIFY_CLIENT_ID!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const scopes = 'read_orders,write_orders,read_customers,read_products'
  const redirectUri = `${appUrl}/api/shopify/callback`
  const state = process.env.CRON_SECRET!

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  return NextResponse.redirect(installUrl)
}
