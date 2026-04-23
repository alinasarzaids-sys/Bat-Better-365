/**
 * confirm-and-register edge function
 * Uses service role to:
 * 1. Sign up user (or get existing)
 * 2. Auto-confirm their email
 * 3. Return a valid session via admin.generateLink or direct confirm
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Step 1: Try to create the user with email_confirm = true
    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // Auto-confirm immediately
      user_metadata: { full_name: full_name || '' },
    });

    let userId: string | null = null;

    if (!createErr && createData?.user) {
      userId = createData.user.id;
      console.log('Created new user:', userId);
    } else if (createErr?.message?.includes('already been registered') || createErr?.message?.includes('already exists')) {
      // User exists — find them and ensure they're confirmed
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u: any) => u.email === email);
      if (existingUser) {
        userId = existingUser.id;
        // Ensure email is confirmed
        if (!existingUser.email_confirmed_at) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email_confirm: true,
          });
        }
        console.log('Found existing user:', userId);
      }
    } else if (createErr) {
      console.error('createUser error:', createErr.message);
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Could not create or find user account' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Now sign in with password to get a real session token
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !signInData?.session) {
      console.error('signIn error:', signInErr?.message);
      return new Response(JSON.stringify({ error: signInErr?.message || 'Login failed after account creation' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: signInData.user.id,
        email: signInData.user.email,
      },
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('confirm-and-register error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
