/**
 * ai-session-planner edge function
 * Generates a cricket training session plan (objectives + training blocks)
 * using OnSpace AI (Gemini Flash) based on coach input.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { sessionType, durationMinutes, playerLevel, focusArea, squadSize, additionalNotes } = await req.json();

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert cricket coach session planner. Generate structured training session plans in strict JSON format. Be practical, specific, and time-efficient. Focus on cricket-specific drills and exercises.`;

    const userPrompt = `Generate a cricket training session plan with this context:
- Session Type: ${sessionType || 'Training'}
- Duration: ${durationMinutes || 90} minutes
- Player Level: ${playerLevel || 'Mixed'}
- Focus Area: ${focusArea || 'General batting'}
- Squad Size: ${squadSize || '10-15 players'}
${additionalNotes ? `- Additional Notes: ${additionalNotes}` : ''}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "title": "Session title (concise, 3-5 words)",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "blocks": [
    {
      "startOffset": 0,
      "durationMinutes": 15,
      "activities": ["Warm-up"],
      "drills": "Specific drills or exercises to do in this block",
      "coachingPoints": "Key coaching points"
    }
  ],
  "coachNotes": "Overall session notes and tips for the coach"
}

Rules:
- objectives: exactly 3 specific, measurable objectives
- blocks: 3-6 training blocks that fill the total duration
- activities must be from: Batting, Bowling, Fielding, Keeping, Fitness, Warm-up, Cool-down, Team Talk, Match Sim
- startOffset is minutes from session start
- drills should name specific cricket drills
- Keep it practical for a real cricket training ground`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI API error:', errText);
      return new Response(JSON.stringify({ error: 'AI generation failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content ?? '';

    // Parse the JSON from AI response
    let plan;
    try {
      // Strip markdown code blocks if present
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      plan = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', rawContent);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: rawContent }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('ai-session-planner error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
