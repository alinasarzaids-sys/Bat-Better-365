import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, analysisType, days, prompt } = await req.json();

    if (!userId || !analysisType) {
      return new Response(
        JSON.stringify({ error: 'userId and analysisType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user progress
    const { data: progress, error: progressError } = await supabaseClient
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (progressError) {
      console.error('Progress error:', progressError);
      return new Response(
        JSON.stringify({ error: 'Could not fetch user progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For personalized_suggestions, use the provided prompt directly
    if (analysisType === 'personalized_suggestions') {
      // Get all available drills
      const { data: allDrills } = await supabaseClient
        .from('drills')
        .select('id, name, description, pillar, duration_minutes');

      if (!allDrills || allDrills.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No drills available in database' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's monthly training stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: sessions } = await supabaseClient
        .from('sessions')
        .select('session_type, items:session_items(drill:drills(pillar))')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString());

      const { data: mentalLogs } = await supabaseClient
        .from('mental_drill_logs')
        .select('drill_name')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());

      // Calculate pillar training counts
      const pillarCounts: Record<string, number> = {
        Technical: 0,
        Physical: 0,
        Mental: 0,
        Tactical: 0,
      };

      sessions?.forEach((session: any) => {
        if (session.items && session.items.length > 0) {
          const pillar = session.items[0]?.drill?.pillar;
          if (pillar && pillarCounts.hasOwnProperty(pillar)) {
            pillarCounts[pillar]++;
          }
        }
      });

      pillarCounts.Mental += mentalLogs?.length || 0;

      // Find weakest pillars
      const sortedPillars = Object.entries(pillarCounts).sort((a, b) => a[1] - b[1]);
      const weakestPillar = sortedPillars[0][0];

      // Build STRICT drill list for AI to choose from
      const drillsList = allDrills.map((d, idx) => 
        `${idx + 1}. "${d.name}" - Pillar: ${d.pillar}, Duration: ${d.duration_minutes}min, Description: ${d.description}`
      ).join('\n');

      // Build context for AI with STRICT instructions
      const contextPrompt = `You are a cricket training assistant. Your ONLY task is to select 2-3 drills from the EXACT list below.

**STRICT RULES:**
1. You MUST ONLY select drills from the numbered list below
2. Use the EXACT drill names as written (copy them precisely)
3. DO NOT invent, create, or suggest drills not in this list
4. DO NOT modify drill names in any way
5. Focus on the user's weakest pillar: ${weakestPillar}

User's Monthly Training Stats:
- Technical: ${pillarCounts.Technical} sessions
- Physical: ${pillarCounts.Physical} sessions  
- Mental: ${pillarCounts.Mental} sessions
- Tactical: ${pillarCounts.Tactical} sessions

**AVAILABLE DRILLS (SELECT FROM THESE ONLY):**
${drillsList}

Provide a response in this EXACT JSON format:
{
  "category": "Brief category like 'Focus on ${weakestPillar}' or 'Build well-rounded skills'",
  "drills": [
    {
      "name": "EXACT drill name from list above",
      "description": "Copy the description from the list above",
      "pillar": "Copy the pillar from the list above",
      "duration_minutes": number from list above,
      "reason": "1-2 sentence reason why this drill helps the user"
    }
  ]
}

Select 2-3 drills, prioritizing ${weakestPillar} pillar.`;

      // Call OnSpace AI
      const aiResponse = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'You are a drill selector. You can ONLY choose from the exact drills provided. Never invent or create new drills. Copy drill names exactly as shown.' 
            },
            { role: 'user', content: contextPrompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('OnSpace AI error:', errorText);
        return new Response(
          JSON.stringify({ error: 'AI service error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0]?.message?.content || '';

      try {
        // Try to parse AI response
        const parsed = JSON.parse(content);
        
        // Match drills with database IDs (case-insensitive, fuzzy matching)
        const enrichedDrills = parsed.drills.map((drill: any) => {
          const matchedDrill = allDrills.find(d => {
            const nameMatch = d.name.toLowerCase().trim() === drill.name.toLowerCase().trim();
            const fuzzyMatch = d.name.toLowerCase().includes(drill.name.toLowerCase().trim()) ||
                               drill.name.toLowerCase().includes(d.name.toLowerCase().trim());
            return nameMatch || fuzzyMatch;
          });

          if (!matchedDrill) {
            console.warn(`No database match found for drill: ${drill.name}`);
            return null;
          }

          return {
            id: matchedDrill.id,
            name: matchedDrill.name, // Use actual database name
            description: matchedDrill.description, // Use actual database description
            pillar: matchedDrill.pillar,
            duration_minutes: matchedDrill.duration_minutes,
            reason: drill.reason,
          };
        }).filter(Boolean); // Remove null entries (unmatched drills)

        if (enrichedDrills.length === 0) {
          console.error('No valid drills matched from AI response');
          return new Response(
            JSON.stringify({ error: 'Could not match AI suggestions to database drills' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ result: JSON.stringify({ category: parsed.category, drills: enrichedDrills }) }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, content);
        return new Response(
          JSON.stringify({ error: 'Failed to parse AI suggestions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let aiPrompt = '';
    
    if (analysisType === 'performance') {
      aiPrompt = `Analyze this cricket player's training performance and provide a brief assessment (2-3 sentences):
- Total sessions: ${progress.total_sessions}
- Total training time: ${progress.total_minutes} minutes
- Current streak: ${progress.current_streak} days
- Skill level: ${progress.skill_level}
- Technical points: ${progress.technical_points}
- Physical points: ${progress.physical_points}
- Mental points: ${progress.mental_points}
- Tactical points: ${progress.tactical_points}`;
    } else if (analysisType === 'recommendations') {
      aiPrompt = `Based on this player's training data, recommend 3 specific drills they should focus on:
- Technical points: ${progress.technical_points}
- Physical points: ${progress.physical_points}
- Mental points: ${progress.mental_points}
- Tactical points: ${progress.tactical_points}
Identify the weakest area and suggest drills to improve. Return as a JSON array of drill names.`;
    } else if (analysisType === 'training_plan') {
      aiPrompt = `Create a ${days}-day cricket training plan for this player. Format as JSON with structure:
{ "days": [{ "day": 1, "focus": "Technical", "drills": ["drill1", "drill2"], "duration": 30 }] }
Player stats:
- Skill level: ${progress.skill_level}
- Technical: ${progress.technical_points}, Physical: ${progress.physical_points}
- Mental: ${progress.mental_points}, Tactical: ${progress.tactical_points}`;
    }

    // Call OnSpace AI
    const aiResponse = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a cricket coaching expert.' },
          { role: 'user', content: aiPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OnSpace AI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '';

    let result = {};
    if (analysisType === 'performance') {
      result = { analysis: content };
    } else if (analysisType === 'recommendations') {
      try {
        const recommendations = JSON.parse(content);
        result = { recommendations };
      } catch {
        result = { recommendations: [content] };
      }
    } else if (analysisType === 'training_plan') {
      try {
        const plan = JSON.parse(content);
        result = { plan };
      } catch {
        result = { plan: { days: [] } };
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-coach-analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
