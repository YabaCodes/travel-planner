import { db } from '../db'
import type { Activity, Place, PlaceCategory, Priority, TripDay, TripPlace } from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'
import { itineraryService } from './itineraryService'

export type PlaceLifecycleStatus = 'saved' | 'scheduled' | 'visited'

export interface PlaceDraft {
  name: string
  category: PlaceCategory
  city: string | null
  area: string | null
  address: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  priority: Priority
  estimatedVisitMinutes: number | null
  placeNotes: string | null
  tripNotes: string | null
}

export interface TripPlaceView {
  tripPlace: TripPlace
  place: Place
  status: PlaceLifecycleStatus
  scheduledCount: number
  completedCount: number
}

const active = <T extends { deleted_at: string | null }>(records: T[]) => records.filter((record) => record.deleted_at === null)

const cleanNullable = (value: string | null) => value?.trim() || null

const normalizeWebsite = (value: string | null) => {
  const clean = cleanNullable(value)
  if (!clean) return null
  if (/^https?:\/\//i.test(clean)) return clean
  return `https://${clean}`
}

const validateCoordinate = (value: number | null, min: number, max: number, label: string) => {
  if (value === null || Number.isNaN(value)) return null
  if (value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`)
  return value
}

const validateDuration = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null
  if (value < 5 || value > 1440) throw new Error('Expected visit duration must be between 5 and 1440 minutes.')
  return Math.round(value)
}

const statusFor = (tripPlaceId: string, activities: Activity[]): Pick<TripPlaceView, 'status' | 'scheduledCount' | 'completedCount'> => {
  const related = activities.filter((activity) => activity.trip_place_id === tripPlaceId && activity.status !== 'cancelled')
  const completedCount = related.filter((activity) => activity.status === 'completed').length
  const scheduledCount = related.length
  return {
    status: completedCount > 0 ? 'visited' : scheduledCount > 0 ? 'scheduled' : 'saved',
    scheduledCount,
    completedCount,
  }
}

export const placeService = {
  async listTripPlaces(tripId: string): Promise<TripPlaceView[]> {
    const [tripPlacesRaw, activitiesRaw] = await Promise.all([
      db.tripPlaces.where('trip_id').equals(tripId).toArray(),
      db.activities.where('trip_id').equals(tripId).toArray(),
    ])
    const tripPlaces = active(tripPlacesRaw)
    const activities = active(activitiesRaw)
    const places = await db.places.bulkGet(tripPlaces.map((tripPlace) => tripPlace.place_id))

    return tripPlaces
      .map((tripPlace, index) => {
        const place = places[index]
        if (!place || place.deleted_at) return null
        return {
          tripPlace,
          place,
          ...statusFor(tripPlace.id, activities),
        } satisfies TripPlaceView
      })
      .filter((item): item is TripPlaceView => item !== null)
      .sort((a, b) => a.place.name.localeCompare(b.place.name))
  },

  async getTripPlace(tripId: string, tripPlaceId: string): Promise<TripPlaceView | null> {
    const tripPlace = await db.tripPlaces.get(tripPlaceId)
    if (!tripPlace || tripPlace.deleted_at || tripPlace.trip_id !== tripId) return null
    const place = await db.places.get(tripPlace.place_id)
    if (!place || place.deleted_at) return null
    const activities = active(await db.activities.where('trip_id').equals(tripId).toArray())
    return { tripPlace, place, ...statusFor(tripPlace.id, activities) }
  },

  async createTripPlace(tripId: string, draft: PlaceDraft): Promise<string> {
    const trip = await db.trips.get(tripId)
    if (!trip || trip.deleted_at) throw new Error('Trip not found.')
    if (!draft.name.trim()) throw new Error('Place name is required.')

    const place: Place = {
      ...createRecordMetadata(),
      name: draft.name.trim(),
      category: draft.category,
      city: cleanNullable(draft.city),
      area: cleanNullable(draft.area),
      address: cleanNullable(draft.address),
      website: normalizeWebsite(draft.website),
      latitude: validateCoordinate(draft.latitude, -90, 90, 'Latitude'),
      longitude: validateCoordinate(draft.longitude, -180, 180, 'Longitude'),
      notes: cleanNullable(draft.placeNotes),
    }

    const tripPlace: TripPlace = {
      ...createRecordMetadata(),
      trip_id: tripId,
      place_id: place.id,
      priority: draft.priority,
      estimated_visit_minutes: validateDuration(draft.estimatedVisitMinutes),
      notes: cleanNullable(draft.tripNotes),
    }

    await db.transaction('rw', [db.places, db.tripPlaces], async () => {
      await db.places.add(place)
      await db.tripPlaces.add(tripPlace)
    })

    return tripPlace.id
  },

  async updateTripPlace(tripId: string, tripPlaceId: string, draft: PlaceDraft) {
    const tripPlace = await db.tripPlaces.get(tripPlaceId)
    if (!tripPlace || tripPlace.deleted_at || tripPlace.trip_id !== tripId) throw new Error('Saved place not found.')
    const place = await db.places.get(tripPlace.place_id)
    if (!place || place.deleted_at) throw new Error('Place record not found.')
    if (!draft.name.trim()) throw new Error('Place name is required.')

    const nextPlace = touchRecord({
      ...place,
      name: draft.name.trim(),
      category: draft.category,
      city: cleanNullable(draft.city),
      area: cleanNullable(draft.area),
      address: cleanNullable(draft.address),
      website: normalizeWebsite(draft.website),
      latitude: validateCoordinate(draft.latitude, -90, 90, 'Latitude'),
      longitude: validateCoordinate(draft.longitude, -180, 180, 'Longitude'),
      notes: cleanNullable(draft.placeNotes),
    })
    const nextTripPlace = touchRecord({
      ...tripPlace,
      priority: draft.priority,
      estimated_visit_minutes: validateDuration(draft.estimatedVisitMinutes),
      notes: cleanNullable(draft.tripNotes),
    })

    await db.transaction('rw', [db.places, db.tripPlaces], async () => {
      await db.places.put(nextPlace)
      await db.tripPlaces.put(nextTripPlace)
    })
  },

  async removeTripPlace(tripId: string, tripPlaceId: string) {
    const tripPlace = await db.tripPlaces.get(tripPlaceId)
    if (!tripPlace || tripPlace.deleted_at || tripPlace.trip_id !== tripId) return
    const relatedActivities = active(await db.activities.where('trip_id').equals(tripId).toArray())
      .filter((activity) => activity.trip_place_id === tripPlaceId)
    if (relatedActivities.length > 0) {
      throw new Error('This place is used by itinerary activities. Change or delete those activities before removing it from the library.')
    }

    const place = await db.places.get(tripPlace.place_id)
    await db.transaction('rw', [db.tripPlaces, db.places], async () => {
      await db.tripPlaces.put(softDeleteRecord(tripPlace))
      if (place && !place.deleted_at) await db.places.put(softDeleteRecord(place))
    })
  },

  async scheduleTripPlace(values: {
    tripId: string
    tripPlaceId: string
    tripDayId: string
    startTime: string | null
    bookingRequirement: 'none' | 'recommended' | 'required'
    timeLocked: boolean
  }): Promise<string> {
    const view = await this.getTripPlace(values.tripId, values.tripPlaceId)
    if (!view) throw new Error('Saved place not found.')
    const day: TripDay | undefined = await db.tripDays.get(values.tripDayId)
    if (!day || day.deleted_at || day.trip_id !== values.tripId) throw new Error('Choose a valid trip day.')

    return itineraryService.createActivity(values.tripId, {
      tripDayId: day.id,
      tripPlaceId: view.tripPlace.id,
      title: view.place.name,
      type: 'place',
      priority: view.tripPlace.priority,
      bookingRequirement: values.bookingRequirement,
      status: 'planned',
      startTime: values.startTime,
      durationMinutes: view.tripPlace.estimated_visit_minutes,
      timeLocked: values.timeLocked,
      notes: view.tripPlace.notes ?? view.place.notes,
    })
  },
}
