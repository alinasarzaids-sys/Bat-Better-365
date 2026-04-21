import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Bank transfer details — update these with real details
const BANK_DETAILS = {
  bankName: 'Meezan Bank',
  accountTitle: 'Bat Better Technologies',
  iban: 'PK00MEZN0001234567890123',
  whatsapp: '+923001234567',
  email: 'billing@batbetter365.com',
};

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
    const pricePerPlayer = academy.price_per_player || 550;
    const totalAmount = playerCount * pricePerPlayer;
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
        price_per_player: pricePerPlayer,
        total_amount: totalAmount,
        currency,
        status: 'unpaid',
        sent_to_email: academy.owner_email || '',
      })
      .select()
      .single();

    if (iErr) return new Response(JSON.stringify({ error: iErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 6. Build player list HTML
    const playerListRows = (members || []).map((m: any, idx: number) =>
      `<tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${m.display_name || 'Player'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${currency} ${pricePerPlayer.toLocaleString()}</td>
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
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">🏏 Bat Better 365</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Academy Management Platform</p>
    </div>

    <!-- Invoice Header -->
    <div style="padding:24px;border-bottom:2px solid #f3f4f6;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h2 style="margin:0;font-size:20px;color:#111827;">TAX INVOICE</h2>
          <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">${invNum}</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0;font-size:12px;color:#6b7280;">Invoice Date</p>
          <p style="margin:2px 0 0;font-weight:700;color:#111827;">${invoiceDate}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Due Date</p>
          <p style="margin:2px 0 0;font-weight:700;color:#dc2626;">${dueDate}</p>
        </div>
      </div>
    </div>

    <!-- Academy Details -->
    <div style="padding:24px;background:#f9fafb;border-bottom:2px solid #e5e7eb;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:700;">Billed To</p>
      <p style="margin:0;font-size:18px;font-weight:900;color:#111827;">${academy.name}</p>
      ${academy.description ? `<p style="margin:4px 0 0;color:#6b7280;font-size:14px;">${academy.description}</p>` : ''}
      <p style="margin:8px 0 0;color:#374151;font-size:14px;">📧 ${academy.owner_email}</p>
      ${academy.owner_phone ? `<p style="margin:2px 0 0;color:#374151;font-size:14px;">📱 ${academy.owner_phone}</p>` : ''}
    </div>

    <!-- Billing Period -->
    <div style="padding:16px 24px;background:#eff6ff;border-bottom:1px solid #dbeafe;">
      <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:700;">
        📅 Billing Period: ${periodStart} → ${periodEnd}
      </p>
    </div>

    <!-- Player List -->
    <div style="padding:24px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#111827;">Approved Players (${playerCount})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb;">#</th>
            <th style="padding:10px 12px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb;">Player Name</th>
            <th style="padding:10px 12px;text-align:right;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb;">Monthly Fee</th>
          </tr>
        </thead>
        <tbody>
          ${playerListRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#6b7280;">No approved players</td></tr>'}
        </tbody>
      </table>

      <!-- Total -->
      <div style="background:#111827;border-radius:12px;padding:20px;margin-top:16px;text-align:right;">
        <p style="margin:0;color:#9ca3af;font-size:13px;">${playerCount} players × ${currency} ${pricePerPlayer.toLocaleString()}/player</p>
        <p style="margin:8px 0 0;color:#fff;font-size:28px;font-weight:900;">${currency} ${totalAmount.toLocaleString()}</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">Total Amount Due</p>
      </div>
    </div>

    <!-- Payment Instructions -->
    <div style="padding:24px;background:#fefce8;border-top:2px solid #fde68a;">
      <h3 style="margin:0 0 12px;color:#92400e;font-size:15px;">💳 How to Pay (Bank Transfer)</h3>
      <table style="font-size:14px;color:#374151;width:100%;">
        <tr><td style="padding:4px 0;font-weight:700;width:140px;">Bank Name:</td><td>${BANK_DETAILS.bankName}</td></tr>
        <tr><td style="padding:4px 0;font-weight:700;">Account Title:</td><td>${BANK_DETAILS.accountTitle}</td></tr>
        <tr><td style="padding:4px 0;font-weight:700;">IBAN:</td><td style="font-family:monospace;font-weight:700;color:#1d4ed8;">${BANK_DETAILS.iban}</td></tr>
        <tr><td style="padding:4px 0;font-weight:700;">Reference:</td><td>${invNum} — ${academy.name}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#92400e;">
        After payment, send the bank receipt to:<br>
        📱 WhatsApp: <strong>${BANK_DETAILS.whatsapp}</strong><br>
        📧 Email: <strong>${BANK_DETAILS.email}</strong>
      </p>
    </div>

    <!-- Warning -->
    <div style="padding:16px 24px;background:#fff1f2;border-top:2px solid #fecdd3;">
      <p style="margin:0;font-size:13px;color:#be123c;font-weight:600;">
        ⚠️ Important: Failure to pay by ${dueDate} will result in your academy and all players being locked from the app. 
        Contact us immediately if you need an extension.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 24px;text-align:center;color:#9ca3af;font-size:12px;">
      <p style="margin:0;">Bat Better 365 · Academy Management Platform</p>
      <p style="margin:4px 0 0;">This is an automated invoice. Generated on ${invoiceDate}.</p>
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
          subject: `Invoice ${invNum} — ${currency} ${totalAmount.toLocaleString()} Due by ${dueDate}`,
          html: emailHtml,
        }),
      });

      // Update invoice with sent email
      await supabase.from('billing_invoices').update({ sent_to_email: academy.owner_email }).eq('id', invoice.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        player_count: playerCount,
        total_amount: totalAmount,
        currency,
        due_date: dueDate,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
