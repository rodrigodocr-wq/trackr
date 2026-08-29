import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendOrderEmailParams {
  to: string
  customerName: string
  orderNumber: string
  productName: string
  trackingId: string
  shippingAddress: string
  storeName?: string
}

function emailBase(content: string) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#18181b;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:2px;">NINJA</h1>
            <p style="color:#a1a1aa;margin:6px 0 0;font-size:13px;">Order Tracking</p>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="background:#f4f4f5;padding:24px 40px;text-align:center;border-top:1px solid #e4e4e7;">
            <p style="color:#a1a1aa;font-size:12px;margin:0;">
              You are receiving this email because you placed an order with us.<br>
              If you have any questions, please reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function trackButton(trackingUrl: string, label = 'Track my order') {
  return `<table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <a href="${trackingUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.5px;">
        ${label}
      </a>
    </td></tr>
  </table>
  <p style="color:#71717a;font-size:13px;margin:16px 0 0;text-align:center;">
    Or visit: <a href="${trackingUrl}" style="color:#18181b;">${trackingUrl}</a>
  </p>`
}

// ─── EMAIL 1: Confirmação (Dia 3) ───────────────────────────────────────────
export async function sendOrderConfirmationEmail(params: SendOrderEmailParams) {
  const { to, customerName, orderNumber, productName, trackingId, shippingAddress, storeName } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const trackingUrl = `${appUrl}/track/${trackingId}`

  const content = `
    <tr><td style="padding:40px;">
      <h2 style="color:#18181b;margin:0 0 8px;font-size:20px;">Hi ${customerName}!</h2>
      <p style="color:#52525b;margin:0 0 24px;font-size:15px;line-height:1.6;">
        Thank you for your order. We are carefully preparing your item and will keep you updated every step of the way.
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
      ${trackButton(trackingUrl)}
    </td></tr>`

  const html = emailBase(content)

  return resend.emails.send({
    from: `${storeName || process.env.RESEND_FROM_NAME || 'Support'} <${process.env.RESEND_FROM_EMAIL!}>`,
    to,
    subject: `Your order #${orderNumber} is confirmed — Tracking: ${trackingId}`,
    html,
  })
}

// ─── EMAILS DE UPDATE (Dias 5, 12, 20, 30, 50, 70, 90, 115) ─────────────────
function getUpdateContent(day: number, customerName: string, orderNumber: string, trackingId: string, trackingUrl: string) {
  // Dia 5 — A ser enviado
  if (day === 5) {
    return {
      subject: `Your order #${orderNumber} is on its way!`,
      headline: `Great news, ${customerName}!`,
      body: `Your order is now being prepared for dispatch. Our team is carefully packing your item and it will be shipped very soon. You will receive further updates as your order progresses.`,
      buttonLabel: 'Track my order',
    }
  }

  // Dia 12 — Despachado
  if (day === 12) {
    return {
      subject: `Your order #${orderNumber} has been dispatched`,
      headline: `Your order is on its way, ${customerName}!`,
      body: `We are pleased to let you know that your order has been dispatched and is now heading your way. Please allow a few days for your item to arrive. You can track the progress at any time using your tracking code below.`,
      buttonLabel: 'Track my order',
    }
  }

  // Dia 20 — Em trânsito
  if (day === 20) {
    return {
      subject: `Your order #${orderNumber} is in transit`,
      headline: `Your order is in transit, ${customerName}!`,
      body: `Your order is currently in transit and making its way to you. Everything is progressing as expected. Keep an eye on your tracking page for real-time updates on your delivery.`,
      buttonLabel: 'Track my order',
    }
  }

  // Dia 30 — Chegando ao UK
  if (day === 30) {
    return {
      subject: `Your order #${orderNumber} is arriving in the UK`,
      headline: `Almost there, ${customerName}!`,
      body: `Your order has arrived in the United Kingdom and is now going through the final stages before delivery. We are working hard to get it to you as soon as possible.`,
      buttonLabel: 'Track my order',
    }
  }

  // Dia 50 — Progresso
  if (day === 50) {
    return {
      subject: `Update on your order #${orderNumber}`,
      headline: `Order update, ${customerName}`,
      body: `Your order is progressing through our delivery network and is getting closer to you every day. Thank you for your patience — we will keep you updated.`,
      buttonLabel: 'Check tracking',
    }
  }

  // Dia 70 — Distribuição local
  if (day === 70) {
    return {
      subject: `Your order #${orderNumber} is in local distribution`,
      headline: `Nearly there, ${customerName}!`,
      body: `Your order has entered local distribution and is very close to being delivered. You can track the latest status using your tracking code below.`,
      buttonLabel: 'Track my order',
    }
  }

  // Dia 90 — Entrega iminente
  if (day === 90) {
    return {
      subject: `Your order #${orderNumber} — delivery update`,
      headline: `Your delivery is imminent, ${customerName}!`,
      body: `Your order is in the final stage of delivery and should be with you very soon. Please ensure someone is available to receive it at your address.`,
      buttonLabel: 'Track my order',
    }
  }

  // Dia 115 — Final
  if (day === 115) {
    return {
      subject: `Final update on your order #${orderNumber}`,
      headline: `Final delivery update, ${customerName}`,
      body: `This is your final tracking update. Your order is in its last stretch and delivery is expected imminently. If you have any concerns about your delivery, please do not hesitate to contact us.`,
      buttonLabel: 'View tracking',
    }
  }

  // Fallback
  return {
    subject: `Update on your order #${orderNumber}`,
    headline: `Order update, ${customerName}`,
    body: `We have a new update on your order. Please check your tracking page for the latest information.`,
    buttonLabel: 'Track my order',
  }
}

export async function sendTrackingUpdateEmail(params: {
  to: string
  customerName: string
  orderNumber: string
  trackingId: string
  updateTitle: string
  updateDescription: string
  day?: number
}) {
  const { to, customerName, orderNumber, trackingId, day } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const trackingUrl = `${appUrl}/track/${trackingId}`

  const { subject, headline, body, buttonLabel } = getUpdateContent(
    day || 0, customerName, orderNumber, trackingId, trackingUrl
  )

  const content = `
    <tr><td style="padding:40px;">
      <h2 style="color:#18181b;margin:0 0 16px;font-size:20px;">${headline}</h2>
      <p style="color:#52525b;font-size:15px;margin:0 0 24px;line-height:1.7;">${body}</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #18181b;">
        <span style="color:#71717a;font-size:12px;">Tracking code</span><br>
        <strong style="color:#18181b;font-size:18px;letter-spacing:2px;">${trackingId}</strong>
      </div>
      ${trackButton(trackingUrl, buttonLabel)}
    </td></tr>`

  const html = emailBase(content)

  return resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME || 'Support'} <${process.env.RESEND_FROM_EMAIL!}>`,
    to,
    subject,
    html,
  })
}
