import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const BANK_DETAILS = {
  bankName: 'Meezan Bank',
  accountTitle: 'Bat Better Technologies',
  iban: 'PK00MEZN0001234567890123',
  whatsapp: '+923001234567',
};

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
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">🏏 Bat Better 365</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Academy Management Platform</p>
    </div>

    <div style="padding:28px 24px;">
      <h2 style="color:#111827;margin:0 0 8px;">Welcome, ${ownerName}!</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;">
        Your academy <strong style="color:#111827;">${academyName}</strong> has been successfully created. 
        Your <strong>30-day free trial</strong> is now active.
      </p>

      <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #bbf7d0;">
        <p style="margin:0 0 4px;font-size:12px;color:#15803d;font-weight:700;text-transform:uppercase;">Trial Ends</p>
        <p style="margin:0;font-size:20px;font-weight:900;color:#15803d;">${trialEndDate}</p>
      </div>

      <h3 style="color:#111827;margin:20px 0 12px;">Your Academy Codes</h3>
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Keep these safe. Share only the relevant code with each group.</p>

      <div style="background:#fff1f2;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #fecdd3;">
        <p style="margin:0 0 4px;font-size:11px;color:#9f1239;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">🔒 Admin Code (Keep Private)</p>
        <p style="margin:0;font-size:28px;font-weight:900;color:#be123c;letter-spacing:6px;">${adminCode}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#9f1239;">Full access — coach + player portals combined</p>
      </div>

      <div style="background:#fefce8;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #fde68a;">
        <p style="margin:0 0 4px;font-size:11px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">🎓 Coach Code</p>
        <p style="margin:0;font-size:28px;font-weight:900;color:#b45309;letter-spacing:6px;">${coachCode}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#92400e;">Share only with assistant coaches</p>
      </div>

      <div style="background:#eff6ff;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #bfdbfe;">
        <p style="margin:0 0 4px;font-size:11px;color:#1e40af;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">🏏 Player Code</p>
        <p style="margin:0;font-size:28px;font-weight:900;color:#1d4ed8;letter-spacing:6px;">${playerCode}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#1e40af;">Share with players — they need your approval to join</p>
      </div>

      <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #e5e7eb;">
        <h4 style="margin:0 0 8px;color:#374151;">📋 How It Works</h4>
        <ol style="margin:0;padding-left:20px;color:#6b7280;font-size:13px;line-height:1.7;">
          <li>Share the <strong>Player Code</strong> with your squad</li>
          <li>Players download the app, create an account, and enter the code</li>
          <li>They appear in your <strong>Waiting Room</strong> — you approve or reject</li>
          <li>Approved players get full access to drills, AI coaching, and training logs</li>
        </ol>
      </div>

      <div style="background:#fff7ed;border-radius:12px;padding:16px;border:1px solid #fed7aa;">
        <h4 style="margin:0 0 8px;color:#9a3412;">💳 Billing After Trial</h4>
        <p style="margin:0;color:#7c3d12;font-size:13px;line-height:1.6;">
          After the trial, you will receive an invoice via email based on the number of approved players 
          (<strong>PKR 550/player/month</strong>). Payment is via bank transfer:
        </p>
        <table style="margin-top:12px;font-size:13px;color:#374151;width:100%;">
          <tr><td style="padding:3px 0;font-weight:700;width:130px;">Bank:</td><td>${BANK_DETAILS.bankName}</td></tr>
          <tr><td style="padding:3px 0;font-weight:700;">Account:</td><td>${BANK_DETAILS.accountTitle}</td></tr>
          <tr><td style="padding:3px 0;font-weight:700;">IBAN:</td><td style="font-family:monospace;">${BANK_DETAILS.iban}</td></tr>
          <tr><td style="padding:3px 0;font-weight:700;">WhatsApp:</td><td>${BANK_DETAILS.whatsapp}</td></tr>
        </table>
      </div>
    </div>

    <div style="padding:20px 24px;background:#f9fafb;text-align:center;color:#9ca3af;font-size:12px;">
      <p style="margin:0;">Bat Better 365 · Academy Management Platform</p>
      <p style="margin:4px 0 0;">Registered email: ${email} · WhatsApp: ${phone}</p>
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
        subject: `Welcome to Bat Better 365! Your academy codes for ${academyName}`,
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
