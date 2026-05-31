import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const envCheck = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    shopDomain: !!process.env.SHOPIFY_SHOP_DOMAIN,
    resendKey: !!process.env.RESEND_API_KEY,
    resendFromEmail: !!process.env.RESEND_FROM_EMAIL,
    resendFromName: !!process.env.RESEND_FROM_NAME,
    appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    cronSecret: !!process.env.CRON_SECRET,
    // partial values for debug (first 4 chars only)
    cronSecretPrefix: process.env.CRON_SECRET?.substring(0, 4) ?? "NOT_SET",
    supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) ?? "NOT_SET",
  }

  return NextResponse.json({ ok: true, env: envCheck })
}
