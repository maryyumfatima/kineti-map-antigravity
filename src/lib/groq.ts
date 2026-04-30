import { supabase } from './supabase'

export async function generateSoapNote(tags: any) {
  const prompt = `You are a clinical physiotherapy assistant. Generate a professional SOAP note based on the following session data. Be concise, clinical, and use proper physiotherapy terminology. Format: Subjective / Objective / Assessment / Plan

Session Data:
- Body Parts: ${tags.bodyParts.join(', ') || 'None specified'}
- Treatments: ${tags.treatments.join(', ') || 'None specified'}
- Pain Score Before: ${tags.painBefore}/10
- Pain Score After: ${tags.painAfter}/10
- Session Duration: ${tags.duration} minutes
- Next Session: ${tags.nextSession}
- Additional Notes: ${tags.additionalNotes || 'None'}
`

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: { 
      prompt,
      model: 'llama3-70b-8192',
      temperature: 0.5,
      max_tokens: 1024
    }
  })

  if (error) {
    throw new Error(error.message || 'Failed to generate SOAP note')
  }

  // Handle different return formats (direct string or OpenAI-like response)
  return typeof data === 'string' ? data : data.choices?.[0]?.message?.content || data.content || ''
}

export async function generatePainSummary(scores: number[]) {
  const prompt = `You are a physiotherapy clinical analyst. Based on these pain scores over sessions, write a brief 3-4 sentence clinical summary of the patient's progress trend. Be professional and objective.

Pain Scores over last 10 sessions (oldest to newest): ${scores.join(', ')}`

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: { 
      prompt,
      model: 'llama3-70b-8192',
      temperature: 0.5,
      max_tokens: 512
    }
  })

  if (error) {
    throw new Error(error.message || 'Failed to generate pain summary')
  }

  return typeof data === 'string' ? data : data.choices?.[0]?.message?.content || data.content || ''
}
