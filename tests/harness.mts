import 'fake-indexeddb/auto'
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) }
// Service tests run against an in-memory IndexedDB (fake-indexeddb), so nothing touches a real browser.
export const SRC = new URL('../src/data', import.meta.url).href
export const { db } = await import(`${SRC}/db.ts`)
export const { tripService } = await import(`${SRC}/services/tripService.ts`)
export const { itineraryService } = await import(`${SRC}/services/itineraryService.ts`)
export const { readinessService } = await import(`${SRC}/services/readinessService.ts`)
export const { backupService } = await import(`${SRC}/services/backupService.ts`)
export const { travelLegService } = await import(`${SRC}/services/travelLegService.ts`)
export const { bookingService } = await import(`${SRC}/services/bookingService.ts`)
export const utils = await import(`${SRC}/utils/activityTime.ts`)
export const totals = { pass: 0, fail: 0 }
export const check = (name: string, ok: boolean, detail: unknown = '') => { ok ? totals.pass++ : totals.fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? `  [${typeof detail === 'string' ? detail : JSON.stringify(detail)}]` : ''}`) }
export const done = () => {}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const baseInput = (over: Record<string, unknown> = {}) => ({
  title: 'France', startDate: '2026-10-16', endDate: '2026-11-02',
  destinations: [{ city: 'Lyon', region: '', country: 'France', timezone: 'Europe/Berlin' }, { city: 'Paris', region: '', country: 'France', timezone: '' }],
  travelerType: 'self' as const, travelerCount: 1, travelerNames: [],
  style: { pace: 'balanced' as const, interests: [], preferredDayStart: null, majorActivitiesPerDay: 3, walkingTolerance: null },
  requirements: { mustDo: [], wouldLike: [], foodRestrictions: [], specialRequirements: [], notes: null },
  saveAsProfile: false, ...over,
})
export const draft = (tripDayId: string, title: string, extra: Record<string, unknown> = {}) => ({
  tripDayId, tripPlaceId: null, title, type: 'custom' as const, priority: 'preferred' as const, bookingRequirement: 'none' as const,
  status: 'planned' as const, startTime: null, durationMinutes: null, timeLocked: false, notes: null, ...extra,
})
export const days = async (tripId: string) => (await db.tripDays.where('trip_id').equals(tripId).toArray()).filter((d: any) => !d.deleted_at).sort((a: any, b: any) => a.position - b.position)
export const dayOf = async (tripId: string, date: string) => (await days(tripId)).find((d: any) => d.date === date)
export const where = async (activityId: string) => { const a = await db.activities.get(activityId); const d = await db.tripDays.get(a.trip_day_id); return { date: d.date, dayDeleted: !!d.deleted_at, position: a.position } }
