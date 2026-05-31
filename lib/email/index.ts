import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendOrderEmailParams {
  to: string
  customerName: string
  orderNumber: string
  productName: string
  trackingId: string
  shippingAddress: string
}

export async function sendOrderConfirmationEmail(params: SendOrderEmailParams) {
  const { to, customerName, orderNumber, productName, trackingId, shippingAddress } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const trackingUrl = `${appUrl}/track/${trackingId}`

  const html = `
<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#18181b;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:1px;">TRACKR</h1>
            <p style="color:#a1a1aa;margin:6px 0 0;font-size:13px;">Order Tracking System</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#18181b;margin:0 0 8px;font-size:20px;">Hi ${customerName}!</h2>
            <p style="color:#52525b;margin:0 0 24px;font-size:15px;line-height:1.6;">
              Thank you for your order. We are preparing your item with care and will keep you updated every step of the way.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px;">
              <tr><td style="padding:6px 0;">
                <span style="color:#71717a;font-size:13px;">Order number</span><br>
                <strong style="color:#18181b;font-size:15px;">#${orderNumber}</strong>
              </td></tr>
              <tr><td style="border-top:1px solid #e4e4e7;padding:12px 0 6px;">
                <span style="color:#71717a;font-size:13px;">Product</span><br>
                <strong style="color:#18181b;font-size:15px;">${productName}</strong>
              </td></tr>
              <tr><td style="border-top:1px solid #e4e4e7;padding:12px 0 6px;">
                <span style="color:#71717a;font-size:13px;">Delivery address</span><br>
                <strong style="color:#18181b;font-size:15px;">${shippingAddress}</strong>
              </td></tr>
              <tr><td style="border-top:1px solid #e4e4e7;padding:12px 0 6px;">
                <span style="color:#71717a;font-size:13px;">Your tracking code</span><br>
                <strong style="color:#18181b;font-size:20px;letter-spacing:2px;">${trackingId}</strong>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${trackingUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
                  Track my order
                </a>
              </td></tr>
            </table>
            <p style="color:#71717a;font-size:13px;margin:24px 0 0;text-align:center;">
              Or visit: <a href="${trackingUrl}" style="color:#18181b;">${trackingUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:24px 40px;text-align:center;border-top:1px solid #e4e4e7;">
            <p style="color:#a1a1aa;font-size:12px;margin:0;">
              You are receiving this email because you placed an order with our store.<br>
              If you have any questions, please reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const result = await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME || 'Support'} <${process.env.RESEND_FROM_EMAIL!}>`,
    to,
    subject: `Your order #${orderNumber} is confirmed — Tracking: ${trackingId}`,
    html,
  })

  return result
}

export async function sendTrackingUpdateEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  trackingId: string
  updateTitle: string
  updateDescription: string
}) {
  const { to, customerName, orderNumber, trackingId, updateTitle, updateDescription } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const trackingUrl = `${appUrl}/track/${trackingId}`

  const html = `
<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#18181b;padding:28px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:20px;">TRACKR</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#18181b;margin:0 0 8px;font-size:18px;">Update on your order #${orderNumber}</h2>
            <p style="color:#52525b;font-size:15px;margin:0 0 24px;">Hi ${customerName}, we have a new update for you.</p>
            <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin-bottom:24px;border-left:4px solid #18181b;">
              <strong style="color:#18181b;font-size:16px;">${updateTitle}</strong>
              <p style="color:#52525b;margin:8px 0 0;font-size:14px;">${updateDescription}</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${trackingUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                  View full tracking history
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f5;padding:20px 40px;text-align:center;border-top:1px solid #e4e4e7;">
            <p style="color:#a1a1aa;font-size:12px;margin:0;">Tracking code: <strong>${trackingId}</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME || 'Support'} <${process.env.RESEND_FROM_EMAIL!}>`,
    to,
    subject: `Order #${orderNumber} update — ${updateTitle}`,
    html,
  })
}
