// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  to: string
  subject: string
  body: string
  clinic_id?: string
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json() as EmailPayload
    const { to, subject, body, clinic_id } = payload

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }

    // Call Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'KinetiMap <noreply@kinetimap.app>',
        to,
        subject,
        html: body,
      }),
    })

    const resData = await res.json()

    const isSuccess = res.ok

    // Log the email in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          to,
          subject,
          status: isSuccess ? 'sent' : 'failed',
          clinic_id: clinic_id ?? null,
        })

      if (logError) {
        console.error('[send-email] Failed to log email to DB:', logError)
      }
    }

    if (!isSuccess) {
      console.error('[send-email] Resend API error:', resData)
      return new Response(JSON.stringify({ success: false, error: resData }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, data: resData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[send-email] Unhandled error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
