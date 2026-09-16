import { db } from '../db'
import type { Trip } from '../types/entities'
import { softDeleteRecord } from '../utils/record'

export const tripRepository = {
  async listActive(): Promise<Trip[]> {
    const trips = await db.trips.toArray()
    return trips.filter((trip) => trip.deleted_at === null)
  },

  async countActive(): Promise<number> {
    const trips = await db.trips.toArray()
    return trips.filter((trip) => trip.deleted_at === null).length
  },

  async getById(id: string): Promise<Trip | undefined> {
    const trip = await db.trips.get(id)
    return trip?.deleted_at === null ? trip : undefined
  },

  async put(trip: Trip): Promise<string> {
    return db.trips.put(trip)
  },

  async softDelete(id: string): Promise<void> {
    const trip = await db.trips.get(id)
    if (!trip || trip.deleted_at !== null) return
    await db.trips.put(softDeleteRecord(trip))
  },
}
