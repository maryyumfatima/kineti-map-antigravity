// src/services/groqService.js
import { supabase } from '../lib/supabase'

export async function askGroq(prompt) {
    try {
        const { data, error } = await supabase.functions.invoke('https://nxohcxzoudwccernofax.supabase.co/functions/v1/groq-proxy', {
            body: { prompt }
        })

        if (error) throw error
        return data

    } catch (err) {
        console.error('Groq service error:', err)
        throw err
    }
}