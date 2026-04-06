import { useContext } from 'react';
import { SessionContext } from '@/contexts/SessionContext';

export function useActiveSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useActiveSession must be used within SessionProvider');
  return context;
}
