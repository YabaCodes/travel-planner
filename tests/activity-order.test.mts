import { tripService, itineraryService, db, check, done, baseInput, draft, dayOf, utils } from './harness.mts'
const trip = await tripService.createTrip(baseInput({ startDate: '2026-10-16', endDate: '2026-10-18' }))
const d = await dayOf(trip, '2026-10-18'), d2 = await dayOf(trip, '2026-10-17')
const titles = async (dayId: string) => (await itineraryService.getDay(trip, dayId)).activities.map((a: any) => a.title).join(',')
const dinner = await itineraryService.createActivity(trip, draft(d.id, 'Dinner', { startTime: '18:00', durationMinutes: 90 }))
const museum = await itineraryService.createActivity(trip, draft(d.id, 'Museum', { startTime: '09:00', durationMinutes: 120 }))
await itineraryService.createActivity(trip, draft(d.id, 'Shopping'))
const lunch = await itineraryService.createActivity(trip, draft(d.id, 'Lunch', { startTime: '12:30', durationMinutes: 60 }))
check('O1 activities added out of order land in clock order', await titles(d.id) === 'Museum,Lunch,Dinner,Shopping', await titles(d.id))
const acts = (await itineraryService.getDay(trip, d.id)).activities
const pick = (h: number, m = 0) => utils.pickNextActivity(acts, h * 60 + m)?.title
check('O2 up next follows the clock', pick(8) === 'Museum' && pick(10) === 'Museum' && pick(11, 45) === 'Lunch' && pick(14) === 'Dinner' && pick(20) === 'Shopping', [pick(8), pick(10), pick(11, 45), pick(14), pick(20)])
check('O3 on a preview day the first planned in order', utils.pickNextActivity(acts, null)?.title === 'Museum')
const withProgress = acts.map((a: any) => a.title === 'Dinner' ? { ...a, status: 'in_progress' } : a)
check('O4 in progress wins', utils.pickNextActivity(withProgress, 8 * 60)?.title === 'Dinner')
const cur = await db.activities.get(lunch)
await itineraryService.updateActivity(trip, lunch, draft(d.id, 'Lunch', { startTime: '07:30', durationMinutes: 60 }))
check('O5 editing a time re-places it', await titles(d.id) === 'Lunch,Museum,Dinner,Shopping', await titles(d.id))
await itineraryService.updateActivity(trip, lunch, draft(d.id, 'Lunch late', { startTime: '07:30', durationMinutes: 60, notes: 'x' }))
check('O6 editing without a time change keeps the order', await titles(d.id) === 'Lunch late,Museum,Dinner,Shopping', await titles(d.id))
await itineraryService.createActivity(trip, draft(d2.id, 'Coffee', { startTime: '08:00' }))
await itineraryService.createActivity(trip, draft(d2.id, 'Show', { startTime: '21:00' }))
await itineraryService.moveActivityToDay(dinner, d2.id)
check('O7 moving to another day places it by time', await titles(d2.id) === 'Coffee,Dinner,Show', await titles(d2.id))
const copy = await itineraryService.duplicateActivity(museum)
check('O8 a duplicate sits right after the original', await titles(d.id) === 'Lunch late,Museum,Museum copy,Shopping', await titles(d.id))
// legacy day: out of order positions
const d3 = await dayOf(trip, '2026-10-16')
const x = await itineraryService.createActivity(trip, draft(d3.id, 'Evening', { startTime: '19:00' }))
const y = await itineraryService.createActivity(trip, draft(d3.id, 'Free'))
const z = await itineraryService.createActivity(trip, draft(d3.id, 'Morning', { startTime: '08:00' }))
// simulate an old app: put Evening first, Free, Morning last
for (const [id, pos] of [[x, 100], [y, 200], [z, 300]] as const) { const a = await db.activities.get(id); await db.activities.put({ ...a, position: pos }) }
const legacy = (await itineraryService.getDay(trip, d3.id)).activities
check('O9 old day detected as out of order', !utils.isTimeOrdered(legacy) && utils.chronologicalOrder(legacy).map((a: any) => a.title).join(',') === 'Morning,Free,Evening')
await itineraryService.sortDayByTime(d3.id)
check('O10 Sort by time fixes it; untimed keeps its place', await titles(d3.id) === 'Morning,Free,Evening', await titles(d3.id))
done()
