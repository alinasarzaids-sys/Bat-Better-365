import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { position, sessionType, stats, mode, sessionKind, objective, struggle, performanceContext, context, weakestPillar, strongestPillar } = await req.json();
    // mode: 'questions' | 'analysis' | 'struggle_tip' | 'analytics_improvement' | 'smart_insight'

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let prompt = '';

    if (mode === 'smart_insight') {
      // Smart dashboard insight: reads player context and generates 2-sentence coaching insight
      const insightPrompt = `You are an elite cricket performance coach. Based on the player's recent training data, write exactly 2 sentences of personalised coaching insight.

Training context: ${context || 'Player has recent training data available.'}
Weakest pillar: ${weakestPillar || 'Technical'}
Strongest pillar: ${strongestPillar || 'Physical'}

Rules:
- Sentence 1: Acknowledge the strongest area with a specific positive observation
- Sentence 2: Give one clear, actionable focus for the next session targeting the weakest area
- Use cricket-specific language (crease, nets, line and length, etc.)
- Sound like a real coach, not a robot
- Do NOT use bullet points or headers — just 2 plain sentences
- 60 words max total`;

      const aiResp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: insightPrompt }],
          max_tokens: 120,
        }),
      });

      if (!aiResp.ok) {
        return new Response(JSON.stringify({ error: 'AI service error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const aiData = await aiResp.json();
      const insight = aiData.choices?.[0]?.message?.content?.trim() || '';
      return new Response(JSON.stringify({ insight }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'analytics_improvement') {
      // Analytics tab: player describes a struggle → AI gives advice + 3 specific drill recommendations
      const ctx = performanceContext || '';

      const improvPrompt = `You are an elite cricket performance coach. A player has shared their performance data and a specific struggle they want to improve.

${ctx ? `Player's recent performance context: ${ctx}\n\n` : ''}Player's struggle: "${struggle}"

Provide a structured response as valid JSON with this exact shape:
{
  "advice": "2-4 sentence coaching advice that directly addresses their struggle with specific technical cues",
  "drills": [
    {
      "name": "Drill name (5 words max)",
      "pillar": "Technical | Mental | Physical | Tactical",
      "description": "How to perform this drill in 2 sentences",
      "why": "Exactly how this drill fixes their specific struggle (1 sentence)"
    }
  ]
}

Return EXACTLY 3 drills. Use only cricket-specific drills. Drills must directly target the stated struggle. Return ONLY the JSON, no markdown, no extra text.`;

      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: improvPrompt }],
          max_tokens: 600,
        }),
      });

      if (!aiResponse.ok) {
        return new Response(JSON.stringify({ error: 'AI service error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { advice: content, drills: [] };
        return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({ advice: content, drills: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (mode === 'struggle_tip') {
      // Quick in-session AI tip: player describes what they struggled with → AI gives one actionable improvement tip
      prompt = `You are an elite cricket performance coach giving instant, practical advice.

A player just finished a ${sessionKind || 'cricket'} training session.
${objective ? `Their session objective was: "${objective}"` : ''}
They struggled with: "${struggle}"

Give them ONE specific, actionable improvement tip for next time. Be direct, encouraging, and concise (3–5 sentences max). Use cricket-specific language. Focus only on what they can actively do differently next session.`;

      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
        }),
      });

      if (!aiResponse.ok) {
        return new Response(JSON.stringify({ error: 'AI service error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const aiData = await aiResponse.json();
      const tip = aiData.choices?.[0]?.message?.content || 'Keep working on it — consistency is key. Review the drill basics and focus on one small adjustment next session.';
      return new Response(JSON.stringify({ tip }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'questions') {
      // Generate 4 coaching questions based on position and what was logged
      const statSummary = buildStatSummary(position, stats);

      prompt = `You are an elite cricket performance coach. A ${position} just completed a ${sessionType} session with the following stats:
${statSummary}

Generate EXACTLY 4 specific, insightful coaching questions to help them reflect on their performance. 
- Questions should be directly related to their position (${position}) and the stats they logged
- Each question should focus on a different aspect: technique, mental approach, tactical awareness, and physical/fitness
- Keep questions concise (under 20 words each)
- Make them feel personalised and professional

Return ONLY a JSON array of 4 strings. No extra text. Example:
["Question 1?", "Question 2?", "Question 3?", "Question 4?"]`;
    } else {
      // mode === 'analysis' — generate AI coaching report from log data + answers
      const { logs, memberName, answers } = stats;

      const logSummary = (logs || []).slice(0, 20).map((l: any) => {
        const parts = [`Date: ${l.log_date}`, `Type: ${l.session_type}`, `Duration: ${l.duration_minutes}min`, `Intensity: ${l.intensity}/10`];
        if (l.balls_faced) parts.push(`Balls faced: ${l.balls_faced}`);
        if (l.runs_scored !== undefined && l.runs_scored > 0) parts.push(`Runs: ${l.runs_scored}`);
        if (l.balls_bowled) parts.push(`Balls bowled: ${l.balls_bowled}`);
        if (l.wickets !== undefined && l.wickets > 0) parts.push(`Wickets: ${l.wickets}`);
        if (l.catches) parts.push(`Catches: ${l.catches}`);
        if (l.technical_rating) parts.push(`Technical self-rating: ${l.technical_rating}/5`);
        if (l.effort_rating) parts.push(`Effort self-rating: ${l.effort_rating}/5`);
        if (l.notes) parts.push(`Notes: ${l.notes}`);
        return parts.join(', ');
      }).join('\n');

      const answerSection = answers && answers.length > 0
        ? `\n\nPlayer Reflection Answers:\n${answers.map((a: any) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}`
        : '';

      prompt = `You are an expert cricket coach. Analyse the following training history for ${memberName || 'this player'} (${position}) and provide a structured coaching report.

Training History (${(logs || []).length} sessions):
${logSummary}${answerSection}

Write a coaching report with these sections:
**Training Consistency** — frequency, volume, intensity trends
**Key Strengths** — what they are doing well
**Areas to Improve** — specific weaknesses from the data
**Next 2 Weeks Plan** — 3 concrete action points

Keep it under 280 words. Use bullet points. Be specific and encouraging. Cricket terminology only.`;
    }

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: mode === 'questions' ? 200 : 500,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error('AI error:', err);
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '';

    if (mode === 'questions') {
      try {
        // Extract JSON array from response
        const match = content.match(/\[[\s\S]*\]/);
        const questions = match ? JSON.parse(match[0]) : getFallbackQuestions(position);
        return new Response(JSON.stringify({ questions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({ questions: getFallbackQuestions(position) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      return new Response(JSON.stringify({ report: content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function buildStatSummary(position: string, stats: any): string {
  const parts: string[] = [`Duration: ${stats.duration_minutes || 60}min`, `Intensity: ${stats.intensity || 5}/10`, `Session type: ${stats.session_type || 'Training'}`];
  if (['Batsman', 'All-Rounder', 'Wicket-Keeper'].includes(position)) {
    if (stats.balls_faced) parts.push(`Balls faced: ${stats.balls_faced}`);
    if (stats.runs_scored !== undefined) parts.push(`Runs scored: ${stats.runs_scored}`);
    if (stats.balls_faced && stats.runs_scored !== undefined) {
      parts.push(`Strike rate: ${Math.round((stats.runs_scored / stats.balls_faced) * 100)}`);
    }
  }
  if (['Bowler', 'All-Rounder'].includes(position)) {
    if (stats.balls_bowled) parts.push(`Balls bowled: ${stats.balls_bowled} (${Math.floor(stats.balls_bowled / 6)}.${stats.balls_bowled % 6} overs)`);
    if (stats.wickets !== undefined) parts.push(`Wickets: ${stats.wickets}`);
    if (stats.runs_conceded !== undefined) parts.push(`Runs conceded: ${stats.runs_conceded}`);
  }
  if (['Fielder', 'All-Rounder', 'Wicket-Keeper'].includes(position)) {
    if (stats.catches) parts.push(`Catches: ${stats.catches}`);
    if (stats.run_outs) parts.push(`Run outs: ${stats.run_outs}`);
    if (stats.stumpings) parts.push(`Stumpings: ${stats.stumpings}`);
  }
  return parts.join(', ');
}

function getFallbackQuestions(position: string): string[] {
  if (position === 'Bowler') {
    return [
      'How was your line and length control today?',
      'Did you maintain your rhythm throughout the session?',
      'How did you adapt when batters were playing well?',
      'How was your physical stamina and recovery between overs?',
    ];
  }
  if (['Fielder'].includes(position)) {
    return [
      'How sharp was your concentration during fielding drills?',
      'Were you proactive in your movement and positioning?',
      'How confident were you in your throwing accuracy?',
      'How did you handle any errors mentally during the session?',
    ];
  }
  // Default batsman/all-rounder questions
  return [
    'How well did you judge which balls to attack vs defend?',
    'Describe your footwork and balance at the crease today.',
    'How did you handle any difficult deliveries or pressure moments?',
    'What specific technical aspect did you focus on improving?',
  ];
}
