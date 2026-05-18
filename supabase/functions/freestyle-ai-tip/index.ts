import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    const {
      trainingTypes,
      focusArea,
      sessionGoal,
      technicalRating,
      mentalRating,
      physicalRating,
      tacticalRating,
      shotExecution,
      footwork,
      timing,
      focus,
      confidence,
      pressureHandling,
      energyLevel,
      reactionSpeed,
      shotSelection,
      gameAwareness,
      ballsFaced,
      ballsMiddled,
      isLogMode,
    } = await req.json();

    const middlePct = ballsFaced && ballsMiddled && parseInt(ballsFaced) > 0
      ? Math.round((parseInt(ballsMiddled) / parseInt(ballsFaced)) * 100)
      : null;

    const prompt = `You are an expert cricket batting coach. A player just completed a ${isLogMode ? 'logged past' : 'live'} freestyle batting session. Analyse their performance data and give ONE concise, actionable coaching tip to help them improve.

Session Details:
- Training with: ${trainingTypes || 'Not specified'}
${focusArea ? `- Focus area: ${focusArea}` : ''}
${sessionGoal ? `- Session goal: ${sessionGoal}` : ''}
${ballsFaced ? `- Balls faced: ${ballsFaced}` : ''}
${ballsMiddled ? `- Balls middled: ${ballsMiddled}${middlePct !== null ? ` (${middlePct}% middle rate)` : ''}` : ''}

Performance Ratings (out of 5):
Technical: ${technicalRating}/5 (Shot Execution: ${shotExecution}/5, Footwork: ${footwork}/5, Timing: ${timing}/5)
Mental: ${mentalRating}/5 (Focus: ${focus}/5, Confidence: ${confidence}/5, Pressure Handling: ${pressureHandling}/5)
Physical: ${physicalRating}/5 (Energy: ${energyLevel}/5, Reaction Speed: ${reactionSpeed}/5)
Tactical: ${tacticalRating}/5 (Shot Selection: ${shotSelection}/5, Game Awareness: ${gameAwareness}/5)

Identify the lowest-rated pillar or specific weakness and give a focused, practical drill or mental cue the player can use in their next session. Keep the response to 2-3 sentences maximum. Be specific and encouraging.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert cricket batting coach providing concise, actionable feedback. Always be encouraging and specific.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const tip = data.choices?.[0]?.message?.content ?? '';

    return new Response(
      JSON.stringify({ tip }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('freestyle-ai-tip error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
