import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── Admin receiving bank details ──────────────────────────────────────────────
const ADMIN_BANK = {
  bankName: 'HBL',
  accountTitle: 'SYED ALI NASAR',
  accountNumber: '50227900684903',
  iban: 'PK03HABB0050227900684903',
  branch: 'IBB Dehli Mercntl So',
};

const GROSS_PER_PLAYER = 850;
const COMMISSION_PER_PLAYER = 300;
const NET_PER_PLAYER = GROSS_PER_PLAYER - COMMISSION_PER_PLAYER; // 550 PKR

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { academy_id, triggered_by } = await req.json();
    if (!academy_id) {
      return new Response(JSON.stringify({ error: 'academy_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch academy
    const { data: academy, error: aErr } = await supabase
      .from('academies')
      .select('*')
      .eq('id', academy_id)
      .single();

    if (aErr || !academy) {
      return new Response(JSON.stringify({ error: 'Academy not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Count APPROVED active PLAYERS only — coaches are FREE, never billed
    const { data: members, error: mErr } = await supabase
      .from('academy_members')
      .select('id, user_id, display_name, status, role')
      .eq('academy_id', academy_id)
      .eq('role', 'player')
      .eq('status', 'approved')
      .eq('is_active', true);

    if (mErr) {
      return new Response(JSON.stringify({ error: mErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const playerCount = (members || []).length;
    // Net amount = (850 - 300) * player_count = 550 * player_count
    const netPayable = NET_PER_PLAYER * playerCount;
    const grossTotal = GROSS_PER_PLAYER * playerCount;
    const commissionTotal = COMMISSION_PER_PLAYER * playerCount;
    const currency = academy.currency || 'PKR';

    // 3. Generate invoice number
    const { data: invNum } = await supabase.rpc('generate_invoice_number', { p_academy_id: academy_id });

    // 4. Determine billing period
    const periodStart = academy.next_billing_date || academy.trial_end_date || new Date().toISOString().split('T')[0];
    const periodEnd = new Date(new Date(periodStart).getTime() + 30 * 86400000).toISOString().split('T')[0];
    const dueDate = new Date(new Date(periodStart).getTime() + 7 * 86400000).toISOString().split('T')[0];
    const invoiceDate = new Date().toISOString().split('T')[0];

    // 5. Save invoice to DB
    const { data: invoice, error: iErr } = await supabase
      .from('billing_invoices')
      .insert({
        academy_id,
        invoice_number: invNum || `INV-${Date.now()}`,
        invoice_date: invoiceDate,
        due_date: dueDate,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        player_count: playerCount,
        price_per_player: NET_PER_PLAYER,
        total_amount: netPayable,
        currency,
        status: 'unpaid',
        sent_to_email: academy.owner_email || '',
      })
      .select()
      .single();

    if (iErr) {
      return new Response(JSON.stringify({ error: iErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Send email via Resend using exact template
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const coachName = academy.name || 'Coach';

    if (resendKey && academy.owner_email) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bat Better 365 — Invoice ${invNum}</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:900;">🏏 Bat Better 365</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Academy Management Platform</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 24px;">
      <p style="font-size:16px;color:#111827;margin:0 0 20px;">
        Hi <strong>${coachName}</strong>,
      </p>
      <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 24px;">
        Your current Bat Better subscription cycle will expire in 5 days. To ensure your players do not lose access to their training portal and AI analytics, please settle the invoice below.
      </p>

      <!-- Billing Breakdown -->
      <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #bbf7d0;">
        <h3 style="margin:0 0 14px;color:#15803d;font-size:16px;font-weight:800;">📊 Billing Breakdown</h3>
        <table style="width:100%;font-size:15px;color:#374151;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;">Approved Players:</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;">${playerCount}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;">Standard Rate:</td>
            <td style="padding:6px 0;text-align:right;">${playerCount} x ${GROSS_PER_PLAYER} ${currency}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#16a34a;font-weight:700;">Coach Commission:</td>
            <td style="padding:6px 0;text-align:right;color:#16a34a;font-weight:700;">- ${playerCount} x ${COMMISSION_PER_PLAYER} ${currency} (Your cut!)</td>
          </tr>
          <tr style="border-top:2px solid #86efac;">
            <td style="padding:12px 0 4px;font-size:17px;font-weight:900;color:#111827;">💰 Total Amount Due:</td>
            <td style="padding:12px 0 4px;text-align:right;font-size:22px;font-weight:900;color:#1d4ed8;">${netPayable.toLocaleString()} ${currency}</td>
          </tr>
        </table>
      </div>

      <!-- Payment Instructions -->
      <div style="background:#fefce8;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #fde68a;">
        <h3 style="margin:0 0 14px;color:#92400e;font-size:16px;font-weight:800;">🏦 Payment Instructions</h3>
        <p style="font-size:14px;color:#78350f;margin:0 0 14px;line-height:1.6;">
          To renew your academy for the next 30 days, please transfer the Total Amount Due to the following account:
        </p>
        <table style="width:100%;font-size:14px;background:#fff;border-radius:10px;overflow:hidden;border-collapse:collapse;">
          <tr style="background:#fef9c3;">
            <td style="padding:10px 14px;font-weight:800;color:#92400e;width:140px;">Bank Name</td>
            <td style="padding:10px 14px;font-weight:700;color:#111827;">${ADMIN_BANK.bankName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:800;color:#92400e;">Account Title</td>
            <td style="padding:10px 14px;font-weight:700;color:#111827;">${ADMIN_BANK.accountTitle}</td>
          </tr>
          <tr style="background:#fef9c3;">
            <td style="padding:10px 14px;font-weight:800;color:#92400e;">Account Number</td>
            <td style="padding:10px 14px;font-family:monospace;font-weight:900;font-size:15px;letter-spacing:1px;color:#111827;">${ADMIN_BANK.accountNumber}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:800;color:#92400e;">IBAN</td>
            <td style="padding:10px 14px;font-family:monospace;font-weight:800;color:#1d4ed8;">${ADMIN_BANK.iban}</td>
          </tr>
          <tr style="background:#fef9c3;">
            <td style="padding:10px 14px;font-weight:800;color:#92400e;">Branch</td>
            <td style="padding:10px 14px;color:#374151;">${ADMIN_BANK.branch}</td>
          </tr>
        </table>
      </div>

      <!-- Next Steps -->
      <div style="background:#eff6ff;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #bfdbfe;">
        <h3 style="margin:0 0 12px;color:#1e40af;font-size:15px;font-weight:800;">Next Steps:</h3>
        <p style="font-size:14px;color:#1e40af;line-height:1.7;margin:0;">
          Once you have made the transfer, please reply directly to this email with a screenshot of the receipt. Our admin team will verify the payment and instantly unlock your roster for the next 30 days!
        </p>
      </div>

      <p style="font-size:15px;color:#374151;margin:0;">Keep up the great work in the nets,</p>
      <p style="font-size:15px;font-weight:700;color:#15803d;margin:6px 0 0;">The Bat Better Team 🏏</p>
    </div>

    <!-- Warning bar -->
    <div style="padding:14px 24px;background:#fff1f2;border-top:2px solid #fecdd3;">
      <p style="margin:0;font-size:13px;color:#be123c;font-weight:600;">
        ⚠️ Payment due by <strong>${dueDate}</strong>. Failure to pay will result in your academy and all players being locked from the app.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:18px 24px;text-align:center;color:#9ca3af;font-size:12px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;">Bat Better 365 · Academy Management Platform</p>
      <p style="margin:4px 0 0;">Invoice ${invNum} · Generated ${invoiceDate}</p>
    </div>
  </div>
</body>
</html>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Bat Better 365 Billing <billing@batbetter365.com>',
          to: [academy.owner_email],
          subject: `Invoice ${invNum} — ${netPayable.toLocaleString()} ${currency} due by ${dueDate} | ${academy.name}`,
          html: emailHtml,
        }),
      });

      console.log('Resend response status:', emailRes.status);
      await supabase.from('billing_invoices').update({ sent_to_email: academy.owner_email }).eq('id', invoice.id);
    }

    return new Response(JSON.stringify({
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        player_count: playerCount,
        gross_total: grossTotal,
        commission_total: commissionTotal,
        net_payable: netPayable,
        currency,
        due_date: dueDate,
        total_amount: netPayable,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('generate-invoice error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
