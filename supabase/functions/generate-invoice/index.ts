import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── Admin receiving bank details (where academies transfer money TO) ──────────
const ADMIN_BANK = {
  bankName: 'HBL',
  accountTitle: 'SYED ALI NASAR',
  accountNumber: '50227900684903',
  iban: 'PK03HABB0050227900684903',
  branch: 'IBB Dehli Mercntl So',
  whatsapp: '+923001234567',
  email: 'billing@batbetter365.com',
};

// ── Pricing ───────────────────────────────────────────────────────────────────
const GROSS_PRICE_PER_PLAYER = 850;   // PKR — total charge to academy per player
const COACH_COMMISSION_PER_PLAYER = 300; // PKR — coach/academy earns this per player
const NET_PAYABLE_PER_PLAYER = GROSS_PRICE_PER_PLAYER - COACH_COMMISSION_PER_PLAYER; // = 550 PKR — net owed to admin

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { academy_id, triggered_by } = await req.json();
    if (!academy_id) return new Response(JSON.stringify({ error: 'academy_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 1. Fetch academy
    const { data: academy, error: aErr } = await supabase
      .from('academies')
      .select('*')
      .eq('id', academy_id)
      .single();
    if (aErr || !academy) return new Response(JSON.stringify({ error: 'Academy not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 2. Count APPROVED active players only (strict — excludes pending/rejected/removed)
    const { data: members, error: mErr } = await supabase
      .from('academy_members')
      .select('id, user_id, display_name, status, role')
      .eq('academy_id', academy_id)
      .eq('role', 'player')
      .eq('status', 'approved')
      .eq('is_active', true);

    if (mErr) return new Response(JSON.stringify({ error: mErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const playerCount = (members || []).length;
    const grossTotal = playerCount * GROSS_PRICE_PER_PLAYER;
    const commissionTotal = playerCount * COACH_COMMISSION_PER_PLAYER;
    const netPayable = playerCount * NET_PAYABLE_PER_PLAYER;
    const currency = academy.currency || 'PKR';

    // 3. Generate invoice number
    const { data: invNum } = await supabase.rpc('generate_invoice_number', { p_academy_id: academy_id });

    // 4. Determine billing period
    const periodStart = academy.next_billing_date || academy.trial_end_date || new Date().toISOString().split('T')[0];
    const periodEnd = new Date(new Date(periodStart).getTime() + 30 * 86400000).toISOString().split('T')[0];
    const dueDate = new Date(new Date(periodStart).getTime() + 7 * 86400000).toISOString().split('T')[0];
    const invoiceDate = new Date().toISOString().split('T')[0];

    // 5. Save invoice to DB (store NET payable amount)
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
        price_per_player: NET_PAYABLE_PER_PLAYER,
        total_amount: netPayable,
        currency,
        status: 'unpaid',
        sent_to_email: academy.owner_email || '',
      })
      .select()
      .single();

    if (iErr) return new Response(JSON.stringify({ error: iErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 6. Build player list HTML rows
    const playerListRows = (members || []).map((m: any, idx: number) =>
      `<tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;">${m.display_name || 'Player'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;">${currency} ${GROSS_PRICE_PER_PLAYER.toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a;font-weight:700;">− ${currency} ${COACH_COMMISSION_PER_PLAYER.toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;color:#1d4ed8;">${currency} ${NET_PAYABLE_PER_PLAYER.toLocaleString()}</td>
      </tr>`
    ).join('');

    // 7. Send email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && academy.owner_email) {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invNum}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">🏏 Bat Better 365</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Academy Management Platform</p>
    </div>

    <!-- Invoice Meta -->
    <div style="padding:24px;border-bottom:2px solid #f3f4f6;display:flex;justify-content:space-between;">
      <div>
        <h2 style="margin:0;font-size:22px;color:#111827;font-weight:900;">MONTHLY INVOICE</h2>
        <p style="margin:6px 0 0;font-family:monospace;font-size:15px;color:#6b7280;font-weight:700;">${invNum}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:700;">Invoice Date</p>
        <p style="margin:2px 0 8px;font-weight:800;color:#111827;">${invoiceDate}</p>
        <p style="margin:0;font-size:12px;color:#dc2626;text-transform:uppercase;font-weight:700;">Due Date</p>
        <p style="margin:2px 0 0;font-weight:800;color:#dc2626;">${dueDate}</p>
      </div>
    </div>

    <!-- Academy Info -->
    <div style="padding:20px 24px;background:#f9fafb;border-bottom:2px solid #e5e7eb;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Billed To</p>
      <p style="margin:0;font-size:18px;font-weight:900;color:#111827;">${academy.name}</p>
      ${academy.description ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${academy.description}</p>` : ''}
      <p style="margin:10px 0 0;color:#374151;font-size:14px;">📧 ${academy.owner_email}</p>
      ${academy.owner_phone ? `<p style="margin:3px 0 0;color:#374151;font-size:14px;">📱 ${academy.owner_phone}</p>` : ''}
    </div>

    <!-- Billing Period -->
    <div style="padding:14px 24px;background:#eff6ff;border-bottom:1px solid #dbeafe;">
      <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:700;">
        📅 Billing Period: ${periodStart} → ${periodEnd}
      </p>
    </div>

    <!-- Player Breakdown Table -->
    <div style="padding:24px;">
      <h3 style="margin:0 0 4px;font-size:16px;color:#111827;font-weight:800;">Player Breakdown</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;">Only approved, active players are billed. Pending, rejected, and removed players are excluded.</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#111827;">
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:#9ca3af;border-radius:0;">#</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:#fff;">Player Name</th>
            <th style="padding:10px 12px;text-align:right;font-weight:700;color:#fff;">Gross Fee</th>
            <th style="padding:10px 12px;text-align:right;font-weight:700;color:#86efac;">Your Commission</th>
            <th style="padding:10px 12px;text-align:right;font-weight:700;color:#93c5fd;">Net Payable</th>
          </tr>
        </thead>
        <tbody>
          ${playerListRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#6b7280;">No approved players this cycle</td></tr>'}
        </tbody>
        <!-- Totals -->
        <tfoot>
          <tr style="background:#f3f4f6;border-top:2px solid #e5e7eb;">
            <td colspan="2" style="padding:12px;font-weight:900;font-size:14px;color:#111827;">TOTALS (${playerCount} players)</td>
            <td style="padding:12px;text-align:right;font-weight:700;color:#374151;">${currency} ${grossTotal.toLocaleString()}</td>
            <td style="padding:12px;text-align:right;font-weight:700;color:#16a34a;">− ${currency} ${commissionTotal.toLocaleString()}</td>
            <td style="padding:12px;text-align:right;font-weight:900;color:#1d4ed8;font-size:15px;">${currency} ${netPayable.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Commission Explainer -->
    <div style="margin:0 24px 24px;background:#f0fdf4;border-radius:12px;padding:18px;border:1px solid #bbf7d0;">
      <h4 style="margin:0 0 12px;color:#15803d;font-size:14px;font-weight:800;">💰 Your Earnings This Month</h4>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:12px;border:1px solid #d1fae5;text-align:center;">
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">Gross Collected</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#111827;">${currency} ${grossTotal.toLocaleString()}</p>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:12px;border:1px solid #bbf7d0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;font-weight:700;">Your Commission</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#16a34a;">+ ${currency} ${commissionTotal.toLocaleString()}</p>
          <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">${currency} ${COACH_COMMISSION_PER_PLAYER}/player</p>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border-radius:8px;padding:12px;border:1px solid #bfdbfe;text-align:center;">
          <p style="margin:0;font-size:11px;color:#1d4ed8;text-transform:uppercase;font-weight:700;">Transfer to Admin</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:900;color:#1d4ed8;">${currency} ${netPayable.toLocaleString()}</p>
          <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">${currency} ${NET_PAYABLE_PER_PLAYER}/player</p>
        </div>
      </div>
    </div>

    <!-- Payment Instructions -->
    <div style="padding:24px;background:#fefce8;border-top:2px solid #fde68a;">
      <h3 style="margin:0 0 6px;color:#92400e;font-size:16px;font-weight:800;">💳 Transfer ${currency} ${netPayable.toLocaleString()} to Admin</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#78350f;">Please transfer the <strong>Net Payable amount</strong> to the following HBL account. You retain your ${currency} ${commissionTotal.toLocaleString()} commission.</p>
      <table style="font-size:14px;color:#374151;width:100%;background:#fff;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:800;color:#92400e;width:150px;">Bank Name</td><td style="padding:10px 14px;font-weight:700;">${ADMIN_BANK.bankName}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:800;color:#92400e;">Account Title</td><td style="padding:10px 14px;font-weight:700;">${ADMIN_BANK.accountTitle}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:800;color:#92400e;">Account Number</td><td style="padding:10px 14px;font-family:monospace;font-weight:800;font-size:15px;letter-spacing:1px;">${ADMIN_BANK.accountNumber}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:800;color:#92400e;">IBAN</td><td style="padding:10px 14px;font-family:monospace;font-weight:800;color:#1d4ed8;">${ADMIN_BANK.iban}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:800;color:#92400e;">Branch</td><td style="padding:10px 14px;">${ADMIN_BANK.branch}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:800;color:#92400e;">Reference</td><td style="padding:10px 14px;font-weight:700;">${invNum} — ${academy.name}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#92400e;">
        After transferring, send the bank receipt to confirm payment:<br>
        📱 WhatsApp: <strong>${ADMIN_BANK.whatsapp}</strong><br>
        📧 Email: <strong>${ADMIN_BANK.email}</strong>
      </p>
    </div>

    <!-- Warning -->
    <div style="padding:16px 24px;background:#fff1f2;border-top:2px solid #fecdd3;">
      <p style="margin:0;font-size:13px;color:#be123c;font-weight:600;">
        ⚠️ Payment due by <strong>${dueDate}</strong>. Failure to pay will result in your academy and all players being locked from the app. Contact us immediately if you need assistance.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 24px;text-align:center;color:#9ca3af;font-size:12px;background:#f9fafb;">
      <p style="margin:0;">Bat Better 365 · Academy Management Platform</p>
      <p style="margin:4px 0 0;">Invoice ${invNum} · Generated ${invoiceDate}</p>
    </div>
  </div>
</body>
</html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Bat Better 365 Billing <billing@batbetter365.com>',
          to: [academy.owner_email],
          subject: `Invoice ${invNum} — Net ${currency} ${netPayable.toLocaleString()} due by ${dueDate} | ${academy.name}`,
          html: emailHtml,
        }),
      });

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
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
