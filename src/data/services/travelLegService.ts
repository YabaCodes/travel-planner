import { db } from '../db'
import type { BaseRecord } from '../types/common'
import type { Booking, TransportMode, TravelLeg, Trip, TripDestination } from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'

const active = <T extends BaseRecord>(records: T[]): T[] => records.filter((record) => record.deleted_at === null)

export interface TravelLegDraft {
  fromDestinationId: string | null
  toDestinationId: string | null
  mode: TransportMode
  operator: string | null
  serviceNumber: string | null
  origin: string
  destination: string
  departureAt: string | null
  arrivalAt: string | null
  notes: string | null
}

export interface TravelLegView {
  leg: TravelLeg
  fromDestination: TripDestination | null
  toDestination: TripDestination | null
  bookings: Booking[]
}

export interface TravelLegCenterData {
  trip: Trip
  destinations: TripDestination[]
  legs: TravelLegView[]
  counts: {
    all: number
    withBookings: number
    booked: number
    unbooked: number
  }
}

export interface TravelLegEditorData {
  trip: Trip
  destinations: TripDestination[]
  leg: TravelLeg | null
}

const getTrip = async (tripId: string) => {
  const trip = await db.trips.get(tripId)
  return trip && !trip.deleted_at ? trip : null
}

const normalizeDateTime = (value: string | null, label: string) => {
  const clean = value?.trim() || null
  if (!clean) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(clean) || Number.isNaN(Date.parse(clean))) throw new Error(`${label} must include a valid date and time.`)
  return clean.slice(0, 16)
}

// Local times at each end can't be compared exactly without time zones: flying east across the date
// line (Taipei → San Francisco) really does arrive "before" it leaves. No trip differs by more than
// 26 hours of time zone, so anything earlier than that is a typo.
const MAX_ZONE_GAP_MINUTES = 26 * 60
export const arrivalLooksEarly = (departureAt: string | null, arrivalAt: string | null) =>
  Boolean(departureAt && arrivalAt && arrivalAt < departureAt)

const validateTimes = (departureAt: string | null, arrivalAt: string | null) => {
  if (!departureAt || !arrivalAt) return
  const gap = (Date.parse(`${departureAt}:00Z`) - Date.parse(`${arrivalAt}:00Z`)) / 60000
  if (gap > MAX_ZONE_GAP_MINUTES) throw new Error('Arrival is more than a day before departure. Check the dates.')
}

// Links a leg to a trip city when its origin or destination names that city ("Paris Gare du Nord").
const matchDestination = (text: string, destinations: TripDestination[]) => {
  const lower = text.toLowerCase()
  return destinations.find((destination) => destination.city && new RegExp(`(^|[^\\p{L}])${destination.city.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(lower)) ?? null
}

const validateDestination = async (tripId: string, destinationId: string | null, label: string) => {
  if (!destinationId) return null
  const destination = await db.tripDestinations.get(destinationId)
  if (!destination || destination.deleted_at || destination.trip_id !== tripId) throw new Error(`${label} must belong to this trip.`)
  return destination
}

const validateDraft = async (tripId: string, draft: TravelLegDraft) => {
  const origin = draft.origin.trim()
  const destination = draft.destination.trim()
  if (!origin) throw new Error('Origin is required.')
  if (!destination) throw new Error('Destination is required.')
  if (draft.fromDestinationId && draft.toDestinationId && draft.fromDestinationId === draft.toDestinationId) {
    throw new Error('Choose two different linked destinations, or leave one of them unlinked.')
  }

  await Promise.all([
    validateDestination(tripId, draft.fromDestinationId, 'From destination'),
    validateDestination(tripId, draft.toDestinationId, 'To destination'),
  ])

  const departureAt = normalizeDateTime(draft.departureAt, 'Departure')
  const arrivalAt = normalizeDateTime(draft.arrivalAt, 'Arrival')
  validateTimes(departureAt, arrivalAt)
  return {
    origin,
    destination,
    operator: draft.operator?.trim() || null,
    serviceNumber: draft.serviceNumber?.trim() || null,
    departureAt,
    arrivalAt,
    notes: draft.notes?.trim() || null,
  }
}

const legSortKey = (leg: TravelLeg) => leg.departure_at || leg.arrival_at || leg.created_at

export const travelLegService = {
  async getCenter(tripId: string): Promise<TravelLegCenterData | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null

    const [destinationsRaw, legsRaw, bookingsRaw] = await Promise.all([
      db.tripDestinations.where('trip_id').equals(tripId).toArray(),
      db.travelLegs.where('trip_id').equals(tripId).toArray(),
      db.bookings.where('trip_id').equals(tripId).toArray(),
    ])

    const destinations = active(destinationsRaw).sort((a, b) => a.sequence - b.sequence)
    const legs = active(legsRaw).sort((a, b) => legSortKey(a).localeCompare(legSortKey(b)))
    const bookings = active(bookingsRaw)
    const destinationMap = new Map(destinations.map((destination) => [destination.id, destination]))

    const views = legs.map((leg): TravelLegView => ({
      leg,
      fromDestination: leg.from_destination_id ? destinationMap.get(leg.from_destination_id) ?? null : null,
      toDestination: leg.to_destination_id ? destinationMap.get(leg.to_destination_id) ?? null : null,
      bookings: bookings.filter((booking) => booking.travel_leg_id === leg.id),
    }))

    const withBookings = views.filter((view) => view.bookings.some((booking) => booking.status !== 'cancelled')).length
    const booked = views.filter((view) => view.bookings.some((booking) => booking.status === 'booked')).length

    return {
      trip,
      destinations,
      legs: views,
      counts: {
        all: views.length,
        withBookings,
        booked,
        unbooked: Math.max(0, views.length - withBookings),
      },
    }
  },

  async getEditorData(tripId: string, travelLegId?: string): Promise<TravelLegEditorData | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null
    const destinations = active(await db.tripDestinations.where('trip_id').equals(tripId).toArray()).sort((a, b) => a.sequence - b.sequence)
    if (!travelLegId) return { trip, destinations, leg: null }
    const leg = await db.travelLegs.get(travelLegId)
    if (!leg || leg.deleted_at || leg.trip_id !== tripId) return { trip, destinations, leg: null }
    return { trip, destinations, leg }
  },

  async createTravelLeg(tripId: string, draft: TravelLegDraft): Promise<string> {
    const trip = await getTrip(tripId)
    if (!trip) throw new Error('Trip not found.')
    const validated = await validateDraft(tripId, draft)
    // New legs that name a trip city are linked to it, so readiness can check the route.
    const destinations = active(await db.tripDestinations.where('trip_id').equals(tripId).toArray())
    let fromId = draft.fromDestinationId ?? matchDestination(validated.origin, destinations)?.id ?? null
    let toId = draft.toDestinationId ?? matchDestination(validated.destination, destinations)?.id ?? null
    if (fromId && fromId === toId) {
      fromId = draft.fromDestinationId
      toId = draft.toDestinationId
    }

    const leg: TravelLeg = {
      ...createRecordMetadata(),
      trip_id: tripId,
      from_destination_id: fromId,
      to_destination_id: toId,
      mode: draft.mode,
      operator: validated.operator,
      service_number: validated.serviceNumber,
      origin: validated.origin,
      destination: validated.destination,
      departure_at: validated.departureAt,
      arrival_at: validated.arrivalAt,
      booking_id: null,
      notes: validated.notes,
    }
    await db.travelLegs.add(leg)
    return leg.id
  },

  async updateTravelLeg(tripId: string, travelLegId: string, draft: TravelLegDraft) {
    const leg = await db.travelLegs.get(travelLegId)
    if (!leg || leg.deleted_at || leg.trip_id !== tripId) throw new Error('Travel leg not found.')
    const validated = await validateDraft(tripId, draft)

    await db.travelLegs.put(touchRecord({
      ...leg,
      from_destination_id: draft.fromDestinationId,
      to_destination_id: draft.toDestinationId,
      mode: draft.mode,
      operator: validated.operator,
      service_number: validated.serviceNumber,
      origin: validated.origin,
      destination: validated.destination,
      departure_at: validated.departureAt,
      arrival_at: validated.arrivalAt,
      notes: validated.notes,
    }))
  },

  async softDeleteTravelLeg(travelLegId: string) {
    const leg = await db.travelLegs.get(travelLegId)
    if (!leg || leg.deleted_at) return
    const linkedBookings = active(await db.bookings.where('travel_leg_id').equals(travelLegId).toArray())
    await db.transaction('rw', [db.travelLegs, db.bookings], async () => {
      await db.travelLegs.put(softDeleteRecord(leg))
      for (const booking of linkedBookings) {
        await db.bookings.put(touchRecord({ ...booking, travel_leg_id: null }))
      }
    })
  },
}
