import { supabase } from './supabase'

// Text-based SOAP note generation
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

Generate in ${tags.language || 'English'}.`

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      prompt,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1024
    }
  })

  if (error) throw new Error(error.message || 'Failed to generate SOAP note')

  return data.content || ''
}

// Audio transcription using Whisper
export async function transcribeAudio(audioBlob: Blob, language?: string) {
  // Convert blob to base64
  const base64Audio = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(audioBlob)
  })

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      type: 'transcribe',
      audioFile: base64Audio,
      language: language || 'en' // 'en', 'ur', 'fr', 'nl', 'ar', etc.
    }
  })

  if (error) throw new Error(error.message || 'Failed to transcribe audio')

  return data.text || ''
}

// Generate SOAP note from audio transcription
export async function generateSoapNoteFromAudio(transcribedText: string, language?: string) {
  const prompt = `You are a physiotherapy clinical assistant. A practitioner has dictated the following session notes. Generate a professional SOAP note from this dictation.

Dictation: "${transcribedText}"

Generate a structured SOAP note with:
- Subjective (S): Patient complaints
- Objective (O): Clinical findings
- Assessment (A): Clinical reasoning
- Plan (P): Treatment plan

Respond in ${language || 'English'}.`

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      prompt,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1024
    }
  })

  if (error) throw new Error(error.message || 'Failed to generate SOAP note')

  return data.content || ''
}

// Pain summary
export async function generatePainSummary(scores: number[]) {
  const prompt = `You are a physiotherapy clinical analyst. Based on these pain scores over sessions, write a brief 3-4 sentence clinical summary of the patient's progress trend. Be professional and objective.

Pain Scores over last 10 sessions (oldest to newest): ${scores.join(', ')}`

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      prompt,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 512
    }
  })

  if (error) throw new Error(error.message || 'Failed to generate pain summary')

  return data.content || ''
}