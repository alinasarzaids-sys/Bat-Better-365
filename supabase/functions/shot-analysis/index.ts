import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mediaUrl, mimeType, shotContext, isVideo } = await req.json();

    if (!imageBase64 && !mediaUrl) {
      return new Response(
        JSON.stringify({ error: 'Media data or URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contextLine = shotContext ? `The player mentioned: "${shotContext}".\n` : '';
    const mediaLabel = isVideo ? 'video clip' : 'image/screenshot';

    // ── Step 1: Resolve final base64 + mime BEFORE building the content array ──
    // For videos: fetch from Supabase Storage URL (avoids 413 on request body)
    // For images: use the base64 passed directly from the client
    let finalBase64 = imageBase64 || '';
    let finalMime = mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

    if (mediaUrl && !imageBase64) {
      console.log('Fetching media from storage URL...');
      const mediaResp = await fetch(mediaUrl);
      if (!mediaResp.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch media from URL: ${mediaResp.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const contentType = mediaResp.headers.get('content-type') || mimeType || 'video/mp4';
      finalMime = contentType;
      const arrayBuffer = await mediaResp.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      finalBase64 = btoa(binary);
      console.log(`Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB from storage`);
    }

    // ── Step 2: Build the AI prompt ──────────────────────────────────────────
    const systemPrompt = `You are an elite cricket batting coach and biomechanics expert with 20+ years of experience coaching international batters. You analyse batting ${mediaLabel}s with precision and provide highly actionable, structured feedback.

Your analysis must always follow this exact JSON structure:
{
  "shotType": "Name of the shot being played (e.g. Cover Drive, Pull Shot, Sweep Shot, Defensive Block)",
  "overallScore": <number 1-10>,
  "wentWell": ["point 1", "point 2", "point 3"],
  "improvements": [
    {
      "issue": "Short description of the issue",
      "detail": "Why this matters and how it affects performance",
      "fix": "Specific actionable drill or technique tip to fix it"
    }
  ],
  "keyFocus": "The single most important thing to work on right now",
  "demoTip": "A vivid mental image or cue the player can visualise to instantly feel the correct technique",
  "encouragement": "A short motivating message personalised to what you see"
}

Be specific to cricket batting. Reference actual body parts (front elbow, back foot, head position, weight transfer, follow-through, etc.). Keep wentWell to 2-4 points. Keep improvements to 2-3 points maximum. Output ONLY valid JSON, no markdown fences.`;

    // ── Step 3: Build content array (finalBase64 + finalMime are now initialised) ──
    const mediaContent = isVideo
      ? {
          type: 'video_url',
          video_url: { url: `data:${finalMime};base64,${finalBase64}` }
        }
      : {
          type: 'image_url',
          image_url: { url: `data:${finalMime};base64,${finalBase64}` }
        };

    const userContent = [
      {
        type: 'text',
        text: `${contextLine}Please analyse this batting ${mediaLabel} and provide structured feedback. ${isVideo ? 'Focus on the key moment of shot execution visible in the clip — footwork, backswing, contact point, follow-through, and head position.' : ''}`
      },
      mediaContent
    ];

    console.log(`Calling OnSpace AI for shot analysis (${isVideo ? 'video' : 'image'}, mime: ${finalMime})...`);

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OnSpace AI error:', errorText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    let analysisResult;
    try {
      const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      analysisResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse AI JSON:', rawContent);
      return new Response(
        JSON.stringify({ raw: rawContent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ analysis: analysisResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in shot-analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
