import Dexie, { type Table } from 'dexie'
import type {
  Activity,
  Booking,
  PackingCategory,
  PackingItem,
  PackingList,
  Place,
  Stay,
  TransportSegment,
  TravelLeg,
  TravelProfile,
  Traveler,
  Trip,
  TripDay,
  TripDestination,
  TripInfoItem,
  TripInfoSection,
  TripPlace,
  TripPreferences,
} from './types/entities'

export class TravelPlannerDB extends Dexie {
  travelProfiles!: Table<TravelProfile, string>
  trips!: Table<Trip, string>
  tripPreferences!: Table<TripPreferences, string>
  travelers!: Table<Traveler, string>
  tripDestinations!: Table<TripDestination, string>
  tripDays!: Table<TripDay, string>
  places!: Table<Place, string>
  tripPlaces!: Table<TripPlace, string>
  activities!: Table<Activity, string>
  transportSegments!: Table<TransportSegment, string>
  travelLegs!: Table<TravelLeg, string>
  stays!: Table<Stay, string>
  bookings!: Table<Booking, string>
  packingLists!: Table<PackingList, string>
  packingCategories!: Table<PackingCategory, string>
  packingItems!: Table<PackingItem, string>
  tripInfoSections!: Table<TripInfoSection, string>
  tripInfoItems!: Table<TripInfoItem, string>

  constructor() {
    super('TravelPlannerDB')

    this.version(1).stores({
      travelProfiles: 'id, name, updated_at, deleted_at',
      trips: 'id, title, status, start_date, end_date, updated_at, deleted_at',
      tripPreferences: 'id, trip_id, updated_at, deleted_at',
      travelers: 'id, trip_id, is_primary, updated_at, deleted_at',
      tripDestinations: 'id, trip_id, sequence, country, city, updated_at, deleted_at',
      tripDays: 'id, trip_id, destination_id, date, day_number, position, [trip_id+date], updated_at, deleted_at',
      places: 'id, category, city, name, updated_at, deleted_at',
      tripPlaces: 'id, trip_id, place_id, priority, [trip_id+place_id], updated_at, deleted_at',
      activities: 'id, trip_id, trip_day_id, trip_place_id, type, status, start_time, position, [trip_day_id+position], updated_at, deleted_at',
      transportSegments: 'id, trip_id, trip_day_id, from_activity_id, to_activity_id, position, updated_at, deleted_at',
      travelLegs: 'id, trip_id, from_destination_id, to_destination_id, departure_at, updated_at, deleted_at',
      stays: 'id, trip_id, destination_id, place_id, check_in_at, check_out_at, updated_at, deleted_at',
      bookings: 'id, trip_id, type, status, activity_id, stay_id, travel_leg_id, date_time, updated_at, deleted_at',
      packingLists: 'id, trip_id, updated_at, deleted_at',
      packingCategories: 'id, packing_list_id, position, updated_at, deleted_at',
      packingItems: 'id, packing_list_id, category_id, packed_quantity, position, updated_at, deleted_at',
      tripInfoSections: 'id, trip_id, position, updated_at, deleted_at',
      tripInfoItems: 'id, section_id, position, updated_at, deleted_at',
    })
  }
}

export const db = new TravelPlannerDB()
