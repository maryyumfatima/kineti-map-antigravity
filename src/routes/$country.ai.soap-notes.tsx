// Recording with compression + time limit
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Use Opus codec for better compression
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus' }
      : { mimeType: 'audio/webm' }

    const mediaRecorder = new MediaRecorder(stream, options)
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(chunksRef.current, { type: options.mimeType })
      await transcribeAudioBlob(audioBlob)
      stream.getTracks().forEach(track => track.stop())
    }

    mediaRecorder.start()
    setIsRecording(true)
    toast.success('Recording started')

    // Auto-stop after 5 minutes (safety limit)
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        stopRecording()
        toast.warning('Recording stopped automatically after 5 minutes')
      }
    }, 300000) // 5 minutes

  } catch (error) {
    console.error('Recording error:', error)
    toast.error('Could not access microphone')
  }
}

// Optimized transcription using Storage + FormData
const transcribeAudioBlob = async (audioBlob: Blob) => {
  setIsTranscribing(true)
  try {
    // Step 1: Upload to Supabase Storage
    const fileName = `audio-${Date.now()}.webm`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('temp-audio')
      .upload(fileName, audioBlob, {
        contentType: audioBlob.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    // Step 2: Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('temp-audio')
      .getPublicUrl(fileName)

    // Step 3: Call edge function with URL (not base64)
    const { data, error } = await supabase.functions.invoke('groq-proxy', {
      body: {
        type: 'transcribe',
        audioUrl: publicUrl, // Send URL instead of base64
        language: selectedLanguage
      }
    })

    if (error) throw error

    const transcribedText = data.text || ''
    setAdditionalNotes(transcribedText)
    toast.success('Audio transcribed successfully')

    // Step 4: Delete temp file from storage
    await supabase.storage.from('temp-audio').remove([fileName])

    // Auto-generate SOAP note
    await generateFromAudio(transcribedText)

  } catch (error: any) {
    console.error('Transcription error:', error)
    toast.error(error.message || 'Failed to transcribe audio')
  } finally {
    setIsTranscribing(false)
  }
}

// File upload handler (same optimization)
const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('audio/')) {
    toast.error('Please upload an audio file')
    return
  }

  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    toast.error('Audio file too large. Maximum 10MB allowed.')
    return
  }

  await transcribeAudioBlob(file)
}