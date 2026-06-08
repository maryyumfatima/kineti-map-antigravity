// supabase/functions/send-whatsapp/index.ts
// Supabase Edge Function — WhatsApp Cloud API Sender
//
// Reads secrets from Supabase Vault / Edge Function environment:
//   WHATSAPP_PHONE_NUMBER_ID   — from Meta Developer Console
//   WHATSAPP_ACCESS_TOKEN      — permanent system user token
//   WHATSAPP_API_VERSION       — e.g. "v21.0" (default)
//   SUPABASE_URL               — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY  — auto-injected by Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendPayload {
  to: string
  type: 'text' | 'template'
  textBody?: string
  template?: {
    templateName: string
    languageCode?: string
    parameters?: string[]
  }
  patientId?: string
  clinicId?: string
  messageType?: string
  context_type?: string
  context_booking_id?: string
  messageId?: string
  retryCount?: number
  maxRetries?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip non-digit characters so Meta accepts the number */
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Build the Meta Graph API request body */
function buildRequestBody(payload: SendPayload): Record<string, unknown> {
  const to = normalisePhone(payload.to)

  if (payload.type === 'text') {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: payload.textBody ?? '' },
    }
  }

  // Template message
  const { templateName, languageCode = 'en', parameters } = payload.template!
  const components = parameters && parameters.length > 0
    ? [{
        type: 'body',
        parameters: parameters.map((p) => ({ type: 'text', text: p })),
      }]
    : undefined

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const ACCESS_TOKEN    = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const API_VERSION     = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v21.0'

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp credentials not configured in Edge Function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: SendPayload = await req.json()

    if (!payload.to) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Call Meta Cloud API
    const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`
    const body   = buildRequestBody(payload)

    console.log('[send-whatsapp] Sending to:', normalisePhone(payload.to), '| type:', payload.type)

    const metaRes = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })

    const metaJson = await metaRes.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!metaRes.ok) {
      console.error('[send-whatsapp] Meta API error:', JSON.stringify(metaJson))
      const errorCode = metaJson?.error?.code || metaRes.status
      
      if (payload.messageId) {
        let nextStatus = 'failed'
        let failureReason = `${errorCode}`
        const currentRetry = payload.retryCount ?? 0
        const maxRetries = payload.maxRetries ?? 3
        let nextRetryAt = null
        let newRetryCount = currentRetry

        if (errorCode === 131026) {
          nextStatus = 'failed'
          failureReason = '131026_invalid_phone'
        } else if (errorCode === 131056 || errorCode === 500 || metaRes.status >= 500) {
          if (currentRetry >= maxRetries) {
            nextStatus = 'failed'
          } else {
            nextStatus = 'retry_pending'
            newRetryCount = currentRetry + 1
            nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
          }
        }

        await supabase.from('whatsapp_messages').update({
          status: nextStatus,
          failure_reason: failureReason,
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt
        }).eq('id', payload.messageId)
      }

      throw new Error(`Meta API error ${metaRes.status}: ${JSON.stringify(metaJson?.error ?? metaJson)}`)
    }

    const metaMessageId: string = metaJson?.messages?.[0]?.id ?? 'unknown'
    console.log('[send-whatsapp] Sent successfully. Meta message ID:', metaMessageId)

    // 2. Log to whatsapp_messages table (best-effort — don't fail the request on DB error)
    if (payload.messageId) {
      // Update existing queue item
      await supabase.from('whatsapp_messages').update({
        status: 'sent',
        meta_message_id: metaMessageId
      }).eq('id', payload.messageId)
    } else if (payload.patientId && payload.clinicId) {
      // Insert new log for synchronous calls
      const { error: logErr } = await supabase.from('whatsapp_messages').insert({
        patient_id:       payload.patientId,
        clinic_id:        payload.clinicId,
        message_type:     payload.messageType ?? (payload.type === 'template' ? payload.template?.templateName : 'text'),
        status:           'sent',
        scheduled_for:    new Date().toISOString(),
        template_name:    payload.type === 'template' ? payload.template?.templateName : null,
        template_params:  payload.type === 'template' && payload.template?.parameters
          ? payload.template.parameters
          : null,
        meta_message_id:  metaMessageId,
        context_type:     payload.context_type,
        context_booking_id: payload.context_booking_id
      })

      if (logErr) {
        console.warn('[send-whatsapp] DB log error (non-fatal):', logErr.message)
      }
    }

    return new Response(
      JSON.stringify({ success: true, messageId: metaMessageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[send-whatsapp] Unhandled error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
