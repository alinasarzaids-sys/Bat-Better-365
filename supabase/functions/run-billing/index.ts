import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
const COACH_COMMISSION = 300;
const NET_PER_PLAYER = 550;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find academies whose trial_end_date or next_billing_date is exactly 5 days away
    const target = new Date(today);
    target.setDate(target.getDate() + 5);
    const targetStr = target.toISOString().split('T')[0];

    const { data: academies, error: aErr } = await supabase
      .from('academies')
      .select('*')
      .or(`trial_end_date.eq.${targetStr},next_billing_date.eq.${targetStr}`)
      .neq('billing_status', 'locked');

    if (aErr) throw new Error(aErr.message);

    const results: any[] = [];
    const resendKey = Deno.env.get('RESEND_API_KEY');

    for (const academy of (academies || [])) {
      // Count approved active players only (coaches are FREE)
      const { data: members } = await supabase
        .from('academy_members')
        .select('id, display_name')
        .eq('academy_id', academy.id)
        .eq('role', 'player')
        .eq('status', 'approved')
        .eq('is_active', true);

      const playerCount = (members || []).length;
      const grossTotal = playerCount * GROSS_PRICE_PER_PLAYER;
      const commissionTotal = playerCount * COACH_COMMISSION;
      const netPayable = playerCount * NET_PER_PLAYER;
      const currency = academy.currency || 'PKR';

      const { data: invNum } = await supabase.rpc('generate_invoice_number', { p_academy_id: academy.id });

      const periodStart = academy.next_billing_date || academy.trial_end_date || targetStr;
      const periodEnd = new Date(new Date(periodStart).getTime() + 30 * 86400000).toISOString().split('T')[0];
      const dueDate = new Date(new Date(periodStart).getTime() + 7 * 86400000).toISOString().split('T')[0];
      const invoiceDate = today.toISOString().split('T')[0];

      const { data: invoice } = await supabase
        .from('billing_invoices')
        .insert({
          academy_id: academy.id,
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

      // Send invoice email
      if (resendKey && academy.owner_email && invoice) {
        const playerRows = (members || []).map((m: any, i: number) =>
          `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${i + 1}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${m.display_name || 'Player'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${currency} ${GROSS_PRICE_PER_PLAYER.toLocaleString()}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a;font-weight:700;">− ${currency} ${COACH_COMMISSION.toLocaleString()}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:800;color:#1d4ed8;">${currency} ${NET_PER_PLAYER.toLocaleString()}</td>
          </tr>`
        ).join('');

        const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px 24px;text-align:center;">
<h1 style="color:#fff;margin:0;font-size:28px;font-weight:900;">🏏 Bat Better 365</h1>
<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Academy Management Platform</p>
</div>
<div style="padding:24px;">
<h2 style="margin:0 0 6px;">MONTHLY INVOICE — ${invNum}</h2>
<p style="color:#6b7280;">Issued to: <strong>${academy.name}</strong> · Due: <strong style="color:#dc2626;">${dueDate}</strong></p>
<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
<thead><tr style="background:#111827;">
<th style="padding:10px 12px;text-align:left;color:#9ca3af;">#</th>
<th style="padding:10px 12px;text-align:left;color:#fff;">Player</th>
<th style="padding:10px 12px;text-align:right;color:#fff;">Gross</th>
<th style="padding:10px 12px;text-align:right;color:#86efac;">Commission</th>
<th style="padding:10px 12px;text-align:right;color:#93c5fd;">Net Payable</th>
</tr></thead>
<tbody>${playerRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#6b7280;">No approved players</td></tr>'}</tbody>
<tfoot><tr style="background:#f3f4f6;border-top:2px solid #e5e7eb;">
<td colspan="2" style="padding:12px;font-weight:900;">TOTAL (${playerCount} players)</td>
<td style="padding:12px;text-align:right;font-weight:700;">${currency} ${grossTotal.toLocaleString()}</td>
<td style="padding:12px;text-align:right;color:#16a34a;font-weight:700;">− ${currency} ${commissionTotal.toLocaleString()}</td>
<td style="padding:12px;text-align:right;font-weight:900;color:#1d4ed8;font-size:15px;">${currency} ${netPayable.toLocaleString()}</td>
</tr></tfoot>
</table>
</div>
<div style="padding:24px;background:#fefce8;border-top:2px solid #fde68a;">
<h3 style="margin:0 0 12px;color:#92400e;">Transfer ${currency} ${netPayable.toLocaleString()} to HBL</h3>
<table style="font-size:14px;color:#374151;background:#fff;border-radius:10px;width:100%;overflow:hidden;">
<tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:800;color:#92400e;width:140px;">Bank</td><td style="padding:10px 14px;">${ADMIN_BANK.bankName}</td></tr>
<tr><td style="padding:10px 14px;font-weight:800;color:#92400e;">Account</td><td style="padding:10px 14px;font-weight:700;">${ADMIN_BANK.accountTitle}</td></tr>
<tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:800;color:#92400e;">Number</td><td style="padding:10px 14px;font-family:monospace;font-weight:800;">${ADMIN_BANK.accountNumber}</td></tr>
<tr><td style="padding:10px 14px;font-weight:800;color:#92400e;">IBAN</td><td style="padding:10px 14px;font-family:monospace;color:#1d4ed8;">${ADMIN_BANK.iban}</td></tr>
<tr style="background:#f9fafb;"><td style="padding:10px 14px;font-weight:800;color:#92400e;">Reference</td><td style="padding:10px 14px;font-weight:700;">${invNum} — ${academy.name}</td></tr>
</table>
<p style="margin:14px 0 0;font-size:13px;color:#92400e;">Send receipt to: WhatsApp <strong>${ADMIN_BANK.whatsapp}</strong> or Email <strong>${ADMIN_BANK.email}</strong></p>
</div>
</div></body></html>`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Bat Better 365 Billing <billing@batbetter365.com>',
            to: [academy.owner_email],
            subject: `Invoice ${invNum} — ${currency} ${netPayable.toLocaleString()} due ${dueDate} | ${academy.name}`,
            html,
          }),
        });

        await supabase.from('billing_invoices').update({ sent_to_email: academy.owner_email }).eq('id', invoice.id);
      }

      results.push({
        academy_name: academy.name,
        invoice_number: invNum,
        player_count: playerCount,
        net_payable: netPayable,
        email_sent: !!(resendKey && academy.owner_email),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      academies_processed: results.length,
      results,
      run_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
