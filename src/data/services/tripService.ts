import { db } from '../db'
import type {
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
import { enumerateDates, inclusiveDayCount, todayYmd } from '../utils/tripDate'

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
      timezone: destination.timezone || 'UTC',
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

    return {
      ...workspace,
      counts: {
        activities: active(activities).length,
        places: active(places).length,
        bookings: active(bookings).length,
        packingItems: active(packingItems).length,
      },
    }
  },

  async getDateChangeImpact(tripId: string, startDate: string | null, endDate: string | null) {
    validateDateRange(startDate, endDate)
    const days = active(await db.tripDays.where('trip_id').equals(tripId).toArray()).sort((a, b) => a.position - b.position)
    const targetCount = startDate && endDate ? inclusiveDayCount(startDate, endDate) : 0
    const removedDays = days.slice(targetCount)
    const removedIds = removedDays.map((day) => day.id)
    const activities = removedIds.length ? active(await db.activities.where('trip_day_id').anyOf(removedIds).toArray()) : []
    return { removedDayCount: removedDays.length, affectedActivityCount: activities.length }
  },

  async updateTripBasics(tripId: string, values: { title: string; status: TripStatus; startDate: string | null; endDate: string | null; notes: string | null }) {
    validateDateRange(values.startDate, values.endDate)
    const workspace = await this.getWorkspace(tripId)
    if (!workspace) throw new Error('Trip not found.')
    if (!values.title.trim()) throw new Error('Trip title is required.')

    const targetDates = values.startDate && values.endDate ? enumerateDates(values.startDate, values.endDate) : []
    const currentDays = workspace.days
    const destinationForNewDays = workspace.destinations.length === 1 ? workspace.destinations[0].id : null

    const updatedTrip: Trip = touchRecord({
      ...workspace.trip,
      title: values.title.trim(),
      status: values.status,
      start_date: values.startDate,
      end_date: values.endDate,
      notes: values.notes,
    })

    const changedDays: TripDay[] = []
    const removedDays: TripDay[] = []

    targetDates.forEach((date, index) => {
      const existing = currentDays[index]
      if (existing) {
        changedDays.push(touchRecord({ ...existing, date, day_number: index + 1, position: (index + 1) * 100 }))
      } else {
        changedDays.push({
          ...createRecordMetadata(),
          trip_id: tripId,
          destination_id: destinationForNewDays,
          date,
          day_number: index + 1,
          title: null,
          position: (index + 1) * 100,
          notes: null,
        })
      }
    })

    currentDays.slice(targetDates.length).forEach((day) => removedDays.push(softDeleteRecord(day)))

    await db.transaction('rw', db.trips, db.tripDays, async () => {
      await db.trips.put(updatedTrip)
      if (changedDays.length) await db.tripDays.bulkPut(changedDays)
      if (removedDays.length) await db.tripDays.bulkPut(removedDays)
    })
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
