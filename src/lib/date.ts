import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'

export const COUNTRY_TIMEZONES: Record<string, string> = {
  gb: 'Europe/London',
  pk: 'Asia/Karachi',
  au: 'Australia/Sydney',
}

export function getClinicTimezone(countryCode: string) {
  return COUNTRY_TIMEZONES[countryCode?.toLowerCase()] || 'Europe/London'
}

export function formatLocalTime(utcDateStr: string, countryCode: string, formatStr: string = 'PPp') {
  if (!utcDateStr) return ''
  const timezone = getClinicTimezone(countryCode)
  try {
    return formatInTimeZone(utcDateStr, timezone, formatStr)
  } catch (e) {
    return new Date(utcDateStr).toLocaleString() // fallback
  }
}

export function toUtcString(localDateStr: string, countryCode: string) {
  const timezone = getClinicTimezone(countryCode)
  try {
    return zonedTimeToUtc(localDateStr, timezone).toISOString()
  } catch (e) {
    return new Date(localDateStr).toISOString()
  }
}
