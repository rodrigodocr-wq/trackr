import { NextRequest, NextResponse } from 'next/server'
import { sendTrackingUpdateEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email') || 'rodrigodocr@gmail.com'
  const day = parseInt(req.nextUrl.searchParams.get('day') || '5')

  const result = await sendTrackingUpdateEmail({
    to: email,
    customerName: 'John Smith',
    orderNumber: '1001',
    trackingId: 'TRK167879UK',
    updateTitle: 'Test Update',
    updateDescription: 'Test description',
    day,
  })

  return NextResponse.json({ ok: true, day, result })
}
