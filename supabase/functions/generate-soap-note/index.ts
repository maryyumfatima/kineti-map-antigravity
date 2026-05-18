import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transcript, patient_id, booking_id, clinic_id } = await req.json()

    if (!transcript?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Transcript content is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!patient_id) {
      return new Response(
        JSON.stringify({ error: 'Patient ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: 'Clinic ID is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

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

    // Check clinic feature flags and credits
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('ai_soap_enabled, ai_credits_used, ai_credits_limit')
      .eq('id', clinic_id)
      .single()

    if (clinicError || !clinic) {
      return new Response(
        JSON.stringify({ error: 'Clinic not found or database access error' }),
        { status: 404, headers: corsHeaders }
      )
    }

    if (!clinic.ai_soap_enabled) {
      return new Response(
        JSON.stringify({ error: 'AI SOAP is not enabled for this clinic' }),
        { status: 403, headers: corsHeaders }
      )
    }

    const creditsUsed = clinic.ai_credits_used || 0
    const creditsLimit = clinic.ai_credits_limit || 0

    if (creditsUsed >= creditsLimit) {
      return new Response(
        JSON.stringify({ error: 'AI credit limit reached. Please contact clinic admin.' }),
        { status: 402, headers: corsHeaders }
      )
    }

    // Fetch patient context
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('full_name, date_of_birth, primary_complaint, referral_source, is_minor')
      .eq('id', patient_id)
      .single()

    if (patientError || !patient) {
      return new Response(
        JSON.stringify({ error: 'Patient not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Fetch last 5 SOAP notes for this patient (newest first)
    const { data: priorNotes, error: notesError } = await supabase
      .from('soap_notes')
      .select('id, created_at, subjective, objective, assessment, plan, booking_id')
      .eq('patient_id', patient_id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (notesError) {
      console.error('Notes fetch error:', notesError)
    }

    // Reverse so oldest is first in the prompt (chronological trajectory)
    const orderedNotes = (priorNotes || []).reverse()

    // Fetch pain_data from bookings linked to those notes
    const bookingIds = orderedNotes.map(n => n.booking_id).filter(Boolean)
    let painByBooking: Record<string, any> = {}

    if (bookingIds.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, appointment_time, pain_data')
        .in('id', bookingIds)

      if (bookingsError) {
        console.error('Bookings fetch error:', bookingsError)
      } else {
        painByBooking = Object.fromEntries(
          (bookings || []).map(b => [b.id, b.pain_data])
        )
      }
    }

    // Build patient context string
    const age = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null

    let patientContext = `PATIENT CONTEXT:
- Name: ${patient.full_name}
- Age: ${age ?? 'Not recorded'}${patient.is_minor ? ' (MINOR — guardian present)' : ''}
- Primary complaint: ${patient.primary_complaint ?? 'Not recorded'}
- Referral: ${patient.referral_source ?? 'Not recorded'}
`

    function getPainScoreText(painData: any) {
      if (!painData) return ''
      if (typeof painData.score === 'number') return `Pain ${painData.score}/10. `
      if (typeof painData.pain_after === 'number') return `Pain ${painData.pain_after}/10. `
      if (typeof painData.pain_before === 'number') return `Pain ${painData.pain_before}/10. `
      const values = Object.values(painData).filter(v => typeof v === 'number') as number[]
      if (values.length > 0) {
        return `Pain ${Math.max(...values)}/10. `
      }
      return ''
    }

    if (orderedNotes.length === 0) {
      patientContext += '\nNO PRIOR SOAP NOTES — this appears to be the first documented session.\n'
    } else {
      patientContext += `\nSESSION TRAJECTORY (${orderedNotes.length} prior session${orderedNotes.length > 1 ? 's' : ''}, oldest first):\n`

      // Older notes (truncated)
      const older = orderedNotes.slice(0, -1)
      older.forEach((note, idx) => {
        const date = new Date(note.created_at).toLocaleDateString('en-GB')
        const painLine = getPainScoreText(painByBooking[note.booking_id])
        patientContext += `\nSession ${idx + 1} (${date}): ${painLine}
  S: ${(note.subjective || '').slice(0, 200)}
  A: ${(note.assessment || '').slice(0, 200)}
  P: ${(note.plan || '').slice(0, 200)}
`
      })

      // Most recent note (full details)
      const last = orderedNotes[orderedNotes.length - 1]
      const lastDate = new Date(last.created_at).toLocaleDateString('en-GB')
      const lastPainLine = getPainScoreText(painByBooking[last.booking_id])
      patientContext += `\nMOST RECENT FULL NOTE (${lastDate}): ${lastPainLine}
  S: ${last.subjective || ''}
  O: ${last.objective || ''}
  A: ${last.assessment || ''}
  P: ${last.plan || ''}
`
    }

    // Construct Groq System Prompt
    const systemPrompt = `You are a physiotherapy clinical documentation assistant for UK-based clinics.
Your job is to format session content into structured SOAP notes and surface
continuity with prior sessions where relevant.

CLINICAL RULES:
1. Use UK English spelling and clinical terminology (e.g., "programme", "mobilisation").
2. You do NOT diagnose. Use language like "consistent with", "suggestive of", "consider".
3. You assist; the clinician edits and signs off.

OUTPUT FORMAT:
Return strict JSON with exactly these keys (no extra text, no markdown fences, no conversational greetings):
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "continuity_notes": "..."
}

CONTINUITY_NOTES FIELD RULES:
- ONLY populate this if prior sessions exist in the context below.
- Use it for: pain trend observations (improving/plateau/regressing), noted compliance issues with previous plans, changes in assessment, or trajectory flags (e.g. >6 sessions without measurable improvement).
- Keep it under 150 words. Bullet-point style is fine.
- If nothing notable about continuity, return an empty string for this field.
- DO NOT repeat content from S/O/A/P here — this field is for cross-session insight only.`

    const userPrompt = `${patientContext}

TODAY'S DICTATION/TRANSCRIPT:
"${transcript}"`

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1536,
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      throw new Error(`Groq API request failed: ${errorText}`)
    }

    const groqData = await groqResponse.json()
    const responseText = groqData.choices[0]?.message?.content

    if (!responseText) {
      throw new Error('Groq returned an empty response')
    }

    // Parse Groq JSON response safely
    let parsedNote: {
      subjective: string
      objective: string
      assessment: string
      plan: string
      continuity_notes?: string
    }

    try {
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedNote = JSON.parse(cleanedText)
    } catch (parseErr) {
      console.error('Failed to parse Groq response as JSON. Response:', responseText)
      throw new Error('Groq response format is invalid. Please try generating again.')
    }

    // Deduct/track credit count for the clinic
    const { error: creditUpdateError } = await supabase
      .from('clinics')
      .update({ ai_credits_used: creditsUsed + 1 })
      .eq('id', clinic_id)

    if (creditUpdateError) {
      console.error('Failed to update clinic credits used:', creditUpdateError)
    }

    // Write draft to public.ai_soap_drafts table
    const draftPayload = {
      booking_id: booking_id || null,
      clinic_id: clinic_id,
      patient_id: patient_id,
      draft_subjective: parsedNote.subjective,
      draft_objective: parsedNote.objective,
      draft_assessment: parsedNote.assessment,
      draft_plan: parsedNote.plan,
      draft_continuity_notes: parsedNote.continuity_notes || '',
      accepted: false
    }

    const { data: draftData, error: draftInsertError } = await supabase
      .from('ai_soap_drafts')
      .insert([draftPayload])
      .select('id')
      .single()

    if (draftInsertError) {
      console.error('Database draft insert error:', draftInsertError)
      throw new Error(`Failed to save AI SOAP draft to DB: ${draftInsertError.message}`)
    }

    return new Response(
      JSON.stringify({
        draft_id: draftData.id,
        subjective: parsedNote.subjective,
        objective: parsedNote.objective,
        assessment: parsedNote.assessment,
        plan: parsedNote.plan,
        continuity_notes: parsedNote.continuity_notes || ''
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Error in generate-soap-note:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
