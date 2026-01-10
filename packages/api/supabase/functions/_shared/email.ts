/**
 * Resend Email Client
 *
 * Transactional email sending for billing notifications.
 * Uses Resend API with custom domain atlaspay.cc
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_DOMAIN = 'atlaspay.cc';
const FROM_EMAIL = `Atlas <billing@${EMAIL_DOMAIN}>`;
const FROM_EMAIL_NOREPLY = `Atlas <noreply@${EMAIL_DOMAIN}>`;

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email via Resend API
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY not configured');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || FROM_EMAIL,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: options.tags,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Email] Send failed:', error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log('[Email] Sent successfully:', result.id);
    return { success: true, id: result.id };
  } catch (err) {
    console.error('[Email] Send error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Format currency amount for display
 */
function formatAmount(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================
// Email Templates
// ============================================

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: #111; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; }
  .logo { text-align: center; margin-bottom: 24px; }
  .logo-text { font-size: 24px; font-weight: bold; color: white; }
  h1 { color: white; font-size: 24px; margin: 0 0 16px 0; }
  p { color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
  .button { display: inline-block; background: linear-gradient(to right, #8b5cf6, #d946ef); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  .amount { font-size: 32px; font-weight: bold; color: white; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  .badge-success { background: rgba(34,197,94,0.1); color: #22c55e; }
  .badge-warning { background: rgba(234,179,8,0.1); color: #eab308; }
  .badge-error { background: rgba(239,68,68,0.1); color: #ef4444; }
  .divider { border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0; }
  .footer { text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px; }
  .line-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .line-item:last-child { border-bottom: none; }
  .line-item-desc { color: white; }
  .line-item-amount { color: #9ca3af; }
  .total-row { display: flex; justify-content: space-between; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 8px; }
  .total-label { color: white; font-weight: 600; }
  .total-amount { color: white; font-size: 20px; font-weight: bold; }
`;

function wrapTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="logo-text">Atlas</span>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>Powered by Atlas Payment Platform</p>
      <p>If you have questions, contact support at support@atlaspay.cc</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================
// Billing Email Functions
// ============================================

interface InvoiceEmailData {
  customerEmail: string;
  customerName?: string;
  invoiceNumber: string;
  invoiceId: string;
  amountDue: number;
  currency: string;
  dueDate?: string;
  lineItems: Array<{ description: string; amount: number }>;
  payUrl: string;
  merchantName: string;
}

/**
 * Send invoice email with pay link
 */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<SendEmailResult> {
  const lineItemsHtml = data.lineItems.map(item => `
    <div class="line-item">
      <span class="line-item-desc">${item.description}</span>
      <span class="line-item-amount">${formatAmount(item.amount, data.currency)}</span>
    </div>
  `).join('');

  const content = `
    <h1>Invoice from ${data.merchantName}</h1>
    <p>Hi${data.customerName ? ` ${data.customerName}` : ''},</p>
    <p>You have a new invoice that's ready for payment.</p>

    <div class="divider"></div>

    <p style="color: #6b7280; font-size: 14px;">Invoice ${data.invoiceNumber}</p>
    <div class="amount">${formatAmount(data.amountDue, data.currency)}</div>
    ${data.dueDate ? `<p style="font-size: 14px;">Due ${formatDate(data.dueDate)}</p>` : ''}

    <div class="divider"></div>

    ${lineItemsHtml}

    <div class="total-row">
      <span class="total-label">Amount Due</span>
      <span class="total-amount">${formatAmount(data.amountDue, data.currency)}</span>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a href="${data.payUrl}" class="button">Pay Invoice</a>
    </div>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Invoice ${data.invoiceNumber} from ${data.merchantName} - ${formatAmount(data.amountDue, data.currency)}`,
    html: wrapTemplate(content),
    tags: [
      { name: 'type', value: 'invoice' },
      { name: 'invoice_id', value: data.invoiceId },
    ],
  });
}

interface PaymentReceiptData {
  customerEmail: string;
  customerName?: string;
  amount: number;
  currency: string;
  paymentDate: string;
  invoiceNumber?: string;
  merchantName: string;
  last4?: string;
  brand?: string;
}

/**
 * Send payment receipt/confirmation
 */
export async function sendPaymentReceiptEmail(data: PaymentReceiptData): Promise<SendEmailResult> {
  const content = `
    <div style="text-align: center;">
      <div class="badge badge-success" style="margin-bottom: 16px;">Payment Successful</div>
      <h1>Thank you for your payment!</h1>
    </div>

    <p>Hi${data.customerName ? ` ${data.customerName}` : ''},</p>
    <p>We've received your payment of <strong>${formatAmount(data.amount, data.currency)}</strong>.</p>

    <div class="divider"></div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #6b7280;">Amount</span>
        <span style="color: white; font-weight: 600;">${formatAmount(data.amount, data.currency)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #6b7280;">Date</span>
        <span style="color: white;">${formatDate(data.paymentDate)}</span>
      </div>
      ${data.invoiceNumber ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #6b7280;">Invoice</span>
        <span style="color: white;">${data.invoiceNumber}</span>
      </div>
      ` : ''}
      ${data.last4 ? `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #6b7280;">Payment Method</span>
        <span style="color: white;">${data.brand || 'Card'} •••• ${data.last4}</span>
      </div>
      ` : ''}
    </div>

    <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
      This receipt confirms your payment to ${data.merchantName}.
    </p>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Receipt for your ${formatAmount(data.amount, data.currency)} payment to ${data.merchantName}`,
    html: wrapTemplate(content),
    tags: [{ name: 'type', value: 'receipt' }],
  });
}

interface PaymentFailedData {
  customerEmail: string;
  customerName?: string;
  amount: number;
  currency: string;
  reason?: string;
  retryDate?: string;
  updatePaymentUrl?: string;
  merchantName: string;
}

/**
 * Send payment failed notification
 */
export async function sendPaymentFailedEmail(data: PaymentFailedData): Promise<SendEmailResult> {
  const content = `
    <div style="text-align: center;">
      <div class="badge badge-error" style="margin-bottom: 16px;">Payment Failed</div>
      <h1>We couldn't process your payment</h1>
    </div>

    <p>Hi${data.customerName ? ` ${data.customerName}` : ''},</p>
    <p>We tried to charge <strong>${formatAmount(data.amount, data.currency)}</strong> to your payment method, but the payment was declined.</p>

    ${data.reason ? `
    <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; padding: 16px; margin: 20px 0;">
      <p style="color: #ef4444; margin: 0;"><strong>Reason:</strong> ${data.reason}</p>
    </div>
    ` : ''}

    ${data.retryDate ? `
    <p>We'll automatically retry this payment on <strong>${formatDate(data.retryDate)}</strong>.</p>
    ` : ''}

    <p>To avoid service interruption, please update your payment method:</p>

    ${data.updatePaymentUrl ? `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${data.updatePaymentUrl}" class="button">Update Payment Method</a>
    </div>
    ` : ''}
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Action required: Payment failed for ${data.merchantName}`,
    html: wrapTemplate(content),
    tags: [{ name: 'type', value: 'payment_failed' }],
  });
}

interface TrialEndingData {
  customerEmail: string;
  customerName?: string;
  productName: string;
  trialEndDate: string;
  amount: number;
  currency: string;
  interval: string;
  merchantName: string;
  portalUrl?: string;
}

/**
 * Send trial ending reminder (3 days before)
 */
export async function sendTrialEndingEmail(data: TrialEndingData): Promise<SendEmailResult> {
  const content = `
    <div style="text-align: center;">
      <div class="badge badge-warning" style="margin-bottom: 16px;">Trial Ending Soon</div>
      <h1>Your trial ends in 3 days</h1>
    </div>

    <p>Hi${data.customerName ? ` ${data.customerName}` : ''},</p>
    <p>Your free trial of <strong>${data.productName}</strong> ends on <strong>${formatDate(data.trialEndDate)}</strong>.</p>

    <div class="divider"></div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
      <p style="color: #6b7280; margin: 0 0 8px 0;">After your trial, you'll be charged:</p>
      <div class="amount">${formatAmount(data.amount, data.currency)}<span style="font-size: 16px; color: #6b7280;">/${data.interval}</span></div>
    </div>

    <p style="margin-top: 24px;">No action needed if you want to continue. We'll automatically start your subscription when the trial ends.</p>

    ${data.portalUrl ? `
    <p>Want to cancel or make changes?</p>
    <div style="text-align: center; margin-top: 16px;">
      <a href="${data.portalUrl}" class="button">Manage Subscription</a>
    </div>
    ` : ''}
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Your ${data.productName} trial ends in 3 days`,
    html: wrapTemplate(content),
    tags: [{ name: 'type', value: 'trial_ending' }],
  });
}

interface SubscriptionCanceledData {
  customerEmail: string;
  customerName?: string;
  productName: string;
  endDate: string;
  merchantName: string;
  resubscribeUrl?: string;
}

/**
 * Send subscription canceled confirmation
 */
export async function sendSubscriptionCanceledEmail(data: SubscriptionCanceledData): Promise<SendEmailResult> {
  const content = `
    <h1>Your subscription has been canceled</h1>

    <p>Hi${data.customerName ? ` ${data.customerName}` : ''},</p>
    <p>Your <strong>${data.productName}</strong> subscription has been canceled as requested.</p>

    <div class="divider"></div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
      <p style="color: #6b7280; margin: 0 0 8px 0;">You'll continue to have access until:</p>
      <p style="color: white; font-size: 18px; font-weight: 600; margin: 0;">${formatDate(data.endDate)}</p>
    </div>

    <p style="margin-top: 24px;">We're sorry to see you go! If you change your mind, you can resubscribe at any time.</p>

    ${data.resubscribeUrl ? `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${data.resubscribeUrl}" class="button">Resubscribe</a>
    </div>
    ` : ''}
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Your ${data.productName} subscription has been canceled`,
    html: wrapTemplate(content),
    tags: [{ name: 'type', value: 'subscription_canceled' }],
  });
}

interface SubscriptionCreatedData {
  customerEmail: string;
  customerName?: string;
  productName: string;
  amount: number;
  currency: string;
  interval: string;
  nextBillingDate: string;
  trialEndDate?: string;
  merchantName: string;
  portalUrl?: string;
}

/**
 * Send subscription created/welcome email
 */
export async function sendSubscriptionCreatedEmail(data: SubscriptionCreatedData): Promise<SendEmailResult> {
  const content = `
    <div style="text-align: center;">
      <div class="badge badge-success" style="margin-bottom: 16px;">Subscription Active</div>
      <h1>Welcome to ${data.productName}!</h1>
    </div>

    <p>Hi${data.customerName ? ` ${data.customerName}` : ''},</p>
    <p>Thank you for subscribing to <strong>${data.productName}</strong>. Your subscription is now active.</p>

    <div class="divider"></div>

    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
      ${data.trialEndDate ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #6b7280;">Trial ends</span>
        <span style="color: white;">${formatDate(data.trialEndDate)}</span>
      </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="color: #6b7280;">Amount</span>
        <span style="color: white; font-weight: 600;">${formatAmount(data.amount, data.currency)}/${data.interval}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #6b7280;">${data.trialEndDate ? 'First billing date' : 'Next billing date'}</span>
        <span style="color: white;">${formatDate(data.nextBillingDate)}</span>
      </div>
    </div>

    ${data.portalUrl ? `
    <p style="margin-top: 24px;">Manage your subscription anytime:</p>
    <div style="text-align: center; margin-top: 16px;">
      <a href="${data.portalUrl}" class="button">Manage Subscription</a>
    </div>
    ` : ''}
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Welcome to ${data.productName}!`,
    html: wrapTemplate(content),
    tags: [{ name: 'type', value: 'subscription_created' }],
  });
}
