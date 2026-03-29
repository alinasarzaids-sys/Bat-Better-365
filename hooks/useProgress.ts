import { useState, useEffect } from 'react';
import { useAuth } from '@/template';
import { progressService } from '@/services/progressService';
import { UserProgress } from '@/types';

export function useProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProgress();
    }
  }, [user]);

  const loadProgress = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const result = await progressService.getUserProgress(user.id);

    if (result.error) {
      setError(result.error);
    } else {
      setProgress(result.data);
    }

    setLoading(false);
  };

  const refresh = () => {
    loadProgress();
  };

  return {
    progress,
    loading,
    error,
    refresh,
  };
}
