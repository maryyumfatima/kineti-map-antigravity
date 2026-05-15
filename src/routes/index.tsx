import { createFileRoute, redirect } from '@tanstack/react-router'

async function detectCountry() {
  try {
    // 1. Try IP-based geolocation first (most accurate)
    const res = await fetch('https://get.geojs.io/v1/ip/country.json')
    if (!res.ok) throw new Error('Geo API failed')
    const data = await res.json()
    const countryCode = data.country?.toLowerCase()
    
    // Validate against supported countries
    if (['pk', 'au', 'gb'].includes(countryCode)) {
      return countryCode
    }
    
    // Default if country is not supported
    return 'gb'
  } catch (e) {
    console.warn('IP geolocation failed, falling back to timezone:', e)
    // 2. Fallback to timezone check
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz.includes('Karachi') || tz.includes('Lahore')) return 'pk'
      if (tz.includes('Australia')) return 'au'
      return 'gb'
    } catch {
      return 'gb'
    }
  }
}

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const country = await detectCountry()
    throw redirect({
      to: '/login',
    })
  },
  component: () => null,
})
