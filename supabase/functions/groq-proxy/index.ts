/// <reference lib="deno.ns" />

Deno.serve(async (req: Request) => {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, model, temperature, max_tokens, type, audioUrl, language } = await req.json()

    // Handle Whisper transcription
    if (type === 'transcribe' && audioUrl) {
      // Download audio from Storage URL
      const audioResponse = await fetch(audioUrl)
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch audio file from storage')
      }

      const audioBlob = await audioResponse.blob()

      // Create FormData for Groq Whisper API
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      formData.append('model', 'whisper-large-v3')
      if (language) formData.append('language', language)
      formData.append('response_format', 'json')

      const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      })

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text()
        throw new Error(`Groq Whisper API error: ${errorText}`)
      }

      const transcriptionData = await whisperResponse.json()
      
      return new Response(
        JSON.stringify({ 
          text: transcriptionData.text,
          language: transcriptionData.language || language 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } 
    
    // Handle text generation (SOAP notes)
    else {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a professional multilingual physiotherapy clinical assistant.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: temperature || 0.3,
          max_tokens: max_tokens || 1024,
        }),
      })

      const data = await groqResponse.json()

      if (!data.choices?.[0]) {
        throw new Error('Invalid response from Groq')
      }

      return new Response(
        JSON.stringify({
          content: data.choices[0].message.content,
          model: data.model,
          usage: data.usage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (err: any) {
    const error = err as Error
    console.error('Groq Proxy Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})