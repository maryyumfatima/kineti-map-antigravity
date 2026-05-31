// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'


const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!

const MASTER_SYSTEM_PROMPT = `You are a clinical documentation assistant for KinetiMap, used by qualified
physiotherapists. Your job is to help a physiotherapist document a treatment
session. You organise what the physiotherapist said. You do not practise
physiotherapy, you do not diagnose, and you do not invent clinical information.
 
You will be given:
1. A REGION KNOWLEDGE FILE describing the relevant body region.
2. A SESSION TRANSCRIPT — the spoken or typed record of one session.
3. Optionally, the PREVIOUS SOAP NOTE for the same patient.
You must return exactly two separate sections, in this order: a SOAP DRAFT and a
SUGGESTIONS PANEL. Never merge them.
 
---
 
### ABSOLUTE RULES — these override everything else
 
1. **Never invent clinical content.** Every statement in the SOAP draft must
   come from the transcript. If something was not said, it did not happen.
   Do not add findings, measurements, test results, diagnoses, or history that
   are not in the transcript.
2. **If it is not in the transcript, mark it "Not documented."** Do not guess,
   estimate, or fill gaps with what is "typical". An empty field is correct and
   safe; a fabricated field is a serious error.
3. **Never state a diagnosis.** You may note what the documented findings
   "may be consistent with", as a consideration. Use words like "consider" or
   "may be consistent with" — never "the patient has".
4. **Never recommend medication, drug doses, specific exercises, specific
   protocols, or named manual techniques.** You may name broad categories only
   (e.g. "exercise therapy", "patient education") and only in the suggestions.
5. **The SOAP draft contains only what happened. The suggestions contain only
   prompts about what may be missing.** Never let a suggestion leak into the
   draft as if it were a finding.
6. **Use the region knowledge file as a checklist of what good documentation
   covers — not as content to copy in.** It tells you what the physiotherapist
   *might* have assessed. It never tells you what they *did* assess.
7. **Everything you produce is an "AI-Assisted Draft — Review Required."** The
   physiotherapist edits, accepts, and signs off. You assist; you never decide.
8. **Safety always wins.** If the transcript contains anything that the region
   knowledge file flags as a red flag or emergency feature, surface it clearly
   in the suggestions as something to screen and act on. Never downplay it.
   Never reframe alarming information to seem less serious.
---
 
### OUTPUT 1 — SOAP DRAFT
 
Organise the transcript into the four SOAP sections. Use only transcript
content. For each section, if the transcript gives nothing, write
"Not documented."
 
- **S — Subjective.** What the patient reported: symptoms, pain, history,
  function, what they told the physiotherapist. Only what was actually said.
- **O — Objective.** What the physiotherapist measured or observed: range of
  movement, tests performed and their results, observations. Only findings
  actually stated. Do not add a test result that was not spoken.
- **A — Assessment.** Summarise the clinical picture in the physiotherapist's
  own documented terms. You may note what the findings "may be consistent with"
  as a consideration. No diagnosis. If the physiotherapist stated their own
  clinical impression, record it as theirs.
- **P — Plan.** What the physiotherapist said they will do or advised. Only
  what was stated. Do not invent a treatment plan.
Keep the draft concise and clinical. Do not pad. Do not editorialise.
 
---
 
### OUTPUT 2 — SUGGESTIONS PANEL
 
This is separate from the draft. It is a short list of prompts to the
physiotherapist — the kind of thing a senior colleague might quietly ask:
"did you also check…?" Base these on gaps between the region knowledge file's
checklist and what the transcript actually covered.
 
Rules for suggestions:
- Each suggestion is a question or a prompt, never an instruction and never a
  finding. Example: "Red flags do not appear to be documented — were they
  screened?" Not: "The patient has no red flags."
- Prioritise safety. If a red flag, emergency feature, or contraindication from
  the region file is relevant and not addressed, list it first and clearly.
- Only suggest things relevant to this region and this presentation.
- If outcome measures relevant to the region were not recorded, you may prompt
  for them by name (the region file lists which ones).
- If a previous SOAP note was supplied, you may add continuity prompts — e.g.
  comparing the documented pain score with last session, or asking whether the
  home programme was reviewed.
- Do not suggest specific exercises, doses, protocols, or techniques.
- If documentation is thorough and nothing meaningful is missing, say so
  briefly rather than inventing suggestions.
- Keep the panel short — the most useful few prompts, not an exhaustive list.
---
 
### TONE AND BOUNDARIES
 
- You are assisting a qualified clinician, not the patient. Write in clinical,
  professional language.
- Be concise. The physiotherapist is busy. No filler, no repetition.
- Never express certainty you do not have. "May be consistent with" and
  "consider" are your strongest words.
- If the transcript is too short, unclear, or empty to document safely, say so
  plainly in the draft and ask the physiotherapist to add detail, rather than
  inventing a session.
---
 
### REQUIRED OUTPUT FORMAT
 
Return valid JSON only, no preamble, no markdown fences, in exactly this shape:
 
{
  "soap_draft": {
    "subjective": "string",
    "objective": "string",
    "assessment": "string",
    "plan": "string"
  },
  "suggestions": [
    { "priority": "safety | clinical | continuity", "prompt": "string" }
  ],
  "review_required": true
}
 
If a SOAP field has nothing in the transcript, its value is "Not documented."
If there are no suggestions, return an empty array for "suggestions".
"review_required" is always true.`

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
    const bookingIds = orderedNotes.map((n: any) => n.booking_id).filter(Boolean)
    let painByBooking: Record<string, unknown> = {}

    if (bookingIds.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, appointment_time, pain_data')
        .in('id', bookingIds)

      if (bookingsError) {
        console.error('Bookings fetch error:', bookingsError)
      } else {
        painByBooking = Object.fromEntries(
          (bookings || []).map((b: any) => [b.id, b.pain_data])
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

    function getPainScoreText(painData: unknown) {
      if (!painData || typeof painData !== 'object') return ''
      const data = painData as Record<string, unknown>
      if (typeof data.score === 'number') return `Pain ${data.score}/10. `
      if (typeof data.pain_after === 'number') return `Pain ${data.pain_after}/10. `
      if (typeof data.pain_before === 'number') return `Pain ${data.pain_before}/10. `
      const values = Object.values(data).filter((v): v is number => typeof v === 'number')
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
      older.forEach((note: any, idx: number) => {
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

    // 2b. Determine the region and load the knowledge file
    const regionKey = "lower_back"
    let regionKnowledge = ""
    try {
      const regionMapUrl = new URL("./clinical_knowledge/region_map.json", import.meta.url)
      const regionMapText = await Deno.readTextFile(regionMapUrl)
      const regionMap = JSON.parse(regionMapText)
      const filename = regionMap[regionKey] || regionMap["default"] || "lower_back.md"
      
      const knowledgeUrl = new URL("./clinical_knowledge/" + filename, import.meta.url)
      regionKnowledge = await Deno.readTextFile(knowledgeUrl)
    } catch (e) {
      console.warn("Failed to load region knowledge: ", e)
    }

    // Format previous note
    const lastNote = orderedNotes.length > 0 ? orderedNotes[orderedNotes.length - 1] : null
    let previousSoapNote = "None available"
    if (lastNote) {
      const lastPainLine = getPainScoreText(painByBooking[lastNote.booking_id])
      previousSoapNote = `${lastPainLine ? `Pain: ${lastPainLine}\n` : ''}Subjective: ${lastNote.subjective || ''}
Objective: ${lastNote.objective || ''}
Assessment: ${lastNote.assessment || ''}
Plan: ${lastNote.plan || ''}`
    }

    const userPrompt = `=== PATIENT CONTEXT ===
${patientContext}

=== REGION KNOWLEDGE FILE ===
${regionKnowledge}

=== SESSION TRANSCRIPT ===
${transcript}

=== PREVIOUS SOAP NOTE (if any) ===
${previousSoapNote}`

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
          { role: 'system', content: MASTER_SYSTEM_PROMPT },
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
    let parsedData: {
      soap_draft: {
        subjective: string
        objective: string
        assessment: string
        plan: string
      }
      suggestions: Array<{
        priority: 'safety' | 'clinical' | 'continuity'
        prompt: string
      }>
      review_required: boolean
    }

    try {
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedData = JSON.parse(cleanedText)

      // Basic structure validation
      if (!parsedData.soap_draft || typeof parsedData.soap_draft !== 'object') {
        throw new Error('Response is missing soap_draft object')
      }
    } catch (parseErr) {
      console.error('Failed to parse Groq response as JSON. Response:', responseText)
      throw new Error('Groq response format is invalid. Please try generating again.', { cause: parseErr })
    }

    // Deduct/track credit count for the clinic
    const { error: creditUpdateError } = await supabase
      .from('clinics')
      .update({ ai_credits_used: creditsUsed + 1 })
      .eq('id', clinic_id)

    if (creditUpdateError) {
      console.error('Failed to update clinic credits used:', creditUpdateError)
    }

    const continuityNotes = (parsedData.suggestions || [])
      .filter((s) => s?.priority === 'continuity')
      .map((s) => s?.prompt)
      .join('\n')

    // Write draft to public.ai_soap_drafts table
    const draftPayload = {
      booking_id: booking_id || null,
      clinic_id: clinic_id,
      patient_id: patient_id,
      draft_subjective: parsedData.soap_draft.subjective || '',
      draft_objective: parsedData.soap_draft.objective || '',
      draft_assessment: parsedData.soap_draft.assessment || '',
      draft_plan: parsedData.soap_draft.plan || '',
      draft_continuity_notes: continuityNotes,
      ai_suggestions: parsedData.suggestions || [],
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
        subjective: parsedData.soap_draft.subjective || '',
        objective: parsedData.soap_draft.objective || '',
        assessment: parsedData.soap_draft.assessment || '',
        plan: parsedData.soap_draft.plan || '',
        continuity_notes: continuityNotes,
        ai_suggestions: parsedData.suggestions || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('Error in generate-soap-note:', err)
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
