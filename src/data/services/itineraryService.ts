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
import { findActivityOverlaps } from '../utils/activityTime'

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

export interface ItineraryOverview {
  trip: Trip
  preferences: TripPreferences | null
  destinations: TripDestination[]
  days: ItineraryDaySummary[]
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
    const activities = active(activitiesRaw)
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

    const dayActivities = orderedActivities(await db.activities.where('trip_day_id').equals(day.id).toArray())
    const position = dayActivities.length ? Math.max(...dayActivities.map((activity) => activity.position)) + 100 : 100

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
      position,
      notes: draft.notes?.trim() || null,
    }

    await db.activities.add(activity)
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

    let position = activity.position
    if (targetDay.id !== activity.trip_day_id) {
      const targetActivities = orderedActivities(await db.activities.where('trip_day_id').equals(targetDay.id).toArray())
      position = targetActivities.length ? Math.max(...targetActivities.map((item) => item.position)) + 100 : 100
    }

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
      position,
      notes: draft.notes?.trim() || null,
    })

    const dayChanged = targetDay.id !== activity.trip_day_id
    const placeChanged = nextActivity.trip_place_id !== activity.trip_place_id
    if (!dayChanged && !placeChanged) {
      await db.activities.put(nextActivity)
      return
    }

    const linkedSegments = await getLinkedTransportSegments(activity.id)
    const nextPlaceId = dayChanged ? null : await getPlaceIdForTripPlace(nextActivity.trip_place_id)
    await db.transaction('rw', [db.activities, db.transportSegments], async () => {
      await db.activities.put(nextActivity)
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
    const dayActivities = orderedActivities(await db.activities.where('trip_day_id').equals(activity.trip_day_id).toArray())
    const position = dayActivities.length ? Math.max(...dayActivities.map((item) => item.position)) + 100 : 100
    const copy: Activity = {
      ...activity,
      ...createRecordMetadata(),
      title: `${activity.title} copy`,
      status: 'planned',
      position,
    }
    await db.activities.add(copy)
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

    const targetActivities = orderedActivities(await db.activities.where('trip_day_id').equals(targetDayId).toArray())
    const position = targetActivities.length ? Math.max(...targetActivities.map((item) => item.position)) + 100 : 100
    const linkedSegments = await getLinkedTransportSegments(activityId)
    await db.transaction('rw', [db.activities, db.transportSegments], async () => {
      await db.activities.put(touchRecord({ ...activity, trip_day_id: targetDayId, position }))
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
}
