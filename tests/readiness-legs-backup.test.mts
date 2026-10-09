import { tripService, itineraryService, readinessService, backupService, travelLegService, bookingService, db, check, done, baseInput, draft, dayOf, sleep } from './harness.mts'
const trip = await tripService.createTrip(baseInput())
const dests = (await db.tripDestinations.where('trip_id').equals(trip).toArray()).sort((a: any, b: any) => a.sequence - b.sequence)
const [lud, fra] = dests
const leg = (o: string, d: string, extra: Record<string, unknown> = {}) => ({ fromDestinationId: null, toDestinationId: null, mode: 'flight', operator: null, serviceNumber: null, origin: o, destination: d, departureAt: null, arrivalAt: null, notes: null, ...extra })
const err = async (fn: () => Promise<unknown>) => { try { await fn(); return '' } catch (e: any) { return e.message } }
const travel = async () => (await readinessService.getReadiness(trip)).checks.find((c: any) => c.id === 'travel-legs')

let r = await travel()
check('R1 no legs: getting there, the move and getting home are flagged', r.status === 'action' && r.detail === 'Missing: getting there, Lyon → Paris, getting home.', r.detail)
const flight = await travelLegService.createTravelLeg(trip, leg('TPE Airport', 'FRA Airport', { departureAt: '2026-10-15T23:30', arrivalAt: '2026-10-16T06:30' }))
r = await travel()
check('R2 an unlinked flight does not count, and the check says to link it', r.status === 'action' && r.detail.includes("1 leg isn't linked to a trip city"), r.detail)
const l1 = await db.travelLegs.get(flight); await travelLegService.updateTravelLeg(trip, flight, { ...leg(l1.origin, l1.destination, { departureAt: l1.departure_at, arrivalAt: l1.arrival_at }), toDestinationId: lud.id })
const train = await travelLegService.createTravelLeg(trip, leg('Lyon', 'Paris Gare du Nord', { mode: 'train', departureAt: '2026-10-30T17:00', arrivalAt: '2026-10-30T19:00' }))
const tl = await db.travelLegs.get(train)
check('R3 a new leg naming trip cities is linked automatically ("Paris Gare du Nord")', tl.from_destination_id === lud.id && tl.to_destination_id === fra.id, [tl.from_destination_id === lud.id, tl.to_destination_id === fra.id])
r = await travel()
check('R4 getting home still missing is a review, not a false clear', r.status === 'review' && r.detail === 'Not recorded yet: getting home.', r.detail)
await travelLegService.createTravelLeg(trip, leg('Paris', 'TPE Airport', { departureAt: '2026-11-02T12:00', arrivalAt: '2026-11-03T07:00' }))
r = await travel()
check('R5 full route is clear', r.status === 'ready' && r.detail === 'Route covered: getting there, Lyon → Paris, getting home.', r.detail)
const solo = await tripService.createTrip(baseInput({ title: 'Solo', destinations: [{ city: 'Kyoto', region: '', country: 'Japan', timezone: '' }] }))
const rs = (await readinessService.getReadiness(solo)).checks.find((c: any) => c.id === 'travel-legs')
check('R6 single city: getting there and home are a review', rs.status === 'review' && rs.detail === 'Not recorded yet: getting there and getting home.', rs.detail)

// leg times
check('V1 arrival earlier in local time is allowed (flying east over the date line)', await err(() => travelLegService.createTravelLeg(trip, leg('TPE', 'SFO', { departureAt: '2026-10-16T23:00', arrivalAt: '2026-10-16T19:00' }))) === '')
check('V2 arrival days before departure is refused', (await err(() => travelLegService.createTravelLeg(trip, leg('TPE', 'FRA', { departureAt: '2026-10-16T08:00', arrivalAt: '2026-10-13T15:00' })))).includes('more than a day before'))
check('V3 junk after the time is refused', (await err(() => travelLegService.createTravelLeg(trip, leg('A', 'B', { departureAt: '2026-10-16T08:00abc' })))).includes('valid date and time'))
const bookingErr = await err(() => bookingService.createBooking(trip, { type: 'hotel', status: 'booked', provider: 'Hotel', confirmationNumber: null, dateTime: '2026-10-16T15:00 tomorrow', cost: null, currency: null, bookingOpensAt: null, cancellationDeadline: null, url: null, linkType: 'none', linkId: null, notes: null }))
check('V4 bookings use the same strict check', bookingErr.includes('valid date and time'), bookingErr)

// unplaced activities in readiness
const d3 = await dayOf(trip, '2026-10-18')
const lost = await itineraryService.createActivity(trip, draft(d3.id, 'Lost'))
const raw = await db.tripDays.get(d3.id); await db.tripDays.put({ ...raw, deleted_at: new Date().toISOString() })
const it = (await readinessService.getReadiness(trip)).checks.find((c: any) => c.id === 'itinerary')
check('U1 readiness asks to give unplaced activities a day', it.status === 'action' && it.detail.includes('1 activity needs a day again'), it.detail)
await db.tripDays.put(raw)

// merge restore: newer local copies win
const keep = await itineraryService.createActivity(trip, draft(d3.id, 'Original title'))
const gone = await itineraryService.createActivity(trip, draft(d3.id, 'Will be deleted'))
const backup = await backupService.createBackup()
await sleep(5)
await itineraryService.updateActivity(trip, keep, draft(d3.id, 'Edited after backup'))
await itineraryService.softDeleteActivity(gone)
const res = await backupService.restoreBackup(backup, 'merge')
const k = await db.activities.get(keep), g = await db.activities.get(gone)
check('M1 merge keeps the newer local edit', k.title === 'Edited after backup', k.title)
check('M2 merge does not bring back something deleted after the backup', g.deleted_at !== null)
check('M3 the result reports what was kept', res.keptNewer >= 2 && res.updated === 0, { keptNewer: res.keptNewer, updated: res.updated, created: res.created })
// an older local copy is updated from a newer backup
const other = await tripService.createTrip(baseInput({ title: 'Other' }))
const b2 = await backupService.createBackup()
const t = b2.tables.trips.find((x: any) => x.id === other)
t.title = 'Renamed in backup'; t.updated_at = new Date(Date.now() + 60000).toISOString()
await backupService.restoreBackup(b2, 'merge')
check('M4 a newer backup copy does update', (await db.trips.get(other)).title === 'Renamed in backup')
const bad = await backupService.createBackup(); delete (bad.tables.trips[0] as any).updated_at
const badErr = await err(() => backupService.restoreBackup(bad, 'replace'))
check('M5 a record without bookkeeping fields is refused before anything is replaced', badErr.includes('updated_at') && (await db.trips.count()) >= 3, badErr)
done()
