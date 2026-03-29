import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useRouter } from 'expo-router';

export function useDeepLinking() {
  const { refreshSubscription } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { url } = event;
      
      if (url.includes('subscription/success')) {
        // Subscription successful - refresh status and redirect to home
        refreshSubscription();
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1000);
      } else if (url.includes('subscription/cancel')) {
        // User cancelled subscription - stay on subscription page
        router.replace('/subscription');
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => subscription.remove();
  }, [checkSubscription, router]);
}
