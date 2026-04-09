import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ADMIN_EMAIL = 'alinasarzaids@gmail.com';
const PRICE_PER_PLAYER = 550;
const CURRENCY = 'PKR';
const CURRENCY_SYMBOL = '₨';
const REPORT_SECRET = 'BB365-ADMIN-REPORT-2025';

function formatNumber(n: number): string {
  return n.toLocaleString('en-PK');
}

function getDateLabel(): string {
  return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getMonthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function buildHtml(stats: any, auditData: any): string {
  const totalRevenue = auditData.players * PRICE_PER_PLAYER;

  const perAcademyRows = (auditData.perAcademy || []).map((a: any, i: number) => `
    <tr>
      <td style="padding:12px 14px; font-size:13px; border-bottom:1px solid #eee;">${i + 1}</td>
      <td style="padding:12px 14px; font-size:13px; border-bottom:1px solid #eee;"><strong>${a.name}</strong></td>
      <td style="padding:12px 14px; font-size:13px; border-bottom:1px solid #eee; text-align:center;">${a.players}</td>
      <td style="padding:12px 14px; font-size:13px; border-bottom:1px solid #eee; text-align:center;">${a.coaches}</td>
      <td style="padding:12px 14px; font-size:13px; border-bottom:1px solid #eee; text-align:right; color:#1a7a4a; font-weight:800;">${CURRENCY_SYMBOL}${formatNumber(a.players * PRICE_PER_PLAYER)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bat Better 365 — Admin Report</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; color:#1a1a2e;">

  <div style="max-width:680px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a7a4a 0%,#2d9d6a 100%); padding:32px 36px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:26px; font-weight:900; color:#fff; letter-spacing:-0.5px;">🏏 Bat Better 365</div>
        <div style="font-size:13px; color:rgba(255,255,255,0.75); margin-top:4px;">Admin Report — Confidential</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.7);">Generated On</div>
        <div style="font-size:15px; font-weight:700; color:#fff; margin-top:2px;">${getDateLabel()}</div>
        <div style="font-size:12px; color:rgba(255,255,255,0.7); margin-top:2px;">Period: ${getMonthLabel()}</div>
      </div>
    </div>

    <div style="padding:32px 36px;">

      <!-- App Users -->
      <div style="margin-bottom:36px;">
        <h2 style="font-size:15px; font-weight:800; color:#1a7a4a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:1px solid #e5e5e5;">📱 App Users Overview</h2>
        <table width="100%" cellpadding="0" cellspacing="8" style="border-collapse:separate; border-spacing:8px;">
          <tr>
            <td style="background:#f8fffe; border:1px solid #d4edda; border-radius:10px; padding:16px; text-align:center; width:25%;">
              <div style="font-size:32px; font-weight:900; color:#1a7a4a; line-height:1;">${stats.total_users}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Total Users</div>
            </td>
            <td style="background:#f0f7ff; border:1px solid #bee3f8; border-radius:10px; padding:16px; text-align:center; width:25%;">
              <div style="font-size:32px; font-weight:900; color:#1a56db; line-height:1;">${stats.individual_users}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Individual Mode</div>
            </td>
            <td style="background:#fffbf0; border:1px solid #fde8a8; border-radius:10px; padding:16px; text-align:center; width:25%;">
              <div style="font-size:32px; font-weight:900; color:#d97706; line-height:1;">${stats.academy_users}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Academy Mode</div>
            </td>
            <td style="background:#f9f9f9; border:1px solid #ddd; border-radius:10px; padding:16px; text-align:center; width:25%;">
              <div style="font-size:32px; font-weight:900; color:#999; line-height:1;">${stats.no_mode}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">No Mode Set</div>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="8" style="border-collapse:separate; border-spacing:8px; margin-top:8px;">
          <tr>
            <td style="background:#f8fffe; border:1px solid #d4edda; border-radius:10px; padding:16px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#1a7a4a; line-height:1;">${stats.total_training_logs}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Training Logs</div>
            </td>
            <td style="background:#f8fffe; border:1px solid #d4edda; border-radius:10px; padding:16px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#1a7a4a; line-height:1;">${stats.total_sessions_planned}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Sessions Planned</div>
            </td>
            <td style="background:#f8fffe; border:1px solid #d4edda; border-radius:10px; padding:16px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#1a7a4a; line-height:1;">${stats.total_academies}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Academies</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Revenue -->
      <div style="margin-bottom:36px;">
        <h2 style="font-size:15px; font-weight:800; color:#1a7a4a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:1px solid #e5e5e5;">💰 Monthly Revenue (Academy)</h2>
        <div style="background:linear-gradient(135deg,#1a7a4a 0%,#2d9d6a 100%); border-radius:14px; padding:28px; text-align:center; margin-bottom:16px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:1.5px; color:rgba(255,255,255,0.8);">Total Revenue Owed This Month</div>
          <div style="font-size:48px; font-weight:900; color:#fff; margin:8px 0; letter-spacing:-1px;">${CURRENCY_SYMBOL}${formatNumber(totalRevenue)}</div>
          <div style="font-size:14px; color:rgba(255,255,255,0.8);">${CURRENCY} per month</div>
          <div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.3); font-size:13px; color:rgba(255,255,255,0.85);">
            ${auditData.players} Active Players × ${CURRENCY_SYMBOL}${formatNumber(PRICE_PER_PLAYER)} ${CURRENCY}/player
          </div>
        </div>
        <div style="background:#fffbf0; border-left:4px solid #d97706; border-radius:0 8px 8px 0; padding:14px 18px;">
          <p style="font-size:12.5px; color:#444; line-height:1.6; margin:0;">
            <strong>🔒 Device-Locked · Active-Only Billing:</strong>
            Each player device is locked (1 phone = 1 player account). Only <strong>Active</strong> players count toward revenue.
            ${stats.inactive_players > 0 ? `<br/><strong>${stats.inactive_players} deactivated player(s)</strong> are excluded from billing this month.` : ''}
          </p>
        </div>
      </div>

      <!-- Academy Breakdown -->
      <div style="margin-bottom:36px;">
        <h2 style="font-size:15px; font-weight:800; color:#1a7a4a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:1px solid #e5e5e5;">🏫 Academy Breakdown</h2>
        <table width="100%" cellpadding="0" cellspacing="8" style="border-collapse:separate; border-spacing:8px; margin-bottom:20px;">
          <tr>
            <td style="background:#f8fffe; border:1px solid #d4edda; border-radius:10px; padding:16px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#1a7a4a; line-height:1;">${auditData.academies}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Active Academies</div>
            </td>
            <td style="background:#f8fffe; border:1px solid #d4edda; border-radius:10px; padding:16px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#1a7a4a; line-height:1;">${auditData.players}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Billed Players</div>
            </td>
            <td style="background:#fffbf0; border:1px solid #fde8a8; border-radius:10px; padding:16px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#d97706; line-height:1;">${auditData.coaches}</div>
              <div style="font-size:11px; color:#888; margin-top:5px; font-weight:600; text-transform:uppercase;">Active Coaches</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border-radius:10px; overflow:hidden; border:1px solid #e5e5e5;">
          <thead>
            <tr style="background:#1a7a4a; color:#fff;">
              <th style="padding:11px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">#</th>
              <th style="padding:11px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Academy</th>
              <th style="padding:11px 14px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Players</th>
              <th style="padding:11px 14px; text-align:center; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Coaches</th>
              <th style="padding:11px 14px; text-align:right; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Revenue (${CURRENCY})</th>
            </tr>
          </thead>
          <tbody>
            ${perAcademyRows || '<tr><td colspan="5" style="text-align:center; color:#aaa; padding:24px; font-style:italic;">No academies found</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Billing Notes -->
      <div style="margin-bottom:36px;">
        <h2 style="font-size:15px; font-weight:800; color:#1a7a4a; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:1px solid #e5e5e5;">📋 Billing Notes</h2>
        <div style="background:#f0f7ff; border-left:4px solid #1a56db; border-radius:0 8px 8px 0; padding:14px 18px;">
          <p style="font-size:12.5px; color:#444; line-height:1.8; margin:0;">
            <strong>Rate:</strong> ${CURRENCY_SYMBOL}${formatNumber(PRICE_PER_PLAYER)} ${CURRENCY} per active player per month.<br/>
            <strong>Billing:</strong> Only players with <strong>Active</strong> status are included in revenue calculations.<br/>
            <strong>Device Lock:</strong> Each player code is tied to one physical device to prevent sharing.<br/>
            <strong>Adjustments:</strong> Coaches can deactivate players who have left; they are removed from billing immediately.
          </p>
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f9f9f9; padding:20px 36px; border-top:1px solid #eee; display:flex; justify-content:space-between;">
      <span style="font-size:12px; color:#aaa;"><strong style="color:#1a7a4a;">Bat Better 365</strong> — Admin Report · Confidential</span>
      <span style="font-size:12px; color:#aaa;">Generated: ${getDateLabel()}</span>
    </div>

  </div>

</body>
</html>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate secret token to prevent unauthorized access
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret') || (await req.json().catch(() => ({}))).secret;
    if (secret !== REPORT_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch stats via function
    const { data: stats, error: statsError } = await supabase.rpc('get_app_stats');
    if (statsError) throw new Error(`Stats error: ${statsError.message}`);

    // Fetch per-academy breakdown
    const { data: academies, error: aErr } = await supabase.from('academies').select('id, name');
    if (aErr) throw new Error(`Academies error: ${aErr.message}`);

    const { data: members, error: mErr } = await supabase
      .from('academy_members')
      .select('academy_id, role, is_active');
    if (mErr) throw new Error(`Members error: ${mErr.message}`);

    const perAcademy = (academies || []).map((a: any) => {
      const am = (members || []).filter((m: any) => m.academy_id === a.id);
      return {
        id: a.id,
        name: a.name,
        players: am.filter((m: any) => m.role === 'player' && m.is_active !== false).length,
        coaches: am.filter((m: any) => m.role === 'coach' && m.is_active !== false).length,
      };
    });

    const totalPlayers = (members || []).filter((m: any) => m.role === 'player' && m.is_active !== false).length;
    const totalCoaches = (members || []).filter((m: any) => m.role === 'coach' && m.is_active !== false).length;

    const auditData = {
      academies: (academies || []).length,
      players: totalPlayers,
      coaches: totalCoaches,
      perAcademy,
    };

    const totalRevenue = totalPlayers * PRICE_PER_PLAYER;
    const html = buildHtml(stats, auditData);

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('RESEND_API_KEY not configured');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Bat Better 365 <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: `🏏 Bat Better 365 — Admin Report (${getMonthLabel()}) · ${stats.total_users} users · ₨${totalRevenue.toLocaleString()}`,
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      throw new Error(`Resend error: ${JSON.stringify(emailData)}`);
    }

    console.log(`Admin report sent to ${ADMIN_EMAIL}`, emailData);

    return new Response(JSON.stringify({
      success: true,
      message: `Report sent to ${ADMIN_EMAIL}`,
      stats: {
        total_users: stats.total_users,
        active_players: totalPlayers,
        total_revenue_pkr: totalRevenue,
        academies: auditData.academies,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('send-admin-report error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
