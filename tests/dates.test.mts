import { tripService, itineraryService, db, check, done, baseInput, draft, days, dayOf, where } from './harness.mts'

// A: start moves one day earlier, plans keep their dates
let trip = await tripService.createTrip(baseInput())
let d18 = await dayOf(trip, '2026-10-18'), d01 = await dayOf(trip, '2026-11-01')
const lud = (await db.tripDestinations.where('trip_id').equals(trip).toArray()).find((x: any) => x.city === 'Lyon')
await itineraryService.assignDestinationRanges(trip, [{ destinationId: lud.id, from: '2026-10-16', to: '2026-10-30' }])
const palace = await itineraryService.createActivity(trip, draft(d18.id, 'Palace', { startTime: '10:00' }))
const fly = await itineraryService.createActivity(trip, draft(d01.id, 'Fly home'))
let p = await tripService.previewDateChange(trip, '2026-10-15', '2026-11-02', 'keep')
check('A1 preview: start earlier adds one day, moves nothing', p.addedDays === 1 && p.removedDays === 0 && p.movedActivities.length === 0, p)
await tripService.updateTripBasics(trip, { title: 'France', status: 'planning', startDate: '2026-10-15', endDate: '2026-11-02', notes: null, dateMode: 'keep' })
check('A2 plans stay on their dates', (await where(palace)).date === '2026-10-18' && (await where(fly)).date === '2026-11-01', [await where(palace), await where(fly)])
const ds = await days(trip)
check('A3 19 days, numbered in date order; new Oct 15 takes Lyon', ds.length === 19 && ds[0].date === '2026-10-15' && ds[0].day_number === 1 && ds[3].date === '2026-10-18' && ds[3].day_number === 4 && ds[0].destination_id === lud.id, ds.slice(0, 2).map((d: any) => [d.date, d.day_number]))

// B: whole trip moves a week later: plans move with it
p = await tripService.previewDateChange(trip, '2026-10-22', '2026-11-09', 'shift')
check('B1 preview: shift +7, nothing removed', p.shiftDays === 7 && p.removedDays === 0 && p.addedDays === 0 && p.movedActivities.length === 0, p)
await tripService.updateTripBasics(trip, { title: 'France', status: 'planning', startDate: '2026-10-22', endDate: '2026-11-09', notes: null, dateMode: 'shift' })
check('B2 plans moved 7 days with their days', (await where(palace)).date === '2026-10-25' && (await where(fly)).date === '2026-11-08')
const d25 = await dayOf(trip, '2026-10-25')
check('B3 the day keeps its city', d25.destination_id === lud.id)
await tripService.updateTripBasics(trip, { title: 'France', status: 'planning', startDate: '2026-10-15', endDate: '2026-11-02', notes: null, dateMode: 'shift' })

// C: shortening moves plans from removed days to the last day, nothing hidden
await itineraryService.createActivity(trip, draft((await dayOf(trip, '2026-11-01')).id, 'Breakfast', { startTime: '08:00' }))
const lastBefore = await itineraryService.createActivity(trip, draft((await dayOf(trip, '2026-10-30')).id, 'Pack up', { startTime: '20:00' }))
p = await tripService.previewDateChange(trip, '2026-10-15', '2026-10-30', 'keep')
check('C1 preview lists the moved activities with dates', p.removedDays === 3 && p.movedActivities.length === 2 && p.movedActivities.every((m: any) => m.to === '2026-10-30'), p.movedActivities)
await tripService.updateTripBasics(trip, { title: 'France', status: 'planning', startDate: '2026-10-15', endDate: '2026-10-30', notes: null, dateMode: 'keep' })
const ov = await itineraryService.getOverview(trip)
const last = ov.days.at(-1)
check('C2 moved to Oct 30 in clock order (08:00, Fly home untimed stays after timed? order)', last.day.date === '2026-10-30' && last.activities.map((a: any) => a.title).join(',') === 'Breakfast,Pack up,Fly home', last.activities.map((a: any) => `${a.title}@${a.start_time}`))
check('C3 nothing unplaced; counts match', ov.unplaced.length === 0 && ov.counts.activities === 4, [ov.unplaced.length, ov.counts.activities])
check('C4 positions are 100,200,300', last.activities.map((a: any) => a.position).join() === '100,200,300')

// D: clearing dates with plans is blocked; without plans it works
p = await tripService.previewDateChange(trip, null, null, 'keep')
check('D1 clearing dates is blocked while plans exist', Boolean(p.blockedReason), p.blockedReason)
let threw = ''
try { await tripService.updateTripBasics(trip, { title: 'France', status: 'idea', startDate: null, endDate: null, notes: null }) } catch (e: any) { threw = e.message }
check('D2 save refuses too', threw.includes('before clearing the dates') && (await days(trip)).length === 16, threw)
const t2 = await tripService.createTrip(baseInput({ title: 'Empty' }))
await tripService.updateTripBasics(t2, { title: 'Empty', status: 'idea', startDate: null, endDate: null, notes: null })
check('D3 an empty trip can clear its dates', (await days(t2)).length === 0)
await tripService.updateTripBasics(t2, { title: 'Empty', status: 'planning', startDate: '2026-12-01', endDate: '2026-12-03', notes: null })
check('D4 setting dates again creates days', (await days(t2)).length === 3)

// E: transport on removed days is removed; transport elsewhere kept
const t3 = await tripService.createTrip(baseInput({ title: 'T3', startDate: '2026-10-01', endDate: '2026-10-03', destinations: [{ city: 'A', region: '', country: 'X', timezone: '' }] }))
const e3 = await dayOf(t3, '2026-10-03')
const a1 = await itineraryService.createActivity(t3, draft(e3.id, 'One', { startTime: '09:00' }))
const a2 = await itineraryService.createActivity(t3, draft(e3.id, 'Two', { startTime: '11:00' }))
const { transportService } = await import(new URL('../src/data/services/transportService.ts', import.meta.url).href)
await transportService.createSegment(t3, { tripDayId: e3.id, fromActivityId: a1, toActivityId: a2, mode: 'walk', departureTime: null, durationMinutes: 10, cost: null, currency: null, routeNotes: null }).catch((e: any) => console.log('segment create', e.message))
p = await tripService.previewDateChange(t3, '2026-10-01', '2026-10-02', 'keep')
check('E1 preview counts the transport that goes', p.removedTransport === 1, p)
await tripService.updateTripBasics(t3, { title: 'T3', status: 'planning', startDate: '2026-10-01', endDate: '2026-10-02', notes: null })
const segs = (await db.transportSegments.where('trip_id').equals(t3).toArray()).filter((s: any) => !s.deleted_at)
check('E2 transport removed, activities on Oct 2', segs.length === 0 && (await where(a1)).date === '2026-10-02' && (await where(a2)).date === '2026-10-02')

// F: legacy orphans (from the old version) show up as unplaced and can be moved back
const t4 = await tripService.createTrip(baseInput({ title: 'T4', startDate: '2026-10-01', endDate: '2026-10-03' }))
const f3 = await dayOf(t4, '2026-10-03')
const orphan = await itineraryService.createActivity(t4, draft(f3.id, 'Lost dinner', { startTime: '19:00' }))
const raw = await db.tripDays.get(f3.id); await db.tripDays.put({ ...raw, deleted_at: new Date().toISOString() })
let ov4 = await itineraryService.getOverview(t4)
check('F1 orphaned activity listed as unplaced with its former date, not counted', ov4.unplaced.length === 1 && ov4.unplaced[0].formerDate === '2026-10-03' && ov4.counts.activities === 0)
const dash = await tripService.getDashboard(t4)
check('F2 dashboard count excludes it', dash.counts.activities === 0)
await itineraryService.moveActivityToDay(orphan, (await dayOf(t4, '2026-10-02')).id)
ov4 = await itineraryService.getOverview(t4)
check('F3 moving it to a day brings it back', ov4.unplaced.length === 0 && ov4.counts.activities === 1)
done()
