import { db } from '../db'
import type { TravelProfile, Trip, TripDestination } from '../types/entities'
import { createRecordMetadata } from '../utils/record'

const TEST_TRIP_TITLE = 'Milestone 2 · Lisbon persistence test'
const TEST_PROFILE_NAME = 'Milestone 2 Test Profile'

export interface DatabaseDiagnostics {
  databaseName: string
  schemaVersion: number
  tableCount: number
  totalRecords: number
  tripRecords: number
  profileRecords: number
}

export type PersistenceSupport = 'granted' | 'not-granted' | 'unsupported'

export async function initializeDatabase() {
  await db.open()
  await clearMilestone2TestData()
  await requestPersistentStorage()
}

export async function requestPersistentStorage(): Promise<PersistenceSupport> {
  if (!navigator.storage?.persist) return 'unsupported'

  try {
    const granted = await navigator.storage.persist()
    localStorage.setItem('storagePersistence', granted ? 'granted' : 'not-granted')
    return granted ? 'granted' : 'not-granted'
  } catch {
    localStorage.setItem('storagePersistence', 'unsupported')
    return 'unsupported'
  }
}

export async function readPersistenceStatus(): Promise<PersistenceSupport> {
  if (!navigator.storage?.persisted) {
    return (localStorage.getItem('storagePersistence') as PersistenceSupport | null) ?? 'unsupported'
  }

  try {
    const persisted = await navigator.storage.persisted()
    return persisted ? 'granted' : 'not-granted'
  } catch {
    return 'unsupported'
  }
}

export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const counts = await Promise.all(db.tables.map((table) => table.count()))
  const tripRecords = await db.trips.count()
  const profileRecords = await db.travelProfiles.count()

  return {
    databaseName: db.name,
    schemaVersion: db.verno,
    tableCount: db.tables.length,
    totalRecords: counts.reduce((sum, value) => sum + value, 0),
    tripRecords,
    profileRecords,
  }
}

export async function seedMilestone2TestData(): Promise<void> {
  const existing = await db.trips.where('title').equals(TEST_TRIP_TITLE).first()
  if (existing) return

  const profile: TravelProfile = {
    ...createRecordMetadata(),
    name: TEST_PROFILE_NAME,
    pace: 'balanced',
    interests: ['architecture', 'food', 'walking'],
    preferred_day_start: '09:00',
    major_activities_per_day: 3,
    walking_tolerance: 'medium',
    food_restrictions: [],
    notes: 'Safe sample data created only to verify IndexedDB persistence.',
  }

  const trip: Trip = {
    ...createRecordMetadata(),
    title: TEST_TRIP_TITLE,
    status: 'idea',
    start_date: null,
    end_date: null,
    traveler_type: 'self',
    base_currency: 'EUR',
    notes: 'Delete this test data after verifying that it survives an app restart.',
  }

  const destination: TripDestination = {
    ...createRecordMetadata(),
    trip_id: trip.id,
    city: 'Lisbon',
    region: null,
    country: 'Portugal',
    timezone: 'Europe/Lisbon',
    arrival_at: null,
    departure_at: null,
    sequence: 100,
    notes: null,
  }

  await db.transaction('rw', db.travelProfiles, db.trips, db.tripDestinations, async () => {
    await db.travelProfiles.add(profile)
    await db.trips.add(trip)
    await db.tripDestinations.add(destination)
  })
}

export async function clearMilestone2TestData(): Promise<void> {
  const trips = await db.trips.where('title').equals(TEST_TRIP_TITLE).toArray()
  const tripIds = trips.map((trip) => trip.id)
  const profiles = await db.travelProfiles.where('name').equals(TEST_PROFILE_NAME).toArray()

  await db.transaction('rw', db.travelProfiles, db.trips, db.tripDestinations, async () => {
    if (tripIds.length > 0) {
      await db.tripDestinations.where('trip_id').anyOf(tripIds).delete()
      await db.trips.bulkDelete(tripIds)
    }
    if (profiles.length > 0) {
      await db.travelProfiles.bulkDelete(profiles.map((profile) => profile.id))
    }
  })
}

export async function resetDevelopmentDatabase(): Promise<void> {
  db.close()
  await DexieDeleteDatabase()
  await db.open()
}

async function DexieDeleteDatabase() {
  await db.delete()
}
