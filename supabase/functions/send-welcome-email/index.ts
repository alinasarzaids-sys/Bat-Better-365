import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const ADMIN_BANK = {
  bankName: 'HBL',
  accountTitle: 'SYED ALI NASAR',
  accountNumber: '50227900684903',
  iban: 'PK03HABB0050227900684903',
  branch: 'IBB Dehli Mercntl So',
  whatsapp: '+923001234567',
  email: 'billing@batbetter365.com',
};

const GROSS_PRICE_PER_PLAYER = 850;
const COACH_COMMISSION_PER_PLAYER = 300;
const NET_PAYABLE_PER_PLAYER = GROSS_PRICE_PER_PLAYER - COACH_COMMISSION_PER_PLAYER; // 550

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { academyName, ownerName, email, phone, playerCode, coachCode, adminCode, trialEndDate } = body;

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey || !email) {
      return new Response(JSON.stringify({ success: true, skipped: 'no resend key or email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">🏏 Bat Better 365</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Academy Management Platform</p>
    </div>

    <div style="padding:28px 24px;">
      <h2 style="color:#111827;margin:0 0 8px;font-size:22px;">Welcome, ${ownerName}! 🎉</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your academy <strong style="color:#111827;">${academyName}</strong> has been created. 
        Your <strong>30-day free trial</strong> starts now.
      </p>

      <div style="background:#f0fdf4;border-radius:12px;padding:18px;margin-bottom:24px;border:1px solid #bbf7d0;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#15803d;font-weight:700;text-transform:uppercase;">Trial Period Ends</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:#15803d;">${trialEndDate}</p>
      </div>

      <h3 style="color:#111827;margin:0 0 12px;font-size:16px;font-weight:800;">Your Academy Codes</h3>

      <div style="background:#fff1f2;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #fecdd3;">
        <p style="margin:0 0 4px;font-size:11px;color:#9f1239;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">🔒 Admin Code — Keep Private</p>
        <p style="margin:0;font-size:28px;font-weight:900;color:#be123c;letter-spacing:6px;">${adminCode}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9f1239;">Full access: coach + player portals</p>
      </div>

      <div style="background:#fefce8;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #fde68a;">
        <p style="margin:0 0 4px;font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">🎓 Coach Code</p>
        <p style="margin:0;font-size:28px;font-weight:900;color:#b45309;letter-spacing:6px;">${coachCode}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#92400e;">Share only with assistant coaches</p>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #bfdbfe;">
        <p style="margin:0 0 4px;font-size:11px;color:#1e40af;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">🏏 Player Code</p>
        <p style="margin:0;font-size:28px;font-weight:900;color:#1d4ed8;letter-spacing:6px;">${playerCode}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#1e40af;">Players need your approval to join after entering this code</p>
      </div>

      <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #e5e7eb;">
        <h4 style="margin:0 0 10px;color:#374151;font-size:14px;font-weight:800;">📋 Getting Started</h4>
        <ol style="margin:0;padding-left:18px;color:#6b7280;font-size:13px;line-height:1.8;">
          <li>Share the <strong>Player Code</strong> with your squad</li>
          <li>Players download Bat Better 365, sign up, and enter the code</li>
          <li>They appear in your <strong>Waiting Room</strong> — you approve or reject from the Coach Portal</li>
          <li>Approved players get full access to drills, AI coaching, and training logs</li>
        </ol>
      </div>

      <!-- Pricing & Commission -->
      <div style="background:#f0fdf4;border-radius:12px;padding:18px;margin-bottom:16px;border:1px solid #86efac;">
        <h4 style="margin:0 0 12px;color:#15803d;font-size:15px;font-weight:800;">💰 Pricing & Your Commission</h4>
        <table style="width:100%;font-size:14px;color:#374151;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;">Gross fee per player:</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;">PKR ${GROSS_PRICE_PER_PLAYER}/month</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#16a34a;font-weight:700;">Your commission per player:</td>
            <td style="padding:6px 0;text-align:right;font-weight:800;color:#16a34a;">+ PKR ${COACH_COMMISSION_PER_PLAYER}</td>
          </tr>
          <tr style="border-top:2px solid #bbf7d0;">
            <td style="padding:8px 0;font-weight:800;color:#1d4ed8;">Net to transfer to admin:</td>
            <td style="padding:8px 0;text-align:right;font-weight:900;color:#1d4ed8;font-size:16px;">PKR ${NET_PAYABLE_PER_PLAYER}/player</td>
          </tr>
        </table>
        <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">
          Example: 20 players → you collect PKR ${(GROSS_PRICE_PER_PLAYER * 20).toLocaleString()}, keep PKR ${(COACH_COMMISSION_PER_PLAYER * 20).toLocaleString()}, transfer PKR ${(NET_PAYABLE_PER_PLAYER * 20).toLocaleString()} to admin.
        </p>
      </div>

      <!-- Admin Bank Details -->
      <div style="background:#fefce8;border-radius:12px;padding:18px;border:1px solid #fde68a;">
        <h4 style="margin:0 0 12px;color:#92400e;font-size:14px;font-weight:800;">🏦 Admin Transfer Details (After Trial)</h4>
        <table style="font-size:14px;color:#374151;width:100%;background:#fff;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:700;width:130px;color:#92400e;">Bank</td><td style="padding:8px 12px;">${ADMIN_BANK.bankName}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:700;color:#92400e;">Account</td><td style="padding:8px 12px;font-weight:800;">${ADMIN_BANK.accountTitle}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:700;color:#92400e;">Number</td><td style="padding:8px 12px;font-family:monospace;font-weight:800;letter-spacing:1px;">${ADMIN_BANK.accountNumber}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:700;color:#92400e;">IBAN</td><td style="padding:8px 12px;font-family:monospace;color:#1d4ed8;font-weight:700;">${ADMIN_BANK.iban}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 12px;font-weight:700;color:#92400e;">Branch</td><td style="padding:8px 12px;">${ADMIN_BANK.branch}</td></tr>
        </table>
        <p style="margin:12px 0 0;font-size:13px;color:#92400e;">
          📱 WhatsApp: <strong>${ADMIN_BANK.whatsapp}</strong> · 📧 <strong>${ADMIN_BANK.email}</strong>
        </p>
      </div>
    </div>

    <div style="padding:20px 24px;background:#f9fafb;text-align:center;color:#9ca3af;font-size:12px;">
      <p style="margin:0;">Bat Better 365 · Academy Management Platform</p>
      <p style="margin:4px 0 0;">Registered: ${email}${phone ? ` · WhatsApp: ${phone}` : ''}</p>
    </div>
  </div>
</body>
</html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Bat Better 365 <welcome@batbetter365.com>',
        to: [email],
        subject: `Welcome to Bat Better 365! Academy codes for ${academyName}`,
        html,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
