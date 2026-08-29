import { useMemo } from 'react'
import { getLocale } from '../../paraglide/runtime.js'
import { parseISO, toISO, type Ymd } from './date'

/**
 * Everything about the field that depends on the language: which number comes
 * first in a typed date, which day starts the week, and how a month is named.
 */
export type DateFormats = {
  /** Mexico writes the day first; the English locale exists for US coaches. */
  dayFirst: boolean
  /** 0 = Sunday. Spanish-speaking calendars start on Monday. */
  weekStart: number
  monthLong: Intl.DateTimeFormat
  monthShort: Intl.DateTimeFormat
  weekday: Intl.DateTimeFormat
  full: Intl.DateTimeFormat
}

export function useDateFormats(): DateFormats {
  const locale = getLocale()
  return useMemo(() => {
    const tag = locale === 'en' ? 'en-US' : 'es-MX'
    const opts = { timeZone: 'UTC' } as const
    return {
      dayFirst: locale !== 'en',
      weekStart: locale === 'en' ? 0 : 1,
      monthLong: new Intl.DateTimeFormat(tag, { month: 'long', ...opts }),
      monthShort: new Intl.DateTimeFormat(tag, { month: 'short', ...opts }),
      /* `narrow` is unusable in Spanish: martes and miércoles are both "M".
         Two letters of `short` are unambiguous in both locales. */
      weekday: new Intl.DateTimeFormat(tag, { weekday: 'short', ...opts }),
      full: new Intl.DateTimeFormat(tag, { dateStyle: 'long', ...opts }),
    }
  }, [locale])
}

/** A `Ymd` as a UTC `Date`, the only thing `Intl.DateTimeFormat` will take. */
export const utc = (p: Ymd) => new Date(Date.UTC(p.y, p.m - 1, p.d))

/** Digits only, sliced into `xx/xx/xxxx` as they are typed. */
export function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter((part) => part.length > 0)
    .join('/')
}

/** `null` while the date is incomplete or impossible, so half of one never counts. */
export function textToISO(text: string, dayFirst: boolean): string | null {
  const digits = text.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const first = Number(digits.slice(0, 2))
  const second = Number(digits.slice(2, 4))
  const y = Number(digits.slice(4, 8))
  const p: Ymd = dayFirst ? { y, m: second, d: first } : { y, m: first, d: second }
  if (p.m < 1 || p.m > 12) return null
  const iso = toISO(p)
  return parseISO(iso) ? iso : null
}

export function isoToText(iso: string, dayFirst: boolean): string {
  const p = parseISO(iso)
  if (!p) return ''
  const dd = String(p.d).padStart(2, '0')
  const mm = String(p.m).padStart(2, '0')
  const yyyy = String(p.y).padStart(4, '0')
  return dayFirst ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`
}
