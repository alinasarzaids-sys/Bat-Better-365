import { useState, useEffect } from 'react';
import { drillService } from '@/services/drillService';
import { Drill, Pillar } from '@/types';

export function useDrills(pillar?: Pillar) {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDrills();
  }, [pillar]);

  const loadDrills = async () => {
    setLoading(true);
    setError(null);

    const result = pillar 
      ? await drillService.getDrillsByPillar(pillar)
      : await drillService.getAllDrills();

    if (result.error) {
      setError(result.error);
    } else {
      setDrills(result.data || []);
    }

    setLoading(false);
  };

  const searchDrills = async (query: string) => {
    setLoading(true);
    const result = await drillService.searchDrills(query);
    
    if (result.error) {
      setError(result.error);
    } else {
      setDrills(result.data || []);
    }
    
    setLoading(false);
  };

  return {
    drills,
    loading,
    error,
    reload: loadDrills,
    search: searchDrills,
  };
}
