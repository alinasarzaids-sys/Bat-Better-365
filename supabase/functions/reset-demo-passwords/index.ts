import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const DEMO_ACCOUNTS = [
      { email: 'demo.batbetter@gmail.com', password: 'Demo1234' },
      { email: 'coach.batbetter@gmail.com', password: 'Demo1234' },
    ];

    const results = [];

    for (const account of DEMO_ACCOUNTS) {
      // List users to find by email
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) {
        results.push({ email: account.email, error: listErr.message });
        continue;
      }

      const user = listData.users.find((u: any) => u.email === account.email);
      if (!user) {
        // Create the user
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
        });
        if (createErr) {
          results.push({ email: account.email, error: 'create: ' + createErr.message });
        } else {
          results.push({ email: account.email, action: 'created', id: created.user.id });
        }
        continue;
      }

      // Update password using admin API (Go server handles hashing correctly)
      const { data: updated, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: account.password,
        email_confirm: true,
      });

      if (updateErr) {
        results.push({ email: account.email, error: 'update: ' + updateErr.message });
      } else {
        results.push({ email: account.email, action: 'password_reset', id: updated.user.id });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
