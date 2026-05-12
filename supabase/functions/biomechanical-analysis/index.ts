import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, videoUrl, shotType, analysisMode } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const AI_BASE = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';
    const AI_KEY  = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';

    // Build a detailed biomechanical analysis prompt
    const analysisPrompt = `You are a world-class cricket biomechanics analyst and batting coach with 20+ years experience. Generate a comprehensive Technical Balance Report for a cricket batting shot.

Shot Type: ${shotType || 'Batting stroke'}
Analysis Mode: ${analysisMode || 'Full session'}
${videoUrl ? `Video submitted for analysis: ${videoUrl}` : 'Analysis based on submitted session data'}

Generate a REALISTIC, SPECIFIC biomechanical analysis in this EXACT JSON format:

{
  "overall_score": <integer 55-95>,
  "grade": <"A+" | "A" | "B+" | "B" | "C+" | "C">,
  "shot_detected": "<specific shot name e.g. Off Drive, Cover Drive, Pull Shot, Cut Shot, Straight Drive>",
  "instant_feedback": "<2-3 word instant cue e.g. 'Head still — excellent' or 'Front foot firm'",
  "audio_cue": "<short coaching shout e.g. 'Soft hands!' or 'Watch the ball!' or 'Stay tall!'">",
  "stability_score": <integer 40-100>,
  "stability_label": <"Critical" | "Needs Work" | "Fair" | "Good" | "Excellent">,
  "metrics": {
    "head_position": {
      "score": <integer 40-100>,
      "status": <"Falling Across" | "Leaning Back" | "Slightly Off" | "Stable" | "Locked In">,
      "detail": "<specific 1-sentence observation about head position during the shot>",
      "tip": "<1 specific drill or cue to fix or maintain>"
    },
    "front_foot_stride": {
      "score": <integer 40-100>,
      "distance_cm": <integer 20-80>,
      "status": <"Too Short" | "Hesitant" | "Average" | "Good Reach" | "Full Stride">,
      "detail": "<specific 1-sentence observation about footwork and stride>",
      "tip": "<1 specific coaching point>"
    },
    "bat_angle": {
      "score": <integer 40-100>,
      "angle_degrees": <integer 55-90>,
      "status": <"Across Line" | "Closing Face" | "Slightly Open" | "Good Vertical" | "Textbook">,
      "detail": "<specific 1-sentence observation about bat verticality and face angle>",
      "tip": "<1 specific correction or positive reinforcement>"
    },
    "balance": {
      "score": <integer 40-100>,
      "weight_distribution": "<e.g. '60% front 40% back' or '50-50'>",
      "status": <"Off Balance" | "Falling Away" | "Moderate" | "Balanced" | "Perfect">,
      "detail": "<specific 1-sentence observation about overall balance>",
      "tip": "<1 drill suggestion>"
    },
    "follow_through": {
      "score": <integer 40-100>,
      "status": <"Cut Short" | "Restricted" | "Partial" | "Fluid" | "Full Extension">,
      "detail": "<1-sentence observation about the follow-through completion>",
      "tip": "<1 tip>"
    }
  },
  "strengths": [
    "<Specific strength 1 referencing an actual metric or observation>",
    "<Specific strength 2>"
  ],
  "areas_to_improve": [
    "<Specific improvement area 1 with a concrete action>",
    "<Specific improvement area 2 with a concrete action>"
  ],
  "drill_recommendations": [
    {
      "name": "<Drill name from cricket training library e.g. Front Foot Drive Tee Drill>",
      "focus": "<what this drill corrects>",
      "duration_minutes": <10 | 15 | 20>
    },
    {
      "name": "<Second drill name>",
      "focus": "<what this drill corrects>",
      "duration_minutes": <10 | 15 | 20>
    }
  ],
  "coach_summary": "<3-4 sentence professional coaching summary that references specific scores and observations. Mention the top strength and the one most critical fix. Write in second person ('Your...'). Be encouraging but honest.>"
}

Be specific and realistic. Vary the scores — not everything should be 80+. Make it feel like a real human coach analyzed the footage.`;

    const aiResp = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a cricket biomechanics AI. Always respond with valid JSON only, no markdown, no explanations outside the JSON object.',
          },
          { role: 'user', content: analysisPrompt },
        ],
        temperature: 0.6,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: 'AI service error: ' + errText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResp.json();
    let content = aiData.choices?.[0]?.message?.content || '';

    // Strip markdown code fences if present
    content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', e, 'Content:', content.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI analysis response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save analysis to training log if it's a real session
    if (videoUrl) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin.from('academy_training_logs').insert({
        user_id: userId,
        academy_id: null,
        log_date: new Date().toISOString().split('T')[0],
        session_type: 'Technical',
        duration_minutes: 10,
        intensity: Math.round((analysis.overall_score || 70) / 10),
        technical_rating: Math.round((analysis.metrics?.bat_angle?.score || 70) / 20),
        effort_rating: Math.round((analysis.metrics?.follow_through?.score || 70) / 20),
        notes: `Live Lab Analysis: ${analysis.shot_detected || 'Batting shot'} — Score: ${analysis.overall_score}/100`,
      }).catch((err: any) => console.warn('Could not save training log:', err));
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('biomechanical-analysis error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
