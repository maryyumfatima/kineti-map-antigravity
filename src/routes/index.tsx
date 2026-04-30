import { createFileRoute, redirect } from '@tanstack/react-router'

const TZ_COUNTRY: Record<string, string> = {
  'Asia/Karachi': 'pk',
  'Asia/Lahore': 'pk',
  'Australia/Sydney': 'au',
  'Europe/London': 'gb',
}

function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TZ_COUNTRY[tz] || 'gb'
  } catch {
    return 'gb'
  }
}

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const country = detectCountry()
    throw redirect({
      to: '/$country/login',
      params: { country },
    })
  },
  component: () => null,
})
