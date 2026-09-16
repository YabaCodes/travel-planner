const DAY_MS = 86_400_000

const parseUtcDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export const todayYmd = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const inclusiveDayCount = (start: string | null, end: string | null) => {
  if (!start || !end) return 0
  const difference = Math.floor((parseUtcDate(end).getTime() - parseUtcDate(start).getTime()) / DAY_MS)
  return difference >= 0 ? difference + 1 : 0
}

export const enumerateDates = (start: string, end: string) => {
  const count = inclusiveDayCount(start, end)
  if (count <= 0) return []
  if (count > 730) throw new Error('Trips longer than 730 days are not supported yet.')

  const startDate = parseUtcDate(start)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startDate.getTime() + index * DAY_MS)
    return date.toISOString().slice(0, 10)
  })
}

export const formatDateRange = (start: string | null, end: string | null) => {
  if (!start || !end) return 'Dates not set'
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  if (start === end) return formatter.format(parseUtcDate(start))
  return `${formatter.format(parseUtcDate(start))} – ${formatter.format(parseUtcDate(end))}`
}

export const formatShortDate = (value: string | null) => {
  if (!value) return 'Unscheduled'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parseUtcDate(value))
}
