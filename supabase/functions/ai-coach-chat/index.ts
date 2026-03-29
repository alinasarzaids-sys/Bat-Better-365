import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare system prompt for cricket coaching
    const systemPrompt = `You are an expert cricket batting coach with years of experience training players at all levels. Your role is to:
- Provide technical advice on batting technique, footwork, and shot selection
- Recommend specific drills for skill improvement
- Create personalized training plans based on player needs
- Analyze performance and suggest areas for improvement
- Motivate and encourage players in their cricket journey

IMPORTANT RESTRICTIONS:
- ONLY answer questions about BATTING (technique, footwork, shot selection, mental approach, fitness for batting, etc.)
- Politely decline questions about bowling, fielding, wicket-keeping, or any other cricket skills
- If asked about non-batting topics, respond: "I specialize in batting coaching only. For questions about [topic], please consult a specialist coach in that area. Is there anything about your batting I can help you with?"

Keep responses concise, practical, and encouraging. Focus on actionable batting advice.`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Call OnSpace AI
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      console.error('OnSpace AI not configured:', { hasKey: !!apiKey, hasUrl: !!baseUrl });
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling OnSpace AI:', baseUrl);
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 500,
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
    const response = aiData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-coach-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
