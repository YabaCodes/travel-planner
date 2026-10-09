import { db } from '../db'
import type {
  Activity,
  TransportSegment,
  TravelLeg,
  TravelProfile,
  Traveler,
  TravelerType,
  Trip,
  TripDay,
  TripDestination,
  TripPace,
  TripPreferences,
  TripStatus,
} from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'
import { addDaysYmd, daysBetween, enumerateDates, formatShortDate, inclusiveDayCount, todayYmd } from '../utils/tripDate'
import { insertIndexForTime } from '../utils/activityTime'

const PROFILE_NAME = 'My Travel Profile'

export interface DestinationDraft {
  city: string
  region: string
  country: string
  timezone: string
}

export interface TravelStyleDraft {
  pace: TripPace
  interests: string[]
  preferredDayStart: string | null
  majorActivitiesPerDay: number | null
  walkingTolerance: 'low' | 'medium' | 'high' | null
}

export interface RequirementsDraft {
  mustDo: string[]
  wouldLike: string[]
  foodRestrictions: string[]
  specialRequirements: string[]
  notes: string | null
}

export interface CreateTripInput {
  title: string
  startDate: string | null
  endDate: string | null
  destinations: DestinationDraft[]
  travelerType: TravelerType
  travelerCount: number
  travelerNames: string[]
  style: TravelStyleDraft
  requirements: RequirementsDraft
  saveAsProfile: boolean
}

// Everything on the trip brief except dates, title, status and notes (those live on Edit trip).
export interface TripBriefInput {
  destinations: Array<DestinationDraft & { id?: string }>
  travelerType: TravelerType
  travelerCount: number
  travelerNames: string[]
  style: TravelStyleDraft
  requirements: Omit<RequirementsDraft, 'notes'>
}

// How existing plans follow a date change: 'shift' moves every day by the same number of days
// (the whole trip moved); 'keep' leaves plans on their calendar dates (the trip got longer or shorter).
export type DateChangeMode = 'keep' | 'shift'

export interface DateChangePreview {
  shiftDays: number
  addedDays: number
  removedDays: number
  movedActivities: Array<{ title: string; from: string | null; to: string | null }>
  removedTransport: number
  removedDayNotes: number
  blockedReason: string | null
}

export interface TripSummary {
  trip: Trip
  destinations: TripDestination[]
  dayCount: number
}

export interface TripWorkspace {
  trip: Trip
  preferences: TripPreferences | null
  destinations: TripDestination[]
  travelers: Traveler[]
  days: TripDay[]
}

export interface TripDashboardData extends TripWorkspace {
  counts: {
    activities: number
    places: number
    bookings: number
    packingItems: number
  }
}

const active = <T extends { deleted_at: string | null }>(records: T[]) => records.filter((record) => record.deleted_at === null)

// Accepts IANA names such as Europe/Berlin. Blank stays blank (stored as UTC, as before).
export const normalizeTimezone = (value: string) => {
  const clean = value.trim()
  if (!clean) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: clean })
  } catch {
    throw new Error(`Time zone “${clean}” isn't recognised. Use a name like Europe/Berlin or Asia/Taipei.`)
  }
  return clean
}

const validateDateRange = (startDate: string | null, endDate: string | null) => {
  if ((startDate && !endDate) || (!startDate && endDate)) throw new Error('Set both trip dates or leave both blank.')
  if (startDate && endDate && inclusiveDayCount(startDate, endDate) <= 0) throw new Error('Return date must be on or after the departure date.')
}

const createTripDays = (tripId: string, startDate: string, endDate: string, destinationId: string | null): TripDay[] =>
  enumerateDates(startDate, endDate).map((date, index) => ({
    ...createRecordMetadata(),
    trip_id: tripId,
    destination_id: destinationId,
    date,
    day_number: index + 1,
    title: null,
    position: (index + 1) * 100,
    notes: null,
  }))

const profileFromStyle = (style: TravelStyleDraft, requirements: RequirementsDraft, existing?: TravelProfile): TravelProfile => ({
  ...(existing ? touchRecord(existing) : createRecordMetadata()),
  name: PROFILE_NAME,
  pace: style.pace,
  interests: style.interests,
  preferred_day_start: style.preferredDayStart,
  major_activities_per_day: style.majorActivitiesPerDay,
  walking_tolerance: style.walkingTolerance,
  food_restrictions: requirements.foodRestrictions,
  notes: null,
})

interface DatePlanInput {
  trip: Trip
  days: TripDay[]
  destinations: TripDestination[]
  activities: Activity[]
  segments: TransportSegment[]
  startDate: string | null
  endDate: string | null
  mode: DateChangeMode
}

interface DatePlan {
  days: TripDay[]
  activities: Activity[]
  segments: TransportSegment[]
  preview: DateChangePreview
}

// Works out a date change without touching the database, so the edit screen can show exactly what
// will happen before saving. Days are matched by calendar date, never by position, and activities
// on days that fall outside the new dates move to the nearest remaining day instead of disappearing.
const buildDatePlan = ({ trip, days, destinations, activities, segments, startDate, endDate, mode }: DatePlanInput): DatePlan => {
  const targetDates = startDate && endDate ? enumerateDates(startDate, endDate) : []
  const shiftDays = mode === 'shift' && trip.start_date && startDate ? daysBetween(trip.start_date, startDate) : 0
  const sortedDays = [...days].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.position - b.position)
  const projected = new Map<string, TripDay>()
  const leftover: TripDay[] = []
  for (const day of sortedDays) {
    const date = day.date ? addDaysYmd(day.date, shiftDays) : null
    if (date && targetDates.includes(date) && !projected.has(date)) projected.set(date, day)
    else leftover.push(day)
  }

  const singleDestination = destinations.length === 1 ? destinations[0].id : null
  const nextDays: TripDay[] = []
  const created: TripDay[] = []
  targetDates.forEach((date, index) => {
    const existing = projected.get(date)
    const base = { date, day_number: index + 1, position: (index + 1) * 100 }
    if (existing) {
      const unchanged = existing.date === date && existing.day_number === base.day_number && existing.position === base.position
      nextDays.push(unchanged ? existing : touchRecord({ ...existing, ...base }))
    } else {
      // A new day takes the city of the nearest existing day, so a day added before a stay in
      // Lyon is also in Lyon.
      const neighbour = [...projected.entries()].sort((a, b) => Math.abs(daysBetween(a[0], date)) - Math.abs(daysBetween(b[0], date)))[0]?.[1]
      const day: TripDay = {
        ...createRecordMetadata(),
        trip_id: trip.id,
        destination_id: singleDestination ?? neighbour?.destination_id ?? null,
        title: null,
        notes: null,
        ...base,
      }
      nextDays.push(day)
      created.push(day)
    }
  })

  const removedDays = leftover
  const removedIds = new Set(removedDays.map((day) => day.id))
  const affected = activities.filter((activity) => removedIds.has(activity.trip_day_id))
  const preview: DateChangePreview = {
    shiftDays,
    addedDays: created.length,
    removedDays: removedDays.length,
    movedActivities: [],
    removedTransport: segments.filter((segment) => removedIds.has(segment.trip_day_id)).length,
    removedDayNotes: removedDays.filter((day) => day.title || day.notes).length,
    blockedReason: null,
  }
  if (affected.length && !targetDates.length) {
    preview.blockedReason = `${affected.length} planned activit${affected.length === 1 ? 'y is' : 'ies are'} on the current days. Move or delete ${affected.length === 1 ? 'it' : 'them'} before clearing the dates.`
    return { days: [], activities: [], segments: [], preview }
  }

  // Each removed day's activities go to the first day (if the removed day was before the trip)
  // or the last day (if after), placed in clock order among what's already there.
  const firstDay = nextDays[0]
  const lastDay = nextDays[nextDays.length - 1]
  const dayActivities = new Map<string, Activity[]>()
  nextDays.forEach((day) => dayActivities.set(day.id, activities.filter((activity) => activity.trip_day_id === day.id).sort((a, b) => a.position - b.position)))
  const movedIds = new Set<string>()
  for (const day of removedDays) {
    const onDay = activities.filter((item) => item.trip_day_id === day.id).sort((a, b) => a.position - b.position)
    if (!onDay.length) continue
    const projectedDate = day.date ? addDaysYmd(day.date, shiftDays) : null
    const target = projectedDate && startDate && projectedDate < startDate ? firstDay : lastDay
    const list = dayActivities.get(target.id) as Activity[]
    for (const activity of onDay) {
      const moved = { ...activity, trip_day_id: target.id }
      list.splice(insertIndexForTime(list, moved.start_time), 0, moved)
      movedIds.add(activity.id)
      preview.movedActivities.push({ title: activity.title, from: day.date, to: target.date })
    }
  }

  const changedActivities: Activity[] = []
  dayActivities.forEach((list) => list.forEach((activity, index) => {
    const position = (index + 1) * 100
    const original = activities.find((item) => item.id === activity.id) as Activity
    if (movedIds.has(activity.id) || original.position !== position) changedActivities.push(touchRecord({ ...original, trip_day_id: activity.trip_day_id, position }))
  }))

  return {
    days: [...nextDays.filter((day) => !days.includes(day) || created.includes(day)), ...removedDays.map((day) => softDeleteRecord(day))],
    activities: changedActivities,
    segments: segments.filter((segment) => removedIds.has(segment.trip_day_id)).map((segment) => softDeleteRecord(segment)),
    preview,
  }
}

export const tripService = {
  async getDefaultTravelProfile(): Promise<TravelProfile | null> {
    const profiles = active(await db.travelProfiles.toArray())
      .filter((profile) => profile.name === PROFILE_NAME)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return profiles[0] ?? null
  },

  async createTrip(input: CreateTripInput): Promise<string> {
    const title = input.title.trim()
    const destinations = input.destinations
      .map((destination) => ({ ...destination, city: destination.city.trim(), country: destination.country.trim(), region: destination.region.trim(), timezone: destination.timezone.trim() }))
      .filter((destination) => destination.city && destination.country)

    if (!title) throw new Error('Trip title is required.')
    if (destinations.length === 0) throw new Error('Add at least one destination.')
    validateDateRange(input.startDate, input.endDate)

    const trip: Trip = {
      ...createRecordMetadata(),
      title,
      status: input.startDate ? 'planning' : 'idea',
      start_date: input.startDate,
      end_date: input.endDate,
      traveler_type: input.travelerType,
      base_currency: null,
      notes: input.requirements.notes,
    }

    const destinationRecords: TripDestination[] = destinations.map((destination, index) => ({
      ...createRecordMetadata(),
      trip_id: trip.id,
      city: destination.city,
      region: destination.region || null,
      country: destination.country,
      timezone: normalizeTimezone(destination.timezone),
      arrival_at: null,
      departure_at: null,
      sequence: (index + 1) * 100,
      notes: null,
    }))

    const preferences: TripPreferences = {
      ...createRecordMetadata(),
      trip_id: trip.id,
      pace: input.style.pace,
      interests: input.style.interests,
      preferred_day_start: input.style.preferredDayStart,
      major_activities_per_day: input.style.majorActivitiesPerDay,
      walking_tolerance: input.style.walkingTolerance,
      food_restrictions: input.requirements.foodRestrictions,
      must_do: input.requirements.mustDo,
      would_like: input.requirements.wouldLike,
      special_requirements: input.requirements.specialRequirements,
      notes: input.requirements.notes,
    }

    const travelerCount = Math.max(1, Math.min(20, input.travelerCount))
    const travelers: Traveler[] = Array.from({ length: travelerCount }, (_, index) => ({
      ...createRecordMetadata(),
      trip_id: trip.id,
      name: input.travelerNames[index]?.trim() || null,
      is_primary: index === 0,
    }))

    const destinationForDays = destinationRecords.length === 1 ? destinationRecords[0].id : null
    const days = input.startDate && input.endDate ? createTripDays(trip.id, input.startDate, input.endDate, destinationForDays) : []
    const existingProfile = input.saveAsProfile ? await this.getDefaultTravelProfile() : null
    const profile = input.saveAsProfile ? profileFromStyle(input.style, input.requirements, existingProfile ?? undefined) : null

    await db.transaction('rw', [db.trips, db.tripDestinations, db.tripPreferences, db.travelers, db.tripDays, db.travelProfiles], async () => {
      await db.trips.add(trip)
      await db.tripDestinations.bulkAdd(destinationRecords)
      await db.tripPreferences.add(preferences)
      await db.travelers.bulkAdd(travelers)
      if (days.length > 0) await db.tripDays.bulkAdd(days)
      if (profile) await db.travelProfiles.put(profile)
    })

    localStorage.setItem('lastOpenedTripId', trip.id)
    return trip.id
  },

  async listSummaries(): Promise<TripSummary[]> {
    const trips = active(await db.trips.toArray())
    const summaries = await Promise.all(trips.map(async (trip) => {
      const destinations = active(await db.tripDestinations.where('trip_id').equals(trip.id).toArray()).sort((a, b) => a.sequence - b.sequence)
      const days = active(await db.tripDays.where('trip_id').equals(trip.id).toArray())
      return { trip, destinations, dayCount: days.length }
    }))
    return summaries.sort((a, b) => b.trip.updated_at.localeCompare(a.trip.updated_at))
  },

  async getWorkspace(tripId: string): Promise<TripWorkspace | null> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) return null

    const [preferences, destinations, travelers, days] = await Promise.all([
      db.tripPreferences.where('trip_id').equals(tripId).first(),
      db.tripDestinations.where('trip_id').equals(tripId).toArray(),
      db.travelers.where('trip_id').equals(tripId).toArray(),
      db.tripDays.where('trip_id').equals(tripId).toArray(),
    ])

    return {
      trip,
      preferences: preferences && !preferences.deleted_at ? preferences : null,
      destinations: active(destinations).sort((a, b) => a.sequence - b.sequence),
      travelers: active(travelers),
      days: active(days).sort((a, b) => a.position - b.position),
    }
  },

  async getDashboard(tripId: string): Promise<TripDashboardData | null> {
    const workspace = await this.getWorkspace(tripId)
    if (!workspace) return null
    const [activities, places, bookings, packingItems] = await Promise.all([
      db.activities.where('trip_id').equals(tripId).toArray(),
      db.tripPlaces.where('trip_id').equals(tripId).toArray(),
      db.bookings.where('trip_id').equals(tripId).toArray(),
      db.packingLists.where('trip_id').equals(tripId).toArray().then(async (lists) => {
        const ids = active(lists).map((list) => list.id)
        if (ids.length === 0) return []
        return db.packingItems.where('packing_list_id').anyOf(ids).toArray()
      }),
    ])

    const dayIds = new Set(workspace.days.map((day) => day.id))
    return {
      ...workspace,
      counts: {
        activities: active(activities).filter((activity) => dayIds.has(activity.trip_day_id)).length,
        places: active(places).length,
        bookings: active(bookings).length,
        packingItems: active(packingItems).length,
      },
    }
  },

  async loadDatePlanInput(tripId: string, startDate: string | null, endDate: string | null, mode: DateChangeMode): Promise<DatePlanInput> {
    validateDateRange(startDate, endDate)
    const workspace = await this.getWorkspace(tripId)
    if (!workspace) throw new Error('Trip not found.')
    const [activities, segments] = await Promise.all([
      db.activities.where('trip_id').equals(tripId).toArray(),
      db.transportSegments.where('trip_id').equals(tripId).toArray(),
    ])
    return { trip: workspace.trip, days: workspace.days, destinations: workspace.destinations, activities: active(activities), segments: active(segments), startDate, endDate, mode }
  },

  // What a date change would do, for the edit screen to show before saving.
  async previewDateChange(tripId: string, startDate: string | null, endDate: string | null, mode: DateChangeMode): Promise<DateChangePreview> {
    return buildDatePlan(await this.loadDatePlanInput(tripId, startDate, endDate, mode)).preview
  },

  async updateTripBasics(tripId: string, values: { title: string; status: TripStatus; startDate: string | null; endDate: string | null; notes: string | null; dateMode?: DateChangeMode }) {
    if (!values.title.trim()) throw new Error('Trip title is required.')
    const input = await this.loadDatePlanInput(tripId, values.startDate, values.endDate, values.dateMode ?? 'keep')
    const datesChanged = input.trip.start_date !== values.startDate || input.trip.end_date !== values.endDate
    const plan = datesChanged ? buildDatePlan(input) : null
    if (plan?.preview.blockedReason) throw new Error(plan.preview.blockedReason)

    const updatedTrip: Trip = touchRecord({
      ...input.trip,
      title: values.title.trim(),
      status: values.status,
      start_date: values.startDate,
      end_date: values.endDate,
      notes: values.notes,
    })

    await db.transaction('rw', [db.trips, db.tripDays, db.activities, db.transportSegments], async () => {
      await db.trips.put(updatedTrip)
      if (!plan) return
      if (plan.days.length) await db.tripDays.bulkPut(plan.days)
      if (plan.activities.length) await db.activities.bulkPut(plan.activities)
      if (plan.segments.length) await db.transportSegments.bulkPut(plan.segments)
    })
    return plan?.preview ?? null
  },

  // Saves the trip brief: cities, travelers, travel style and requirements.
  async updateTripBrief(tripId: string, input: TripBriefInput) {
    const workspace = await this.getWorkspace(tripId)
    if (!workspace) throw new Error('Trip not found.')
    const drafts = input.destinations
      .map((destination) => ({ ...destination, city: destination.city.trim(), country: destination.country.trim(), region: destination.region.trim(), timezone: destination.timezone.trim() }))
      .filter((destination) => destination.city || destination.country)
    if (!drafts.length) throw new Error('Add at least one city.')
    const incomplete = drafts.find((destination) => !destination.city || !destination.country)
    if (incomplete) throw new Error(`Add both the city and the country for ${incomplete.city || incomplete.country}.`)

    const existing = new Map(workspace.destinations.map((destination) => [destination.id, destination]))
    const keptIds = new Set(drafts.map((destination) => destination.id).filter((id): id is string => Boolean(id && existing.has(id))))
    const destinations: TripDestination[] = drafts.map((draft, index) => {
      const sequence = (index + 1) * 100
      const values = { city: draft.city, country: draft.country, region: draft.region || null, timezone: normalizeTimezone(draft.timezone), sequence }
      const current = draft.id ? existing.get(draft.id) : undefined
      if (current) return touchRecord({ ...current, ...values })
      return { ...createRecordMetadata(), trip_id: tripId, arrival_at: null, departure_at: null, notes: null, ...values }
    })
    const removed = workspace.destinations.filter((destination) => !keptIds.has(destination.id))
    const removedIds = new Set(removed.map((destination) => destination.id))
    const onlyDestination = destinations.length === 1 ? destinations[0].id : null

    const days = workspace.days.flatMap((day) => {
      const lost = day.destination_id !== null && removedIds.has(day.destination_id)
      const next = lost ? null : day.destination_id
      const assigned = next ?? onlyDestination
      return assigned !== day.destination_id ? [touchRecord({ ...day, destination_id: assigned })] : []
    })
    const legs = active(await db.travelLegs.where('trip_id').equals(tripId).toArray()).flatMap((leg: TravelLeg) => {
      const from = leg.from_destination_id && removedIds.has(leg.from_destination_id) ? null : leg.from_destination_id
      const to = leg.to_destination_id && removedIds.has(leg.to_destination_id) ? null : leg.to_destination_id
      return from !== leg.from_destination_id || to !== leg.to_destination_id ? [touchRecord({ ...leg, from_destination_id: from, to_destination_id: to })] : []
    })

    const count = Math.max(1, Math.min(20, Math.round(input.travelerCount) || 1))
    const currentTravelers = [...workspace.travelers].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at))
    const travelers: Traveler[] = []
    for (let index = 0; index < Math.max(count, currentTravelers.length); index += 1) {
      const current = currentTravelers[index]
      const name = input.travelerNames[index]?.trim() || null
      if (index >= count) travelers.push(softDeleteRecord(current))
      else if (current) {
        if (current.name !== name || current.is_primary !== (index === 0)) travelers.push(touchRecord({ ...current, name, is_primary: index === 0 }))
      } else travelers.push({ ...createRecordMetadata(), trip_id: tripId, name, is_primary: index === 0 })
    }

    const preferenceValues = {
      pace: input.style.pace,
      interests: input.style.interests,
      preferred_day_start: input.style.preferredDayStart,
      major_activities_per_day: input.style.majorActivitiesPerDay,
      walking_tolerance: input.style.walkingTolerance,
      food_restrictions: input.requirements.foodRestrictions,
      must_do: input.requirements.mustDo,
      would_like: input.requirements.wouldLike,
      special_requirements: input.requirements.specialRequirements,
    }
    const preferences: TripPreferences = workspace.preferences
      ? touchRecord({ ...workspace.preferences, ...preferenceValues })
      : { ...createRecordMetadata(), trip_id: tripId, notes: null, ...preferenceValues }

    const trip = workspace.trip.traveler_type !== input.travelerType ? touchRecord({ ...workspace.trip, traveler_type: input.travelerType }) : null

    await db.transaction('rw', [db.trips, db.tripDestinations, db.tripDays, db.travelLegs, db.travelers, db.tripPreferences], async () => {
      if (trip) await db.trips.put(trip)
      await db.tripDestinations.bulkPut([...destinations, ...removed.map((destination) => softDeleteRecord(destination))])
      if (days.length) await db.tripDays.bulkPut(days)
      if (legs.length) await db.travelLegs.bulkPut(legs)
      if (travelers.length) await db.travelers.bulkPut(travelers)
      await db.tripPreferences.put(preferences)
    })
    return { removedCities: removed.map((destination) => destination.city), unassignedDays: days.filter((day) => !day.destination_id).length }
  },

  async softDeleteTrip(tripId: string) {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) return
    await db.trips.put(softDeleteRecord(trip))
    if (localStorage.getItem('lastOpenedTripId') === tripId) localStorage.removeItem('lastOpenedTripId')
  },

  async duplicateTrip(tripId: string): Promise<string> {
    const workspace = await this.getWorkspace(tripId)
    if (!workspace) throw new Error('Trip not found.')

    const duplicatedTrip: Trip = {
      ...createRecordMetadata(),
      title: `${workspace.trip.title} copy`,
      status: workspace.trip.start_date ? 'planning' : 'idea',
      start_date: workspace.trip.start_date,
      end_date: workspace.trip.end_date,
      traveler_type: workspace.trip.traveler_type,
      base_currency: workspace.trip.base_currency,
      notes: workspace.trip.notes,
    }

    const destinationMap = new Map<string, string>()
    const destinations = workspace.destinations.map((destination) => {
      const record: TripDestination = { ...destination, ...createRecordMetadata(), trip_id: duplicatedTrip.id }
      destinationMap.set(destination.id, record.id)
      return record
    })

    const preference = workspace.preferences ? { ...workspace.preferences, ...createRecordMetadata(), trip_id: duplicatedTrip.id } : null
    const travelers = workspace.travelers.map((traveler) => ({ ...traveler, ...createRecordMetadata(), trip_id: duplicatedTrip.id }))
    const days = workspace.days.map((day) => ({
      ...day,
      ...createRecordMetadata(),
      trip_id: duplicatedTrip.id,
      destination_id: day.destination_id ? destinationMap.get(day.destination_id) ?? null : null,
    }))

    await db.transaction('rw', db.trips, db.tripDestinations, db.tripPreferences, db.travelers, db.tripDays, async () => {
      await db.trips.add(duplicatedTrip)
      if (destinations.length) await db.tripDestinations.bulkAdd(destinations)
      if (preference) await db.tripPreferences.add(preference)
      if (travelers.length) await db.travelers.bulkAdd(travelers)
      if (days.length) await db.tripDays.bulkAdd(days)
    })

    return duplicatedTrip.id
  },

  classifySummary(summary: TripSummary): 'current' | 'upcoming' | 'idea' | 'past' {
    const { trip } = summary
    const today = todayYmd()
    if (trip.status === 'completed' || trip.status === 'archived') return 'past'
    if (!trip.start_date || !trip.end_date || trip.status === 'idea') return 'idea'
    if (trip.status === 'traveling' || (trip.start_date <= today && trip.end_date >= today)) return 'current'
    if (trip.start_date > today) return 'upcoming'
    return 'past'
  },
}
