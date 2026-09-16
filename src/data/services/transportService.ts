import { db } from '../db'
import type { CurrencyCode } from '../types/common'
import type { Activity, TransportMode, TransportSegment } from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'

export interface TransportSegmentDraft {
  tripDayId: string
  fromActivityId: string
  toActivityId: string
  mode: TransportMode
  departureTime: string | null
  durationMinutes: number | null
  cost: number | null
  currency: CurrencyCode | null
  routeNotes: string | null
}

export interface TransportSegmentView {
  segment: TransportSegment
  fromActivity: Activity
  toActivity: Activity
}

export interface DayTransportData {
  segments: TransportSegmentView[]
  totalMinutes: number
}

const active = <T extends { deleted_at: string | null }>(records: T[]) => records.filter((record) => record.deleted_at === null)

const validateClockTime = (value: string | null) => {
  if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Departure time must use HH:MM format.')
}

const normalizeDuration = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null
  if (value < 1 || value > 1440) throw new Error('Transport duration must be between 1 and 1440 minutes.')
  return Math.round(value)
}

const normalizeCost = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null
  if (value < 0) throw new Error('Transport cost cannot be negative.')
  return Math.round(value * 100) / 100
}

const normalizeCurrency = (value: CurrencyCode | null, cost: number | null) => {
  const clean = value?.trim().toUpperCase() || null
  if (!clean && cost !== null) throw new Error('Enter a 3-letter currency when a cost is provided.')
  if (clean && !/^[A-Z]{3}$/.test(clean)) throw new Error('Currency must be a 3-letter code such as TWD, JPY, or USD.')
  return clean
}

const resolvePlaceId = async (activity: Activity) => {
  if (!activity.trip_place_id) return null
  const tripPlace = await db.tripPlaces.get(activity.trip_place_id)
  if (!tripPlace || tripPlace.deleted_at) return null
  const place = await db.places.get(tripPlace.place_id)
  return place && !place.deleted_at ? place.id : null
}

const validateEndpoints = async (tripId: string, dayId: string, fromActivityId: string, toActivityId: string) => {
  if (fromActivityId === toActivityId) throw new Error('Choose two different activities.')
  const [day, fromActivity, toActivity] = await Promise.all([
    db.tripDays.get(dayId),
    db.activities.get(fromActivityId),
    db.activities.get(toActivityId),
  ])
  if (!day || day.deleted_at || day.trip_id !== tripId) throw new Error('Trip day not found.')
  if (!fromActivity || fromActivity.deleted_at || fromActivity.trip_id !== tripId || fromActivity.trip_day_id !== dayId) throw new Error('Choose a valid starting activity from this day.')
  if (!toActivity || toActivity.deleted_at || toActivity.trip_id !== tripId || toActivity.trip_day_id !== dayId) throw new Error('Choose a valid destination activity from this day.')
  return { fromActivity, toActivity }
}

const duplicateConnectionExists = async (dayId: string, fromActivityId: string, toActivityId: string, excludingId?: string) => {
  const segments = active(await db.transportSegments.where('trip_day_id').equals(dayId).toArray())
  return segments.some((segment) => segment.id !== excludingId && segment.from_activity_id === fromActivityId && segment.to_activity_id === toActivityId)
}

export const transportService = {
  async getDaySegments(tripId: string, dayId: string): Promise<DayTransportData> {
    const segments = active(await db.transportSegments.where('trip_day_id').equals(dayId).toArray())
      .filter((segment) => segment.trip_id === tripId)

    const views = await Promise.all(segments.map(async (segment): Promise<TransportSegmentView | null> => {
      if (!segment.from_activity_id || !segment.to_activity_id) return null
      const [fromActivity, toActivity] = await Promise.all([
        db.activities.get(segment.from_activity_id),
        db.activities.get(segment.to_activity_id),
      ])
      if (!fromActivity || fromActivity.deleted_at || fromActivity.trip_day_id !== dayId) return null
      if (!toActivity || toActivity.deleted_at || toActivity.trip_day_id !== dayId) return null
      return { segment, fromActivity, toActivity }
    }))

    const valid = views
      .filter((view): view is TransportSegmentView => view !== null)
      .sort((a, b) => a.fromActivity.position - b.fromActivity.position || a.segment.position - b.segment.position)

    return {
      segments: valid,
      totalMinutes: valid.reduce((sum, view) => sum + (view.segment.duration_minutes ?? 0), 0),
    }
  },

  async getSegment(tripId: string, segmentId: string): Promise<TransportSegment | null> {
    const segment = await db.transportSegments.get(segmentId)
    if (!segment || segment.deleted_at || segment.trip_id !== tripId) return null
    return segment
  },

  async createSegment(tripId: string, draft: TransportSegmentDraft): Promise<string> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) throw new Error('Trip not found.')
    const { fromActivity, toActivity } = await validateEndpoints(tripId, draft.tripDayId, draft.fromActivityId, draft.toActivityId)
    if (await duplicateConnectionExists(draft.tripDayId, draft.fromActivityId, draft.toActivityId)) {
      throw new Error('A transport segment already connects these two activities.')
    }
    validateClockTime(draft.departureTime)
    const duration = normalizeDuration(draft.durationMinutes)
    const cost = normalizeCost(draft.cost)
    const currency = normalizeCurrency(draft.currency, cost)
    const [fromPlaceId, toPlaceId] = await Promise.all([resolvePlaceId(fromActivity), resolvePlaceId(toActivity)])

    const segment: TransportSegment = {
      ...createRecordMetadata(),
      trip_id: tripId,
      trip_day_id: draft.tripDayId,
      from_activity_id: fromActivity.id,
      to_activity_id: toActivity.id,
      from_place_id: fromPlaceId,
      to_place_id: toPlaceId,
      mode: draft.mode,
      departure_time: draft.departureTime,
      duration_minutes: duration,
      cost,
      currency,
      route_notes: draft.routeNotes?.trim() || null,
      position: fromActivity.position,
    }

    await db.transportSegments.add(segment)
    return segment.id
  },

  async updateSegment(tripId: string, segmentId: string, draft: TransportSegmentDraft) {
    const segment = await db.transportSegments.get(segmentId)
    if (!segment || segment.deleted_at || segment.trip_id !== tripId) throw new Error('Transport segment not found.')
    const { fromActivity, toActivity } = await validateEndpoints(tripId, draft.tripDayId, draft.fromActivityId, draft.toActivityId)
    if (await duplicateConnectionExists(draft.tripDayId, draft.fromActivityId, draft.toActivityId, segmentId)) {
      throw new Error('A transport segment already connects these two activities.')
    }
    validateClockTime(draft.departureTime)
    const duration = normalizeDuration(draft.durationMinutes)
    const cost = normalizeCost(draft.cost)
    const currency = normalizeCurrency(draft.currency, cost)
    const [fromPlaceId, toPlaceId] = await Promise.all([resolvePlaceId(fromActivity), resolvePlaceId(toActivity)])

    await db.transportSegments.put(touchRecord({
      ...segment,
      trip_day_id: draft.tripDayId,
      from_activity_id: fromActivity.id,
      to_activity_id: toActivity.id,
      from_place_id: fromPlaceId,
      to_place_id: toPlaceId,
      mode: draft.mode,
      departure_time: draft.departureTime,
      duration_minutes: duration,
      cost,
      currency,
      route_notes: draft.routeNotes?.trim() || null,
      position: fromActivity.position,
    }))
  },

  async softDeleteSegment(segmentId: string) {
    const segment = await db.transportSegments.get(segmentId)
    if (!segment || segment.deleted_at) return
    await db.transportSegments.put(softDeleteRecord(segment))
  },
}
