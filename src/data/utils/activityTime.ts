import type { Activity } from '../types/entities'

export const timeToMinutes = (value: string | null) => {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

export const formatClockTime = (value: string | null) => {
  if (!value) return 'Any time'
  const minutes = timeToMinutes(value)
  if (minutes === null) return value
  const hours24 = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`
}

export const formatDuration = (minutes: number | null) => {
  if (!minutes) return 'Duration flexible'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

export const endTimeForActivity = (activity: Pick<Activity, 'start_time' | 'duration_minutes'>) => {
  const start = timeToMinutes(activity.start_time)
  if (start === null || !activity.duration_minutes) return null
  const total = start + activity.duration_minutes
  const nextDay = total >= 24 * 60
  const normalized = total % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${nextDay ? '+1' : ''}`
}

export interface ActivityOverlap {
  firstId: string
  secondId: string
}

export const findActivityOverlaps = (activities: Activity[]): ActivityOverlap[] => {
  const timed = activities
    .filter((activity) => activity.deleted_at === null && activity.status !== 'cancelled' && activity.status !== 'skipped')
    .map((activity) => {
      const start = timeToMinutes(activity.start_time)
      const duration = activity.duration_minutes
      return start !== null && duration ? { activity, start, end: start + duration } : null
    })
    .filter((value): value is { activity: Activity; start: number; end: number } => value !== null)
    .sort((a, b) => a.start - b.start)

  const overlaps: ActivityOverlap[] = []
  for (let index = 0; index < timed.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < timed.length; otherIndex += 1) {
      const first = timed[index]
      const second = timed[otherIndex]
      if (second.start >= first.end) break
      if (first.start < second.end && second.start < first.end) {
        overlaps.push({ firstId: first.activity.id, secondId: second.activity.id })
      }
    }
  }
  return overlaps
}

const minutesOf = (item: Pick<Activity, 'start_time'>) => timeToMinutes(item.start_time)

// Puts timed activities in clock order. They swap among the places timed activities already
// occupy, so untimed activities stay where the traveler put them.
export const chronologicalOrder = <T extends Pick<Activity, 'start_time'>>(items: T[]): T[] => {
  const slots = items.map((item, index) => ({ item, index, minutes: minutesOf(item) }))
  const timed = slots.filter((slot) => slot.minutes !== null)
  const sorted = [...timed].sort((a, b) => (a.minutes as number) - (b.minutes as number) || a.index - b.index)
  const result = [...items]
  timed.forEach((slot, i) => { result[slot.index] = sorted[i].item })
  return result
}

export const isTimeOrdered = (items: Pick<Activity, 'start_time'>[]) => {
  let last = -1
  for (const item of items) {
    const minutes = minutesOf(item)
    if (minutes === null) continue
    if (minutes < last) return false
    last = minutes
  }
  return true
}

// Where a timed activity belongs in an ordered day: just before the first activity that starts later.
// Untimed activities go to the end, as before.
export const insertIndexForTime = (ordered: Pick<Activity, 'start_time'>[], time: string | null) => {
  const minutes = timeToMinutes(time)
  if (minutes === null) return ordered.length
  const index = ordered.findIndex((item) => {
    const other = minutesOf(item)
    return other !== null && other > minutes
  })
  return index === -1 ? ordered.length : index
}

// The activity a traveler should look at next. In-progress first; then, on the live day, the first
// planned activity (in clock order) that hasn't already ended; otherwise the first planned one.
export const pickNextActivity = <T extends Pick<Activity, 'status' | 'start_time' | 'duration_minutes'>>(items: T[], nowMinutes: number | null): T | null => {
  const ordered = chronologicalOrder(items.filter((item) => item.status !== 'cancelled'))
  const inProgress = ordered.find((item) => item.status === 'in_progress')
  if (inProgress) return inProgress
  const planned = ordered.filter((item) => item.status === 'planned')
  if (nowMinutes === null) return planned[0] ?? null
  const upcoming = planned.find((item) => {
    const start = minutesOf(item)
    return start === null || start + (item.duration_minutes ?? 30) >= nowMinutes
  })
  return upcoming ?? planned[0] ?? null
}
