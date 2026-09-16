import type { BaseRecord, CurrencyCode } from './common'

export type TripStatus = 'idea' | 'planning' | 'ready' | 'traveling' | 'completed' | 'archived'
export type TripPace = 'relaxed' | 'balanced' | 'packed'
export type TravelerType = 'self' | 'partner_friend' | 'group' | 'family'
export type PlaceCategory =
  | 'attraction'
  | 'food'
  | 'cafe'
  | 'nightlife'
  | 'shopping'
  | 'nature'
  | 'accommodation'
  | 'transport'
  | 'event'
  | 'activity'
  | 'custom'
export type Priority = 'must_do' | 'preferred' | 'optional'
export type ActivityType = 'place' | 'custom' | 'free_time' | 'meal' | 'transportation' | 'booking'
export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'skipped' | 'cancelled'
export type BookingRequirement = 'none' | 'recommended' | 'required'
export type BookingType = 'flight' | 'hotel' | 'attraction' | 'restaurant' | 'event' | 'transport' | 'other'
export type BookingStatus = 'to_book' | 'booked' | 'cancelled'
export type TransportMode = 'walk' | 'bike' | 'car' | 'taxi' | 'bus' | 'train' | 'metro' | 'ferry' | 'flight' | 'other'
export type TripInfoValueType = 'text' | 'url' | 'phone' | 'address' | 'date' | 'time' | 'number' | 'note'

export interface TravelProfile extends BaseRecord {
  name: string
  pace: TripPace
  interests: string[]
  preferred_day_start: string | null
  major_activities_per_day: number | null
  walking_tolerance: 'low' | 'medium' | 'high' | null
  food_restrictions: string[]
  notes: string | null
}

export interface Trip extends BaseRecord {
  title: string
  status: TripStatus
  start_date: string | null
  end_date: string | null
  traveler_type: TravelerType
  base_currency: CurrencyCode | null
  notes: string | null
}

export interface TripPreferences extends BaseRecord {
  trip_id: string
  pace: TripPace
  interests: string[]
  preferred_day_start: string | null
  major_activities_per_day: number | null
  walking_tolerance: 'low' | 'medium' | 'high' | null
  food_restrictions: string[]
  must_do: string[]
  would_like: string[]
  special_requirements: string[]
  notes: string | null
}

export interface Traveler extends BaseRecord {
  trip_id: string
  name: string | null
  is_primary: boolean
}

export interface TripDestination extends BaseRecord {
  trip_id: string
  city: string
  region: string | null
  country: string
  timezone: string
  arrival_at: string | null
  departure_at: string | null
  sequence: number
  notes: string | null
}

export interface TripDay extends BaseRecord {
  trip_id: string
  destination_id: string | null
  date: string | null
  day_number: number
  title: string | null
  position: number
  notes: string | null
}

export interface Place extends BaseRecord {
  name: string
  category: PlaceCategory
  city: string | null
  area: string | null
  address: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
}

export interface TripPlace extends BaseRecord {
  trip_id: string
  place_id: string
  priority: Priority
  estimated_visit_minutes: number | null
  notes: string | null
}

export interface Activity extends BaseRecord {
  trip_id: string
  trip_day_id: string
  trip_place_id: string | null
  title: string
  type: ActivityType
  priority: Priority
  booking_requirement: BookingRequirement
  status: ActivityStatus
  start_time: string | null
  duration_minutes: number | null
  time_locked: boolean
  position: number
  notes: string | null
}

export interface TransportSegment extends BaseRecord {
  trip_id: string
  trip_day_id: string
  from_activity_id: string | null
  to_activity_id: string | null
  from_place_id: string | null
  to_place_id: string | null
  mode: TransportMode
  departure_time: string | null
  duration_minutes: number | null
  cost: number | null
  currency: CurrencyCode | null
  route_notes: string | null
  position: number
}

export interface TravelLeg extends BaseRecord {
  trip_id: string
  from_destination_id: string | null
  to_destination_id: string | null
  mode: TransportMode
  operator: string | null
  service_number: string | null
  origin: string
  destination: string
  departure_at: string | null
  arrival_at: string | null
  booking_id: string | null
  notes: string | null
}

export interface Stay extends BaseRecord {
  trip_id: string
  destination_id: string | null
  place_id: string | null
  check_in_at: string | null
  check_out_at: string | null
  booking_id: string | null
  notes: string | null
}

export interface Booking extends BaseRecord {
  trip_id: string
  type: BookingType
  status: BookingStatus
  provider: string | null
  confirmation_number: string | null
  date_time: string | null
  cost: number | null
  currency: CurrencyCode | null
  booking_opens_at: string | null
  cancellation_deadline: string | null
  url: string | null
  activity_id: string | null
  stay_id: string | null
  travel_leg_id: string | null
  notes: string | null
}

export interface PackingList extends BaseRecord {
  trip_id: string
  title: string
}

export interface PackingCategory extends BaseRecord {
  packing_list_id: string
  name: string
  position: number
}

export interface PackingItem extends BaseRecord {
  packing_list_id: string
  category_id: string
  name: string
  quantity: number
  packed_quantity: number
  required: boolean
  position: number
  notes: string | null
}

export interface TripInfoSection extends BaseRecord {
  trip_id: string
  title: string
  position: number
}

export interface TripInfoItem extends BaseRecord {
  section_id: string
  label: string
  value: string
  type: TripInfoValueType
  position: number
}
