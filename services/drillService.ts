import { getSupabaseClient } from '@/template';
import { Drill, Pillar, Difficulty } from '@/types';

const supabase = getSupabaseClient();

export const drillService = {
  async getAllDrills(): Promise<{ data: Drill[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .order('pillar', { ascending: true })
      .order('difficulty', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getDrillsByPillar(pillar: Pillar, subcategory?: string): Promise<{ data: Drill[] | null; error: string | null }> {
    let query = supabase
      .from('drills')
      .select('*')
      .eq('pillar', pillar);

    if (subcategory) {
      query = query.eq('subcategory', subcategory);
    }

    const { data, error } = await query.order('difficulty', { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async getSubcategoriesByPillar(pillar: Pillar): Promise<{ data: string[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('drills')
      .select('subcategory')
      .eq('pillar', pillar)
      .not('subcategory', 'is', null);

    if (error) {
      return { data: null, error: error.message };
    }

    const uniqueSubcategories = [...new Set(data.map(d => d.subcategory).filter(Boolean))] as string[];
    return { data: uniqueSubcategories, error: null };
  },

  async getDrillById(id: string): Promise<{ data: Drill | null; error: string | null }> {
    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },

  async searchDrills(query: string): Promise<{ data: Drill[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .ilike('name', `%${query}%`);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  },
};
