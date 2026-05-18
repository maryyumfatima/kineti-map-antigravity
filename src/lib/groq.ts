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
export async function generateSoapNoteFromAudio(params: {
  transcript: string
  patient_id: string
  booking_id?: string | null
  clinic_id: string
}) {
  const { data, error } = await supabase.functions.invoke('generate-soap-note', {
    body: params
  })

  if (error) throw new Error(error.message || 'Failed to generate SOAP note')

  return data
}

// Patient insights (comprehensive AI report for profile page)
export async function generatePatientInsights(data: {
  patientName: string
  complaint: string
  totalSessions: number
  completedSessions: number
  avgPainBefore: number
  avgPainAfter: number
  painScores: number[]
  treatments: string[]
  attendanceRate: number
}) {
  const prompt = `You are a physiotherapy clinical analyst. Based on the following patient data, generate a comprehensive clinical insights report. Be professional, concise, and actionable.

Patient: ${data.patientName}
Primary Complaint: ${data.complaint}
Total Sessions: ${data.totalSessions} (${data.completedSessions} completed)
Average Pain Before Treatment: ${data.avgPainBefore}/10
Average Pain After Treatment: ${data.avgPainAfter}/10
Pain Score Trend (oldest to newest): ${data.painScores.join(', ')}
Common Treatments: ${data.treatments.join(', ') || 'Not recorded'}
Attendance Rate: ${data.attendanceRate}%

Respond in valid JSON with this exact structure (no markdown, no code fences):
{
  "progressSummary": "2-3 sentence clinical progress summary",
  "riskFlags": ["array of risk flags, empty if none"],
  "recommendations": ["array of 2-3 actionable next steps"],
  "trend": "improving" | "stable" | "declining"
}`

  const { data: result, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      prompt,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 512
    }
  })

  if (error) throw new Error(error.message || 'Failed to generate patient insights')

  try {
    return JSON.parse(result.content || '{}')
  } catch {
    return {
      progressSummary: result.content || 'Unable to parse insights.',
      riskFlags: [],
      recommendations: [],
      trend: 'stable'
    }
  }
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