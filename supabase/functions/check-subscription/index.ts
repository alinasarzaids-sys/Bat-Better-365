import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const REVENUECAT_API_KEY = Deno.env.get('REVENUECAT_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface RevenueCatSubscriber {
  entitlements: {
    [key: string]: {
      expires_date: string | null;
      product_identifier: string;
      purchase_date: string;
    };
  };
  subscriptions: {
    [key: string]: {
      expires_date: string | null;
      period_type: string;
      purchase_date: string;
      unsubscribe_detected_at: string | null;
      billing_issues_detected_at: string | null;
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user ID from request
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch subscriber info from RevenueCat
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('RevenueCat API error:', await response.text());
      return new Response(
        JSON.stringify({ isSubscribed: false, error: 'Failed to check subscription' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const subscriber = data.subscriber as RevenueCatSubscriber;

    // Check if user has any active entitlements
    const hasActiveEntitlement = Object.values(subscriber.entitlements || {}).some(entitlement => {
      if (!entitlement.expires_date) return true; // Lifetime entitlement
      return new Date(entitlement.expires_date) > new Date();
    });

    // Also check active subscriptions
    const hasActiveSubscription = Object.values(subscriber.subscriptions || {}).some(subscription => {
      if (!subscription.expires_date) return false;
      if (subscription.unsubscribe_detected_at || subscription.billing_issues_detected_at) return false;
      return new Date(subscription.expires_date) > new Date();
    });

    const isSubscribed = hasActiveEntitlement || hasActiveSubscription;

    // Update user_subscriptions table if needed
    if (isSubscribed) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Get the most recent subscription
      const activeSubscription = Object.entries(subscriber.subscriptions || {})
        .filter(([_, sub]) => sub.expires_date && new Date(sub.expires_date) > new Date())
        .sort((a, b) => new Date(b[1].purchase_date).getTime() - new Date(a[1].purchase_date).getTime())[0];

      if (activeSubscription) {
        const [productId, subscription] = activeSubscription;
        
        await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            product_id: productId,
            platform: 'revenuecat',
            status: 'active',
            transaction_id: `rc_${userId}_${productId}`,
            expires_at: subscription.expires_date,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,platform'
          });
      }
    }

    return new Response(
      JSON.stringify({ isSubscribed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Check subscription error:', error);
    return new Response(
      JSON.stringify({ isSubscribed: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
