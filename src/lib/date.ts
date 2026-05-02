import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'

export const COUNTRY_TIMEZONES: Record<string, string> = {
  gb: 'Europe/London',
  pk: 'Asia/Karachi',
  au: 'Australia/Sydney',
}

export function getClinicTimezone(countryCode?: string, clinicTimezone?: string) {
  if (clinicTimezone) return clinicTimezone
  return COUNTRY_TIMEZONES[countryCode?.toLowerCase() || ''] || 'Europe/London'
}

/**
 * Formats a UTC date string into a local clinic time
 */
export function formatLocalTime(utcDateStr: string, countryCode: string, formatStr: string = 'PPp', clinicTimezone?: string) {
  if (!utcDateStr) return ''
  const timezone = getClinicTimezone(countryCode, clinicTimezone)
  try {
    return formatInTimeZone(new Date(utcDateStr), timezone, formatStr)
  } catch (e) {
    console.error('formatLocalTime error:', e)
    return new Date(utcDateStr).toLocaleString() // fallback
  }
}

/**
 * Converts a local date/time (e.g. from a picker) into a UTC ISO string for saving to DB
 */
export function toUtcString(localDateStr: string, countryCode: string, clinicTimezone?: string) {
  if (!localDateStr) return ''
  const timezone = getClinicTimezone(countryCode, clinicTimezone)
  try {
    // Treat the input string as being in the clinic's timezone
    return fromZonedTime(localDateStr, timezone).toISOString()
  } catch (e) {
    console.error('toUtcString error:', e)
    return new Date(localDateStr).toISOString()
  }
}

/**
 * Gets the timezone abbreviation (e.g. GMT, PKT, AEDT)
 */
export function getTimezoneAbbr(countryCode: string, date: Date = new Date(), clinicTimezone?: string) {
  const timezone = getClinicTimezone(countryCode, clinicTimezone)
  try {
    // 'zzz' gives short specific timezone name
    return formatInTimeZone(date, timezone, 'zzz')
  } catch (e) {
    return 'UTC'
  }
}

/**
 * Gets a zoned Date object for local calculations (e.g. grouping bookings by local day)
 */
export function getZonedDate(date: Date | string, countryCode: string, clinicTimezone?: string) {
  const timezone = getClinicTimezone(countryCode, clinicTimezone)
  return toZonedTime(date, timezone)
}

/**
 * TIP: For WhatsApp templates, format times with the clinic's timezone so patients
 * see their local time, not UTC:
 * formatLocalTime(booking.appointment_time, country, "EEEE, MMMM d, yyyy 'at' h:mm a zzz", clinic.timezone)
 */
