import { db } from '../db'
import type {
  Activity,
  ActivityStatus,
  ActivityType,
  BookingRequirement,
  Priority,
  Trip,
  TripDay,
  TripDestination,
  TripPreferences,
} from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'
import { chronologicalOrder, findActivityOverlaps, insertIndexForTime } from '../utils/activityTime'
import { formatShortDate } from '../utils/tripDate'

const active = <T extends { deleted_at: string | null }>(records: T[]) => records.filter((record) => record.deleted_at === null)

const orderedActivities = (activities: Activity[]) => active(activities).sort((a, b) => a.position - b.position)

export interface ActivityDraft {
  tripDayId: string
  tripPlaceId: string | null
  title: string
  type: ActivityType
  priority: Priority
  bookingRequirement: BookingRequirement
  status: ActivityStatus
  startTime: string | null
  durationMinutes: number | null
  timeLocked: boolean
  notes: string | null
}

export interface DayLoad {
  count: number
  target: number | null
  label: 'Empty' | 'Light' | 'On target' | 'Full'
}

export interface ItineraryDaySummary {
  day: TripDay
  destination: TripDestination | null
  activities: Activity[]
  load: DayLoad
  overlapCount: number
}

// An activity whose day no longer exists (left behind by a date change in an earlier version).
export interface UnplacedActivity {
  activity: Activity
  formerDate: string | null
}

export interface DestinationRange {
  destinationId: string
  from: string
  to: string
}

export interface ItineraryOverview {
  trip: Trip
  preferences: TripPreferences | null
  destinations: TripDestination[]
  days: ItineraryDaySummary[]
  unplaced: UnplacedActivity[]
  counts: {
    activities: number
    timed: number
    freeTime: number
  }
}

export interface DayPlannerData extends ItineraryDaySummary {
  trip: Trip
  preferences: TripPreferences | null
  destinations: TripDestination[]
  allDays: TripDay[]
}

const validateStartTime = (value: string | null) => {
  if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Start time must use HH:MM format.')
}

const normalizeDuration = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null
  if (value < 5 || value > 1440) throw new Error('Duration must be between 5 and 1440 minutes.')
  return Math.round(value)
}

const calculateLoad = (activities: Activity[], preferences: TripPreferences | null): DayLoad => {
  const count = activities.filter((activity) => activity.status !== 'cancelled' && activity.type !== 'free_time').length
  const target = preferences?.major_activities_per_day ?? null
  if (count === 0) return { count, target, label: 'Empty' }
  if (target) {
    if (count < target) return { count, target, label: 'Light' }
    if (count === target) return { count, target, label: 'On target' }
    return { count, target, label: 'Full' }
  }
  if (count <= 2) return { count, target, label: 'Light' }
  if (count <= 4) return { count, target, label: 'On target' }
  return { count, target, label: 'Full' }
}

const getActivePreferences = async (tripId: string) => {
  const preferences = await db.tripPreferences.where('trip_id').equals(tripId).first()
  return preferences && !preferences.deleted_at ? preferences : null
}

const getLinkedTransportSegments = async (activityId: string) => {
  const [fromSegments, toSegments] = await Promise.all([
    db.transportSegments.where('from_activity_id').equals(activityId).toArray(),
    db.transportSegments.where('to_activity_id').equals(activityId).toArray(),
  ])
  const unique = new Map([...fromSegments, ...toSegments].map((segment) => [segment.id, segment]))
  return active([...unique.values()])
}

// Positions are renumbered 100, 200, … so the stored order always matches the list.
// `fresh` is the activity being saved; it is returned even when its position didn't change.
const renumber = (ordered: Activity[], fresh?: Activity) => ordered.flatMap((item, index) => {
  const position = (index + 1) * 100
  if (fresh && item.id === fresh.id) return [{ ...item, position }]
  return item.position === position ? [] : [touchRecord({ ...item, position })]
})

// The day's activities with `activity` placed in clock order (untimed activities go last).
// With `afterId`, it goes right after that activity instead (used for duplicates).
const layoutDayWith = async (dayId: string, activity: Activity, afterId?: string) => {
  const others = orderedActivities(await db.activities.where('trip_day_id').equals(dayId).toArray()).filter((item) => item.id !== activity.id)
  const after = afterId ? others.findIndex((item) => item.id === afterId) : -1
  const index = after >= 0 ? after + 1 : insertIndexForTime(others, activity.start_time)
  return renumber([...others.slice(0, index), activity, ...others.slice(index)], activity)
}

const getPlaceIdForTripPlace = async (tripPlaceId: string | null) => {
  if (!tripPlaceId) return null
  const tripPlace = await db.tripPlaces.get(tripPlaceId)
  if (!tripPlace || tripPlace.deleted_at) return null
  const place = await db.places.get(tripPlace.place_id)
  return place && !place.deleted_at ? place.id : null
}

export const itineraryService = {
  async getOverview(tripId: string): Promise<ItineraryOverview | null> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) return null

    const [preferences, destinationsRaw, daysRaw, activitiesRaw] = await Promise.all([
      getActivePreferences(tripId),
      db.tripDestinations.where('trip_id').equals(tripId).toArray(),
      db.tripDays.where('trip_id').equals(tripId).toArray(),
      db.activities.where('trip_id').equals(tripId).toArray(),
    ])

    const destinations = active(destinationsRaw).sort((a, b) => a.sequence - b.sequence)
    const days = active(daysRaw).sort((a, b) => a.position - b.position)
    const dayIds = new Set(days.map((day) => day.id))
    const allActivities = active(activitiesRaw)
    const activities = allActivities.filter((activity) => dayIds.has(activity.trip_day_id))
    const formerDates = new Map(daysRaw.map((day) => [day.id, day.date]))
    const unplaced = allActivities
      .filter((activity) => !dayIds.has(activity.trip_day_id))
      .map((activity) => ({ activity, formerDate: formerDates.get(activity.trip_day_id) ?? null }))
      .sort((a, b) => (a.formerDate ?? '').localeCompare(b.formerDate ?? '') || a.activity.position - b.activity.position)
    const destinationMap = new Map(destinations.map((destination) => [destination.id, destination]))

    const daySummaries = days.map((day): ItineraryDaySummary => {
      const dayActivities = orderedActivities(activities.filter((activity) => activity.trip_day_id === day.id))
      return {
        day,
        destination: day.destination_id ? destinationMap.get(day.destination_id) ?? null : null,
        activities: dayActivities,
        load: calculateLoad(dayActivities, preferences),
        overlapCount: findActivityOverlaps(dayActivities).length,
      }
    })

    return {
      trip,
      preferences,
      destinations,
      days: daySummaries,
      unplaced,
      counts: {
        activities: activities.length,
        timed: activities.filter((activity) => activity.start_time !== null).length,
        freeTime: activities.filter((activity) => activity.type === 'free_time').length,
      },
    }
  },

  async getDay(tripId: string, dayId: string): Promise<DayPlannerData | null> {
    const overview = await this.getOverview(tripId)
    if (!overview) return null
    const summary = overview.days.find((item) => item.day.id === dayId)
    if (!summary) return null
    return {
      ...summary,
      trip: overview.trip,
      preferences: overview.preferences,
      destinations: overview.destinations,
      allDays: overview.days.map((item) => item.day),
    }
  },

  async getActivity(tripId: string, activityId: string): Promise<Activity | null> {
    const activity = await db.activities.get(activityId)
    if (!activity || activity.deleted_at || activity.trip_id !== tripId) return null
    return activity
  },

  async updateDayDetails(dayId: string, values: { title: string | null; notes: string | null; destinationId: string | null }) {
    const day = await db.tripDays.get(dayId)
    if (!day || day.deleted_at) throw new Error('Trip day not found.')

    if (values.destinationId) {
      const destination = await db.tripDestinations.get(values.destinationId)
      if (!destination || destination.deleted_at || destination.trip_id !== day.trip_id) throw new Error('Destination does not belong to this trip.')
    }

    await db.tripDays.put(touchRecord({
      ...day,
      title: values.title?.trim() || null,
      notes: values.notes?.trim() || null,
      destination_id: values.destinationId,
    }))
  },

  async createActivity(tripId: string, draft: ActivityDraft): Promise<string> {
    const trip = await db.trips.get(tripId)
    const day = await db.tripDays.get(draft.tripDayId)
    if (!trip || trip.deleted_at) throw new Error('Trip not found.')
    if (!day || day.deleted_at || day.trip_id !== tripId) throw new Error('Choose a valid trip day.')
    if (!draft.title.trim()) throw new Error('Activity title is required.')
    if (draft.type === 'place') {
      if (!draft.tripPlaceId) throw new Error('Choose a saved place.')
      const tripPlace = await db.tripPlaces.get(draft.tripPlaceId)
      if (!tripPlace || tripPlace.deleted_at || tripPlace.trip_id !== tripId) throw new Error('Saved place does not belong to this trip.')
    }
    validateStartTime(draft.startTime)

    const activity: Activity = {
      ...createRecordMetadata(),
      trip_id: tripId,
      trip_day_id: day.id,
      trip_place_id: draft.type === 'place' ? draft.tripPlaceId : null,
      title: draft.title.trim(),
      type: draft.type,
      priority: draft.priority,
      booking_requirement: draft.type === 'free_time' ? 'none' : draft.bookingRequirement,
      status: draft.status,
      start_time: draft.startTime,
      duration_minutes: normalizeDuration(draft.durationMinutes),
      time_locked: draft.timeLocked,
      position: 0,
      notes: draft.notes?.trim() || null,
    }

    const layout = await layoutDayWith(day.id, activity)
    await db.transaction('rw', db.activities, async () => {
      await db.activities.bulkPut(layout)
    })
    return activity.id
  },

  async updateActivity(tripId: string, activityId: string, draft: ActivityDraft) {
    const activity = await db.activities.get(activityId)
    const targetDay = await db.tripDays.get(draft.tripDayId)
    if (!activity || activity.deleted_at || activity.trip_id !== tripId) throw new Error('Activity not found.')
    if (!targetDay || targetDay.deleted_at || targetDay.trip_id !== tripId) throw new Error('Choose a valid trip day.')
    if (!draft.title.trim()) throw new Error('Activity title is required.')
    if (draft.type === 'place') {
      if (!draft.tripPlaceId) throw new Error('Choose a saved place.')
      const tripPlace = await db.tripPlaces.get(draft.tripPlaceId)
      if (!tripPlace || tripPlace.deleted_at || tripPlace.trip_id !== tripId) throw new Error('Saved place does not belong to this trip.')
    }
    validateStartTime(draft.startTime)

    const nextActivity = touchRecord({
      ...activity,
      trip_day_id: targetDay.id,
      trip_place_id: draft.type === 'place' ? draft.tripPlaceId : null,
      title: draft.title.trim(),
      type: draft.type,
      priority: draft.priority,
      booking_requirement: draft.type === 'free_time' ? 'none' : draft.bookingRequirement,
      status: draft.status,
      start_time: draft.startTime,
      duration_minutes: normalizeDuration(draft.durationMinutes),
      time_locked: draft.timeLocked,
      notes: draft.notes?.trim() || null,
    })

    const dayChanged = targetDay.id !== activity.trip_day_id
    const placeChanged = nextActivity.trip_place_id !== activity.trip_place_id
    // A new day or a new start time puts the activity back in clock order.
    const reorder = dayChanged || (nextActivity.start_time !== null && nextActivity.start_time !== activity.start_time)
    const layout = reorder ? await layoutDayWith(targetDay.id, nextActivity) : [nextActivity]
    if (!dayChanged && !placeChanged) {
      await db.transaction('rw', db.activities, async () => {
        await db.activities.bulkPut(layout)
      })
      return
    }

    const linkedSegments = await getLinkedTransportSegments(activity.id)
    const nextPlaceId = dayChanged ? null : await getPlaceIdForTripPlace(nextActivity.trip_place_id)
    await db.transaction('rw', [db.activities, db.transportSegments], async () => {
      await db.activities.bulkPut(layout)
      for (const segment of linkedSegments) {
        if (dayChanged) {
          await db.transportSegments.put(softDeleteRecord(segment))
        } else {
          await db.transportSegments.put(touchRecord({
            ...segment,
            from_place_id: segment.from_activity_id === activity.id ? nextPlaceId : segment.from_place_id,
            to_place_id: segment.to_activity_id === activity.id ? nextPlaceId : segment.to_place_id,
          }))
        }
      }
    })
  },

  async duplicateActivity(activityId: string): Promise<string> {
    const activity = await db.activities.get(activityId)
    if (!activity || activity.deleted_at) throw new Error('Activity not found.')
    const copy: Activity = {
      ...activity,
      ...createRecordMetadata(),
      title: `${activity.title} copy`,
      status: 'planned',
    }
    const layout = await layoutDayWith(activity.trip_day_id, copy, activity.id)
    await db.transaction('rw', db.activities, async () => {
      await db.activities.bulkPut(layout)
    })
    return copy.id
  },

  async softDeleteActivity(activityId: string) {
    const activity = await db.activities.get(activityId)
    if (!activity || activity.deleted_at) return
    const [linkedSegments, linkedBookings] = await Promise.all([
      getLinkedTransportSegments(activityId),
      db.bookings.where('activity_id').equals(activityId).toArray().then(active),
    ])
    await db.transaction('rw', [db.activities, db.transportSegments, db.bookings], async () => {
      await db.activities.put(softDeleteRecord(activity))
      for (const segment of linkedSegments) await db.transportSegments.put(softDeleteRecord(segment))
      for (const booking of linkedBookings) await db.bookings.put(touchRecord({ ...booking, activity_id: null }))
    })
  },

  async setActivityStatus(activityId: string, status: ActivityStatus) {
    const activity = await db.activities.get(activityId)
    if (!activity || activity.deleted_at) throw new Error('Activity not found.')
    await db.activities.put(touchRecord({ ...activity, status }))
  },

  async moveActivityToDay(activityId: string, targetDayId: string) {
    const activity = await db.activities.get(activityId)
    const targetDay = await db.tripDays.get(targetDayId)
    if (!activity || activity.deleted_at) throw new Error('Activity not found.')
    if (!targetDay || targetDay.deleted_at || targetDay.trip_id !== activity.trip_id) throw new Error('Target day not found.')
    if (activity.trip_day_id === targetDayId) return

    const layout = await layoutDayWith(targetDayId, touchRecord({ ...activity, trip_day_id: targetDayId }))
    const linkedSegments = await getLinkedTransportSegments(activityId)
    await db.transaction('rw', [db.activities, db.transportSegments], async () => {
      await db.activities.bulkPut(layout)
      for (const segment of linkedSegments) await db.transportSegments.put(softDeleteRecord(segment))
    })
  },

  async moveActivityByOffset(activityId: string, offset: -1 | 1) {
    const activity = await db.activities.get(activityId)
    if (!activity || activity.deleted_at) throw new Error('Activity not found.')
    const activities = orderedActivities(await db.activities.where('trip_day_id').equals(activity.trip_day_id).toArray())
    const index = activities.findIndex((item) => item.id === activityId)
    const targetIndex = index + offset
    if (index < 0 || targetIndex < 0 || targetIndex >= activities.length) return

    const other = activities[targetIndex]
    const originalPosition = activity.position
    await db.transaction('rw', db.activities, async () => {
      await db.activities.put(touchRecord({ ...activity, position: other.position }))
      await db.activities.put(touchRecord({ ...other, position: originalPosition }))
    })
  },

  // Puts the day's timed activities in clock order; untimed ones keep their place.
  async sortDayByTime(dayId: string) {
    const ordered = orderedActivities(await db.activities.where('trip_day_id').equals(dayId).toArray())
    const changed = renumber(chronologicalOrder(ordered))
    if (!changed.length) return
    await db.transaction('rw', db.activities, async () => {
      await db.activities.bulkPut(changed)
    })
  },

  // Current city ranges, worked out from the days each city is assigned to.
  async getDestinationRanges(tripId: string): Promise<DestinationRange[]> {
    const days = active(await db.tripDays.where('trip_id').equals(tripId).toArray()).filter((day) => day.date && day.destination_id)
    const ranges = new Map<string, DestinationRange>()
    days.forEach((day) => {
      const date = day.date as string
      const id = day.destination_id as string
      const current = ranges.get(id)
      if (!current) ranges.set(id, { destinationId: id, from: date, to: date })
      else ranges.set(id, { destinationId: id, from: date < current.from ? date : current.from, to: date > current.to ? date : current.to })
    })
    return [...ranges.values()]
  },

  // Assigns each city to the days in its date range. Days outside every range keep their city.
  async assignDestinationRanges(tripId: string, ranges: DestinationRange[]) {
    const [destinationsRaw, daysRaw] = await Promise.all([
      db.tripDestinations.where('trip_id').equals(tripId).toArray(),
      db.tripDays.where('trip_id').equals(tripId).toArray(),
    ])
    const destinations = new Map(active(destinationsRaw).map((destination) => [destination.id, destination]))
    const used = ranges.filter((range) => range.from || range.to)
    for (const range of used) {
      const destination = destinations.get(range.destinationId)
      if (!destination) throw new Error('One of the cities no longer belongs to this trip.')
      if (!range.from || !range.to) throw new Error(`Choose both dates for ${destination.city}, or leave both empty.`)
      if (range.to < range.from) throw new Error(`${destination.city}: the last day is before the first day.`)
    }
    const days = active(daysRaw).filter((day) => day.date)
    const changed: TripDay[] = []
    for (const day of days) {
      const date = day.date as string
      const matches = used.filter((range) => range.from <= date && date <= range.to)
      if (matches.length > 1) {
        const names = matches.map((range) => destinations.get(range.destinationId)?.city ?? 'a city').join(' and ')
        throw new Error(`${formatShortDate(date)} is in both ${names}. A day can have one city: pick where you sleep that night.`)
      }
      if (matches.length === 1 && day.destination_id !== matches[0].destinationId) {
        changed.push(touchRecord({ ...day, destination_id: matches[0].destinationId }))
      }
    }
    if (!changed.length) return 0
    await db.transaction('rw', db.tripDays, async () => {
      await db.tripDays.bulkPut(changed)
    })
    return changed.length
  },
}
