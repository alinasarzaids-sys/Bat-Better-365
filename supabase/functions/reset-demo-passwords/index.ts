import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const DEMO_ACCOUNTS = [
  { id: '209385c1-64bd-4e86-80b4-b7f8c42552d2', email: 'demo.batbetter@gmail.com', password: 'Demo1234' },
  { id: '54838bb4-de49-4937-98a9-d1207b5b61a3', email: 'coach.batbetter@gmail.com', password: 'Demo1234' },
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

    const results = [];

    for (const account of DEMO_ACCOUNTS) {
      // Use updateUserById directly with known IDs — avoids listUsers IP restriction
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

    // Now sign in to verify it worked and return a session for each
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const sessions: Record<string, any> = {};
    for (const account of DEMO_ACCOUNTS) {
      const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (!signInErr && signInData?.session) {
        sessions[account.email] = {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        };
        console.log(`Sign-in verified for ${account.email}`);
      } else {
        console.error(`Sign-in failed for ${account.email}:`, signInErr?.message);
      }
    }

    return new Response(JSON.stringify({ ok: true, results, sessions }), {
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
