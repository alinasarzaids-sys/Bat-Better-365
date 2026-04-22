import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPER_ADMIN_UID = 'a94b5410-6497-4c4c-930f-123a8e0560f3';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify caller is super admin via JWT
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify the requesting user is the super admin
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (!user || user.id !== SUPER_ADMIN_UID) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Fetch all academies (service role bypasses RLS) ──────────────────────
    const { data: academies, error: aErr } = await supabaseAdmin
      .from('academies')
      .select('*')
      .order('created_at', { ascending: false });

    if (aErr) throw new Error(aErr.message);

    // ── Fetch ALL member counts in one query ─────────────────────────────────
    const { data: members } = await supabaseAdmin
      .from('academy_members')
      .select('academy_id, role, status, is_active');

    // ── Fetch ALL invoices ────────────────────────────────────────────────────
    const { data: allInvoices } = await supabaseAdmin
      .from('billing_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    // ── Enrich each academy ──────────────────────────────────────────────────
    const enriched = (academies || []).map((a: any) => {
      const academyMembers = (members || []).filter((m: any) => m.academy_id === a.id);
      const playerCount = academyMembers.filter(
        (m: any) => m.role === 'player' && m.status === 'approved' && m.is_active === true
      ).length;
      const invoices = (allInvoices || []).filter((inv: any) => inv.academy_id === a.id);

      return {
        ...a,
        _playerCount: playerCount,
        _invoices: invoices.slice(0, 5),
      };
    });

    // ── Global stats ─────────────────────────────────────────────────────────
    const totalPlayers = (members || []).filter(
      (m: any) => m.role === 'player' && m.status === 'approved' && m.is_active === true
    ).length;

    const pendingPayments = enriched.filter((a: any) =>
      a.billing_status === 'locked' ||
      (a._invoices || []).some((inv: any) => inv.status === 'unpaid')
    ).length;

    return new Response(JSON.stringify({
      success: true,
      academies: enriched,
      globalStats: {
        totalAcademies: enriched.length,
        totalPlayers,
        pendingPayments,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('get-admin-data error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
