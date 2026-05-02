import { useState, useRef } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void
  language?: string
}

export function AudioRecorder({ onTranscriptionComplete, language = 'en' }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await processAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Recording error:', error)
      alert('Could not access microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)
    try {
      const { transcribeAudio } = await import('../lib/groq')
      const transcription = await transcribeAudio(audioBlob, language)
      onTranscriptionComplete(transcription)
    } catch (error) {
      console.error('Transcription error:', error)
      alert('Failed to transcribe audio')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {!isRecording && !isProcessing && (
        <button
          onClick={startRecording}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-all active:scale-95"
        >
          <Mic className="w-5 h-5" />
          Record Session Notes
        </button>
      )}

      {isRecording && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-medium animate-pulse"
        >
          <Square className="w-5 h-5" />
          Stop Recording
        </button>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Transcribing audio...</span>
        </div>
      )}
    </div>
  )
}