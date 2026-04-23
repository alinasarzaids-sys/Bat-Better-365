/**
 * confirm-and-register edge function
 * Strategy:
 * 1. Sign up with standard auth (anon client)
 * 2. Force-confirm email via confirm_user_email() SQL function (service role)
 * 3. Sign in with password to return a real session
 * If user already exists: force-confirm then sign in directly
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

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Step 1: Attempt signup (will create user OR fail if already exists)
    const { data: signUpData, error: signUpErr } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { full_name: full_name || '' } },
    });

    if (signUpErr) {
      console.log('Signup note:', signUpErr.message);
      // User may already exist — that's okay, continue to confirm + sign in
    } else {
      console.log('Signed up user:', signUpData?.user?.id);
    }

    // Step 2: Force-confirm the email using our SQL SECURITY DEFINER function
    // This bypasses email verification entirely — works even if user already existed
    const { error: confirmErr } = await supabaseAdmin.rpc('confirm_user_email', {
      p_email: email,
    });

    if (confirmErr) {
      console.error('confirm_user_email error:', confirmErr.message);
      // Non-fatal: continue and attempt sign in anyway
    } else {
      console.log('Email confirmed for:', email);
    }

    // Step 3: Sign in with password — should succeed now that email is confirmed
    const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !signInData?.session) {
      console.error('signIn error:', signInErr?.message);
      return new Response(JSON.stringify({
        error: signInErr?.message || 'Login failed after registration. Please try again.',
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully signed in:', signInData.user.id);

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
