import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALL_ACCOUNTS = [
  { id: '209385c1-64bd-4e86-80b4-b7f8c42552d2', email: 'demo.batbetter@gmail.com', password: 'Demo1234' },
  { id: '54838bb4-de49-4937-98a9-d1207b5b61a3', email: 'coach.batbetter@gmail.com', password: 'Demo1234' },
  { id: 'a94b5410-6497-4c4c-930f-123a8e0560f3', email: 'alinasarzaids@gmail.com', password: 'Yahussain5' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Accept optional target email from request body
    let targetEmail: string | null = null;
    try {
      const body = await req.json();
      targetEmail = body?.email ?? null;
    } catch { /* no body */ }

    const accounts = targetEmail
      ? ALL_ACCOUNTS.filter(a => a.email === targetEmail)
      : ALL_ACCOUNTS;

    const results = [];

    for (const account of accounts) {
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(account.id, {
        password: account.password,
        email_confirm: true,
      });

      if (updateErr) {
        console.error(`Failed to update ${account.email}:`, updateErr.message);
        results.push({ email: account.email, error: updateErr.message });
      } else {
        console.log(`Password reset for ${account.email}:`, updated.user.id);
        results.push({ email: account.email, action: 'password_reset', id: updated.user.id });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('reset-demo-passwords error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
