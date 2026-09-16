import { db } from '../db'
import type { BaseRecord, CurrencyCode } from '../types/common'
import type { Activity, Booking, BookingStatus, BookingType, Place, Stay, TravelLeg, Trip, TripDay } from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'

const active = <T extends BaseRecord>(records: T[]): T[] => records.filter((record) => record.deleted_at === null)

export type BookingLinkType = 'none' | 'activity' | 'stay' | 'travel_leg'

export interface BookingDraft {
  type: BookingType
  status: BookingStatus
  provider: string | null
  confirmationNumber: string | null
  dateTime: string | null
  cost: number | null
  currency: CurrencyCode | null
  bookingOpensAt: string | null
  cancellationDeadline: string | null
  url: string | null
  linkType: BookingLinkType
  linkId: string | null
  notes: string | null
}

export interface BookingView {
  booking: Booking
  activity: Activity | null
  activityDay: TripDay | null
  stay: Stay | null
  stayPlace: Place | null
  travelLeg: TravelLeg | null
  linkLabel: string
}

export interface BookingCenterData {
  trip: Trip
  bookings: BookingView[]
  counts: {
    all: number
    toBook: number
    booked: number
    cancelled: number
    withDeadlines: number
  }
}

export interface BookingTargetActivity {
  activity: Activity
  day: TripDay | null
  label: string
}

export interface BookingTargetStay {
  stay: Stay
  place: Place | null
  label: string
}

export interface BookingTargetTravelLeg {
  travelLeg: TravelLeg
  label: string
}

export interface BookingEditorData {
  trip: Trip
  booking: Booking | null
  activities: BookingTargetActivity[]
  stays: BookingTargetStay[]
  travelLegs: BookingTargetTravelLeg[]
}

const normalizeCost = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null
  if (value < 0) throw new Error('Booking cost cannot be negative.')
  return Math.round(value * 100) / 100
}

const normalizeCurrency = (value: CurrencyCode | null, cost: number | null) => {
  const clean = value?.trim().toUpperCase() || null
  if (!clean && cost !== null) throw new Error('Enter a 3-letter currency when a cost is provided.')
  if (clean && !/^[A-Z]{3}$/.test(clean)) throw new Error('Currency must be a 3-letter code such as TWD, JPY, or USD.')
  return clean
}

const normalizeUrl = (value: string | null) => {
  const clean = value?.trim() || null
  if (!clean) return null
  try {
    const parsed = new URL(clean)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
    return parsed.toString()
  } catch {
    throw new Error('Booking link must be a complete http:// or https:// URL.')
  }
}

const normalizeDateTime = (value: string | null, label: string) => {
  const clean = value?.trim() || null
  if (!clean) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(clean)) throw new Error(`${label} must include a valid date and time.`)
  return clean
}

const validateLink = async (tripId: string, linkType: BookingLinkType, linkId: string | null) => {
  if (linkType === 'none') return { activityId: null, stayId: null, travelLegId: null }
  if (!linkId) throw new Error('Choose what this booking is linked to.')

  if (linkType === 'activity') {
    const activity = await db.activities.get(linkId)
    if (!activity || activity.deleted_at || activity.trip_id !== tripId) throw new Error('Choose a valid activity from this trip.')
    return { activityId: activity.id, stayId: null, travelLegId: null }
  }

  if (linkType === 'stay') {
    const stay = await db.stays.get(linkId)
    if (!stay || stay.deleted_at || stay.trip_id !== tripId) throw new Error('Choose a valid stay from this trip.')
    return { activityId: null, stayId: stay.id, travelLegId: null }
  }

  const travelLeg = await db.travelLegs.get(linkId)
  if (!travelLeg || travelLeg.deleted_at || travelLeg.trip_id !== tripId) throw new Error('Choose a valid travel leg from this trip.')
  return { activityId: null, stayId: null, travelLegId: travelLeg.id }
}

const linkLabelFor = (activity: Activity | null, day: TripDay | null, stay: Stay | null, place: Place | null, travelLeg: TravelLeg | null) => {
  if (activity) return `${day ? `Day ${day.day_number} · ` : ''}${activity.title}`
  if (stay) return place?.name ? `Stay · ${place.name}` : 'Stay'
  if (travelLeg) return `${travelLeg.origin} → ${travelLeg.destination}`
  return 'Unlinked booking'
}

const bookingSortKey = (booking: Booking) => booking.date_time || booking.booking_opens_at || booking.cancellation_deadline || booking.updated_at

const toViews = async (tripId: string, bookings: Booking[]): Promise<BookingView[]> => {
  const [activitiesRaw, daysRaw, staysRaw, travelLegsRaw, placesRaw] = await Promise.all([
    db.activities.where('trip_id').equals(tripId).toArray(),
    db.tripDays.where('trip_id').equals(tripId).toArray(),
    db.stays.where('trip_id').equals(tripId).toArray(),
    db.travelLegs.where('trip_id').equals(tripId).toArray(),
    db.places.toArray(),
  ])
  const activities = active<Activity>(activitiesRaw)
  const days = active<TripDay>(daysRaw)
  const stays = active<Stay>(staysRaw)
  const travelLegs = active<TravelLeg>(travelLegsRaw)
  const places = active<Place>(placesRaw)
  const activityMap = new Map(activities.map((item) => [item.id, item]))
  const dayMap = new Map(days.map((item) => [item.id, item]))
  const stayMap = new Map(stays.map((item) => [item.id, item]))
  const travelLegMap = new Map(travelLegs.map((item) => [item.id, item]))
  const placeMap = new Map(places.map((item) => [item.id, item]))

  return bookings.map((booking) => {
    const activity = booking.activity_id ? activityMap.get(booking.activity_id) ?? null : null
    const activityDay = activity ? dayMap.get(activity.trip_day_id) ?? null : null
    const stay = booking.stay_id ? stayMap.get(booking.stay_id) ?? null : null
    const stayPlace = stay?.place_id ? placeMap.get(stay.place_id) ?? null : null
    const travelLeg = booking.travel_leg_id ? travelLegMap.get(booking.travel_leg_id) ?? null : null
    return {
      booking,
      activity,
      activityDay,
      stay,
      stayPlace,
      travelLeg,
      linkLabel: linkLabelFor(activity, activityDay, stay, stayPlace, travelLeg),
    }
  })
}

export const bookingService = {
  async getCenter(tripId: string): Promise<BookingCenterData | null> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) return null
    const bookings = active<Booking>(await db.bookings.where('trip_id').equals(tripId).toArray())
      .sort((a, b) => bookingSortKey(a).localeCompare(bookingSortKey(b)))
    const views = await toViews(tripId, bookings)
    return {
      trip,
      bookings: views,
      counts: {
        all: views.length,
        toBook: views.filter((item) => item.booking.status === 'to_book').length,
        booked: views.filter((item) => item.booking.status === 'booked').length,
        cancelled: views.filter((item) => item.booking.status === 'cancelled').length,
        withDeadlines: views.filter((item) => item.booking.booking_opens_at || item.booking.cancellation_deadline).length,
      },
    }
  },

  async getEditorData(tripId: string, bookingId?: string): Promise<BookingEditorData | null> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) return null
    const booking = bookingId ? await db.bookings.get(bookingId) : null
    if (bookingId && (!booking || booking.deleted_at || booking.trip_id !== tripId)) return null

    const [activitiesRaw, daysRaw, staysRaw, travelLegsRaw, placesRaw] = await Promise.all([
      db.activities.where('trip_id').equals(tripId).toArray(),
      db.tripDays.where('trip_id').equals(tripId).toArray(),
      db.stays.where('trip_id').equals(tripId).toArray(),
      db.travelLegs.where('trip_id').equals(tripId).toArray(),
      db.places.toArray(),
    ])
    const days = active<TripDay>(daysRaw)
    const dayMap = new Map(days.map((day) => [day.id, day]))
    const placeMap = new Map(active<Place>(placesRaw).map((place) => [place.id, place]))

    const activities = active<Activity>(activitiesRaw)
      .sort((a, b) => {
        const dayA = dayMap.get(a.trip_day_id)?.position ?? Number.MAX_SAFE_INTEGER
        const dayB = dayMap.get(b.trip_day_id)?.position ?? Number.MAX_SAFE_INTEGER
        return dayA - dayB || a.position - b.position
      })
      .map((activity) => {
        const day = dayMap.get(activity.trip_day_id) ?? null
        return { activity, day, label: `${day ? `Day ${day.day_number} · ` : ''}${activity.title}` }
      })

    const stays = active<Stay>(staysRaw).map((stay) => {
      const place = stay.place_id ? placeMap.get(stay.place_id) ?? null : null
      const dateLabel = [stay.check_in_at?.slice(0, 10), stay.check_out_at?.slice(0, 10)].filter(Boolean).join(' → ')
      return { stay, place, label: `${place?.name ?? 'Stay'}${dateLabel ? ` · ${dateLabel}` : ''}` }
    })

    const travelLegs = active<TravelLeg>(travelLegsRaw).map((travelLeg) => ({
      travelLeg,
      label: `${travelLeg.origin} → ${travelLeg.destination}${travelLeg.departure_at ? ` · ${travelLeg.departure_at.slice(0, 16).replace('T', ' ')}` : ''}`,
    }))

    return { trip, booking: booking ?? null, activities, stays, travelLegs }
  },

  async getActivityBookingMap(tripId: string): Promise<Record<string, Booking[]>> {
    const bookings = active<Booking>(await db.bookings.where('trip_id').equals(tripId).toArray())
    return bookings.reduce<Record<string, Booking[]>>((result, booking) => {
      if (!booking.activity_id) return result
      ;(result[booking.activity_id] ??= []).push(booking)
      return result
    }, {})
  },

  async createBooking(tripId: string, draft: BookingDraft): Promise<string> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) throw new Error('Trip not found.')
    const links = await validateLink(tripId, draft.linkType, draft.linkId)
    const cost = normalizeCost(draft.cost)
    const currency = normalizeCurrency(draft.currency, cost)

    const booking: Booking = {
      ...createRecordMetadata(),
      trip_id: tripId,
      type: draft.type,
      status: draft.status,
      provider: draft.provider?.trim() || null,
      confirmation_number: draft.confirmationNumber?.trim() || null,
      date_time: normalizeDateTime(draft.dateTime, 'Booking date/time'),
      cost,
      currency,
      booking_opens_at: normalizeDateTime(draft.bookingOpensAt, 'Booking-open date/time'),
      cancellation_deadline: normalizeDateTime(draft.cancellationDeadline, 'Cancellation deadline'),
      url: normalizeUrl(draft.url),
      activity_id: links.activityId,
      stay_id: links.stayId,
      travel_leg_id: links.travelLegId,
      notes: draft.notes?.trim() || null,
    }
    await db.bookings.add(booking)
    return booking.id
  },

  async updateBooking(tripId: string, bookingId: string, draft: BookingDraft) {
    const booking = await db.bookings.get(bookingId)
    if (!booking || booking.deleted_at || booking.trip_id !== tripId) throw new Error('Booking not found.')
    const links = await validateLink(tripId, draft.linkType, draft.linkId)
    const cost = normalizeCost(draft.cost)
    const currency = normalizeCurrency(draft.currency, cost)

    await db.bookings.put(touchRecord({
      ...booking,
      type: draft.type,
      status: draft.status,
      provider: draft.provider?.trim() || null,
      confirmation_number: draft.confirmationNumber?.trim() || null,
      date_time: normalizeDateTime(draft.dateTime, 'Booking date/time'),
      cost,
      currency,
      booking_opens_at: normalizeDateTime(draft.bookingOpensAt, 'Booking-open date/time'),
      cancellation_deadline: normalizeDateTime(draft.cancellationDeadline, 'Cancellation deadline'),
      url: normalizeUrl(draft.url),
      activity_id: links.activityId,
      stay_id: links.stayId,
      travel_leg_id: links.travelLegId,
      notes: draft.notes?.trim() || null,
    }))
  },

  async setStatus(bookingId: string, status: BookingStatus) {
    const booking = await db.bookings.get(bookingId)
    if (!booking || booking.deleted_at) throw new Error('Booking not found.')
    await db.bookings.put(touchRecord({ ...booking, status }))
  },

  async softDeleteBooking(bookingId: string) {
    const booking = await db.bookings.get(bookingId)
    if (!booking || booking.deleted_at) return
    await db.bookings.put(softDeleteRecord(booking))
  },
}
