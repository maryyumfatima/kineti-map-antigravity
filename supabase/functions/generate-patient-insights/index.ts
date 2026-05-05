import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://kinetimap.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { patientId, clinicId } = await req.json()

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Verify user has access to this clinic
    const { data: { user } } = await supabase.auth.getUser()
    const { data: clinicUser } = await supabase
      .from('clinic_users')
      .select('clinic_id')
      .eq('auth_user_id', user.id)
      .eq('clinic_id', clinicId)
      .single()

    if (!clinicUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to clinic' }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Fetch patient session history
    const { data: sessions, error: sessionsError } = await supabase
      .from('bookings')
      .select(`
        *,
        session_notes (*)
      `)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .order('appointment_time', { ascending: false })
      .limit(10)

    if (sessionsError || !sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          summary: 'No completed sessions found for analysis.',
          observations: [],
          riskFlags: [],
          recommendations: ['Schedule initial assessment']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build context for AI
    const sessionSummary = sessions.map(s => ({
      date: new Date(s.appointment_time).toLocaleDateString(),
      painBefore: s.pain_data?.pain_before || 'Not recorded',
      painAfter: s.pain_data?.pain_after || 'Not recorded',
      bodyParts: s.pain_data?.body_parts || [],
      treatments: s.pain_data?.treatments || [],
      duration: s.duration_minutes,
      notes: s.session_notes?.[0]?.note_text || 'No notes'
    }))

    const prompt = `You are a physiotherapy clinical analyst. Based on this patient's last ${sessions.length} sessions, provide:

1. Progress Summary (2-3 sentences about overall trend)
2. Key Observations (3-5 bullet points about patterns)
3. Risk Flags (any concerns like increasing pain, poor attendance, plateauing progress)
4. Recommended Next Steps (2-3 actionable treatment suggestions)

Session History (most recent first):
${JSON.stringify(sessionSummary, null, 2)}

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "observations": ["string", "string"],
  "riskFlags": ["string"],
  "recommendations": ["string", "string"]
}

Do not include any markdown formatting or code blocks.`

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    })

    if (!groqResponse.ok) {
      throw new Error('Groq API request failed')
    }

    const data = await groqResponse.json()
    const responseText = data.choices[0].message.content
    
    // Clean up response (remove markdown if present)
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const insights = JSON.parse(cleanedText)

    return new Response(
      JSON.stringify(insights),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
