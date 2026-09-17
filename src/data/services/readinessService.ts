import { db } from '../db'
import type { BaseRecord } from '../types/common'
import type { Activity, Booking, PackingItem, TravelLeg, Trip, TripDay, TripInfoItem } from '../types/entities'
import { findActivityOverlaps } from '../utils/activityTime'

const active = <T extends BaseRecord>(records: T[]): T[] => records.filter((record) => record.deleted_at === null)

export type ReadinessStatus = 'ready' | 'review' | 'action'
export type ReadinessState = 'ready' | 'review' | 'attention'

export interface ReadinessCheck {
  id: string
  label: string
  category: string
  status: ReadinessStatus
  detail: string
  path: string
}

export interface TripReadinessData {
  trip: Trip
  checks: ReadinessCheck[]
  summary: {
    total: number
    ready: number
    review: number
    action: number
    state: ReadinessState
  }
  inventory: {
    totalDays: number
    plannedDays: number
    emptyDays: number
    unassignedDays: number
    conflicts: number
    requiredBookingActivities: number
    missingRequiredBookings: number
    toBookBookings: number
    packingItems: number
    packedUnits: number
    totalPackingUnits: number
    requiredPackingRemaining: number
    travelLegs: number
    tripInfoSections: number
    tripInfoItems: number
  }
}

const activeDayActivities = (activities: Activity[], day: TripDay) => activities
  .filter((activity) => activity.trip_day_id === day.id && activity.status !== 'cancelled' && activity.status !== 'skipped')

const linkedBooked = (bookings: Booking[], activityId: string) => bookings
  .some((booking) => booking.activity_id === activityId && booking.status === 'booked')

const packingMetrics = (items: PackingItem[]) => {
  const totalPackingUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const packedUnits = items.reduce((sum, item) => sum + Math.min(item.quantity, item.packed_quantity), 0)
  const requiredPackingRemaining = items.filter((item) => item.required && item.packed_quantity < item.quantity).length
  return { totalPackingUnits, packedUnits, requiredPackingRemaining }
}

const travelLegTimingReview = (legs: TravelLeg[]) => legs.filter((leg) => !leg.departure_at || !leg.arrival_at).length

export const readinessService = {
  async getReadiness(tripId: string): Promise<TripReadinessData | null> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) return null

    const [destinationsRaw, daysRaw, activitiesRaw, bookingsRaw, packingListsRaw, travelLegsRaw, infoSectionsRaw] = await Promise.all([
      db.tripDestinations.where('trip_id').equals(tripId).toArray(),
      db.tripDays.where('trip_id').equals(tripId).toArray(),
      db.activities.where('trip_id').equals(tripId).toArray(),
      db.bookings.where('trip_id').equals(tripId).toArray(),
      db.packingLists.where('trip_id').equals(tripId).toArray(),
      db.travelLegs.where('trip_id').equals(tripId).toArray(),
      db.tripInfoSections.where('trip_id').equals(tripId).toArray(),
    ])

    const destinations = active(destinationsRaw).sort((a, b) => a.sequence - b.sequence)
    const days = active(daysRaw).sort((a, b) => a.position - b.position)
    const activities = active(activitiesRaw)
    const bookings = active(bookingsRaw)
    const packingLists = active(packingListsRaw)
    const travelLegs = active(travelLegsRaw)
    const infoSections = active(infoSectionsRaw)

    const packingItems = packingLists.length
      ? active(await db.packingItems.where('packing_list_id').anyOf(packingLists.map((list) => list.id)).toArray())
      : []
    const infoItems: TripInfoItem[] = infoSections.length
      ? active(await db.tripInfoItems.where('section_id').anyOf(infoSections.map((section) => section.id)).toArray())
      : []

    const hasDates = Boolean(trip.start_date && trip.end_date)
    const plannedDays = days.filter((day) => activeDayActivities(activities, day).length > 0).length
    const emptyDays = Math.max(0, days.length - plannedDays)
    const unassignedDays = destinations.length > 1 ? days.filter((day) => !day.destination_id).length : 0
    const conflicts = days.reduce((sum, day) => sum + findActivityOverlaps(activities.filter((activity) => activity.trip_day_id === day.id)).length, 0)

    const bookingRelevantActivities = activities.filter((activity) => activity.status !== 'cancelled' && activity.status !== 'skipped')
    const requiredBookingActivities = bookingRelevantActivities.filter((activity) => activity.booking_requirement === 'required')
    const missingRequiredBookings = requiredBookingActivities.filter((activity) => !linkedBooked(bookings, activity.id)).length
    const toBookBookings = bookings.filter((booking) => booking.status === 'to_book').length

    const { totalPackingUnits, packedUnits, requiredPackingRemaining } = packingMetrics(packingItems)
    const expectedTravelLegs = Math.max(0, destinations.length - 1)
    const missingTravelLegs = Math.max(0, expectedTravelLegs - travelLegs.length)
    const incompleteTravelLegTimes = travelLegTimingReview(travelLegs)

    const checks: ReadinessCheck[] = []

    checks.push({
      id: 'dates',
      label: 'Trip dates',
      category: 'Basics',
      status: hasDates ? 'ready' : 'action',
      detail: hasDates ? `${trip.start_date} → ${trip.end_date}` : 'Set departure and return dates before travel.',
      path: `/trip/${tripId}/edit`,
    })

    checks.push({
      id: 'itinerary',
      label: 'Daily itinerary',
      category: 'Itinerary',
      status: !hasDates || days.length === 0 ? 'review' : emptyDays > 0 ? 'action' : 'ready',
      detail: !hasDates || days.length === 0
        ? 'Set trip dates to generate dated trip days.'
        : emptyDays > 0
          ? `${emptyDays} of ${days.length} trip day${days.length === 1 ? '' : 's'} have no active activities.`
          : `All ${days.length} trip day${days.length === 1 ? '' : 's'} have a plan.`,
      path: `/trip/${tripId}/itinerary`,
    })

    checks.push({
      id: 'destinations',
      label: 'Destination assignments',
      category: 'Itinerary',
      status: destinations.length <= 1 || unassignedDays === 0 ? 'ready' : 'action',
      detail: destinations.length <= 1
        ? 'Single-destination trip; no day assignment needed.'
        : unassignedDays > 0
          ? `${unassignedDays} day${unassignedDays === 1 ? '' : 's'} still need a destination.`
          : 'Every trip day is assigned to a destination.',
      path: `/trip/${tripId}/itinerary`,
    })

    checks.push({
      id: 'conflicts',
      label: 'Schedule conflicts',
      category: 'Itinerary',
      status: conflicts > 0 ? 'action' : 'ready',
      detail: conflicts > 0
        ? `${conflicts} timed overlap${conflicts === 1 ? '' : 's'} detected in the itinerary.`
        : 'No timed activity overlaps detected.',
      path: `/trip/${tripId}/itinerary`,
    })

    const bookingNeedsAction = missingRequiredBookings > 0 || toBookBookings > 0
    checks.push({
      id: 'bookings',
      label: 'Bookings',
      category: 'Reservations',
      status: bookingNeedsAction ? 'action' : 'ready',
      detail: bookingNeedsAction
        ? [
            missingRequiredBookings ? `${missingRequiredBookings} required activit${missingRequiredBookings === 1 ? 'y has' : 'ies have'} no confirmed booking` : null,
            toBookBookings ? `${toBookBookings} booking record${toBookBookings === 1 ? '' : 's'} still marked To book` : null,
          ].filter(Boolean).join(' · ')
        : requiredBookingActivities.length
          ? `All ${requiredBookingActivities.length} required booking${requiredBookingActivities.length === 1 ? '' : 's'} are confirmed.`
          : 'No required bookings are outstanding.',
      path: `/trip/${tripId}/more/bookings`,
    })

    let packingStatus: ReadinessStatus = 'ready'
    let packingDetail = 'Packing checklist is complete.'
    if (packingItems.length === 0) {
      packingStatus = 'review'
      packingDetail = 'Packing checklist has not been started yet.'
    } else if (requiredPackingRemaining > 0) {
      packingStatus = 'action'
      packingDetail = `${requiredPackingRemaining} required packing item${requiredPackingRemaining === 1 ? '' : 's'} still incomplete.`
    } else if (packedUnits < totalPackingUnits) {
      packingStatus = 'review'
      packingDetail = `${packedUnits} of ${totalPackingUnits} packing units are packed; required items are complete.`
    }
    checks.push({
      id: 'packing',
      label: 'Packing',
      category: 'Preparation',
      status: packingStatus,
      detail: packingDetail,
      path: `/trip/${tripId}/more/packing`,
    })

    let travelLegStatus: ReadinessStatus = 'ready'
    let travelLegDetail = destinations.length <= 1 && travelLegs.length === 0
      ? 'No inter-destination travel leg is required.'
      : `${travelLegs.length} major travel leg${travelLegs.length === 1 ? '' : 's'} recorded.`
    if (missingTravelLegs > 0) {
      travelLegStatus = 'action'
      travelLegDetail = `${missingTravelLegs} inter-destination travel leg${missingTravelLegs === 1 ? '' : 's'} still appear to be missing.`
    } else if (incompleteTravelLegTimes > 0) {
      travelLegStatus = 'review'
      travelLegDetail = `${incompleteTravelLegTimes} travel leg${incompleteTravelLegTimes === 1 ? '' : 's'} are missing departure or arrival time.`
    }
    checks.push({
      id: 'travel-legs',
      label: 'Major travel',
      category: 'Transport',
      status: travelLegStatus,
      detail: travelLegDetail,
      path: `/trip/${tripId}/more/travel-legs`,
    })

    checks.push({
      id: 'trip-info',
      label: 'Trip information',
      category: 'Reference',
      status: infoItems.length > 0 ? 'ready' : 'review',
      detail: infoItems.length > 0
        ? `${infoItems.length} offline reference item${infoItems.length === 1 ? '' : 's'} stored across ${infoSections.length} section${infoSections.length === 1 ? '' : 's'}.`
        : 'No offline trip-reference information has been added yet.',
      path: `/trip/${tripId}/more/trip-info`,
    })

    const ready = checks.filter((check) => check.status === 'ready').length
    const review = checks.filter((check) => check.status === 'review').length
    const action = checks.filter((check) => check.status === 'action').length
    const state: ReadinessState = action > 0 ? 'attention' : review > 0 ? 'review' : 'ready'

    return {
      trip,
      checks,
      summary: { total: checks.length, ready, review, action, state },
      inventory: {
        totalDays: days.length,
        plannedDays,
        emptyDays,
        unassignedDays,
        conflicts,
        requiredBookingActivities: requiredBookingActivities.length,
        missingRequiredBookings,
        toBookBookings,
        packingItems: packingItems.length,
        packedUnits,
        totalPackingUnits,
        requiredPackingRemaining,
        travelLegs: travelLegs.length,
        tripInfoSections: infoSections.length,
        tripInfoItems: infoItems.length,
      },
    }
  },
}
