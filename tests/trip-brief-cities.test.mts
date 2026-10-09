import { tripService, itineraryService, travelLegService, db, check, done, baseInput, days } from './harness.mts'
const trip = await tripService.createTrip(baseInput())
const dests = async () => (await db.tripDestinations.where('trip_id').equals(trip).toArray()).filter((d: any) => !d.deleted_at).sort((a: any, b: any) => a.sequence - b.sequence)
let [lud, fra] = await dests()
const err = async (fn: () => Promise<unknown>) => { try { await fn(); return '' } catch (e: any) { return e.message } }
// city ranges
let n = await itineraryService.assignDestinationRanges(trip, [{ destinationId: lud.id, from: '2026-10-16', to: '2026-10-30' }, { destinationId: fra.id, from: '2026-10-31', to: '2026-11-02' }])
let ds = await days(trip)
check('C1 city ranges assign all 18 days in one go', n === 18 && ds.filter((d: any) => d.destination_id === lud.id).length === 15 && ds.filter((d: any) => d.destination_id === fra.id).length === 3)
const ov = await itineraryService.getDestinationRanges(trip)
check('C2 current ranges read back', ov.find((r: any) => r.destinationId === lud.id)?.to === '2026-10-30' && ov.find((r: any) => r.destinationId === fra.id)?.from === '2026-10-31')
let e = await err(() => itineraryService.assignDestinationRanges(trip, [{ destinationId: lud.id, from: '2026-10-16', to: '2026-10-31' }, { destinationId: fra.id, from: '2026-10-31', to: '2026-11-02' }]))
check('C3 overlapping ranges are refused with the day named', e.includes('Oct 31') && e.includes('Lyon and Paris'), e)
e = await err(() => itineraryService.assignDestinationRanges(trip, [{ destinationId: lud.id, from: '2026-10-16', to: '' }]))
check('C4 half a range is refused', e.includes('both dates'), e)
check('C5 nothing changed after a refused save', (await days(trip)).filter((d: any) => d.destination_id === fra.id).length === 3)

// trip brief: rename, add, reorder
const leg = await travelLegService.createTravelLeg(trip, { fromDestinationId: lud.id, toDestinationId: fra.id, mode: 'train', operator: null, serviceNumber: null, origin: 'Lyon', destination: 'Paris', departureAt: null, arrivalAt: null, notes: null })
const style = { pace: 'relaxed' as const, interests: ['castles'], preferredDayStart: '08:00', majorActivitiesPerDay: 2, walkingTolerance: 'high' as const }
const req = { mustDo: ['Palace'], wouldLike: [], foodRestrictions: ['no pork'], specialRequirements: ['work calls'] }
await tripService.updateTripBrief(trip, { destinations: [{ id: lud.id, city: 'Lyon', country: 'France', region: 'Auvergne-Rhône-Alpes', timezone: 'Europe/Berlin' }, { city: 'Dijon', country: 'France', region: '', timezone: '' }, { id: fra.id, city: 'Paris Centre', country: 'France', region: '', timezone: 'Europe/Berlin' }], travelerType: 'partner_friend', travelerCount: 2, travelerNames: ['Alex', 'Sam'], style, requirements: req })
let list = await dests()
check('B1 renamed, added in the middle, order kept', list.map((d: any) => d.city).join(',') === 'Lyon,Dijon,Paris Centre' && list[0].region === 'Auvergne-Rhône-Alpes' && list[1].timezone === 'UTC')
const travelers = (await db.travelers.where('trip_id').equals(trip).toArray()).filter((t: any) => !t.deleted_at)
check('B2 travelers updated', travelers.length === 2 && travelers.some((t: any) => t.name === 'Sam') && (await db.trips.get(trip)).traveler_type === 'partner_friend')
const prefs = await db.tripPreferences.where('trip_id').equals(trip).first()
check('B3 travel style and requirements saved', prefs.pace === 'relaxed' && prefs.interests[0] === 'castles' && prefs.must_do[0] === 'Palace' && prefs.special_requirements[0] === 'work calls' && prefs.major_activities_per_day === 2)
// remove Paris: its days lose their city, the leg is unlinked (kept)
;[lud] = await dests()
const stuttgart = list[1]
await tripService.updateTripBrief(trip, { destinations: [{ id: lud.id, city: 'Lyon', country: 'France', region: '', timezone: 'Europe/Berlin' }, { id: stuttgart.id, city: 'Dijon', country: 'France', region: '', timezone: '' }], travelerType: 'self', travelerCount: 1, travelerNames: ['Alex'], style, requirements: req })
ds = await days(trip)
const l = await db.travelLegs.get(leg)
check('B4 removing a city unassigns its days and unlinks its legs', ds.filter((d: any) => d.destination_id === null).length === 3 && l.deleted_at === null && l.to_destination_id === null && l.from_destination_id === lud.id)
check('B5 travelers trimmed to one', (await db.travelers.where('trip_id').equals(trip).toArray()).filter((t: any) => !t.deleted_at).length === 1)
// down to one city: every day gets it
await tripService.updateTripBrief(trip, { destinations: [{ id: lud.id, city: 'Lyon', country: 'France', region: '', timezone: 'Europe/Berlin' }], travelerType: 'self', travelerCount: 1, travelerNames: [], style, requirements: req })
ds = await days(trip)
check('B6 a single city covers every day', ds.every((d: any) => d.destination_id === lud.id))
e = await err(() => tripService.updateTripBrief(trip, { destinations: [{ id: lud.id, city: 'Lyon', country: 'France', region: '', timezone: 'Mars/Olympus' }], travelerType: 'self', travelerCount: 1, travelerNames: [], style, requirements: req }))
check('B7 an unknown time zone is refused', e.includes('Mars/Olympus'), e)
e = await err(() => tripService.updateTripBrief(trip, { destinations: [{ city: 'Paris', country: '', region: '', timezone: '' }], travelerType: 'self', travelerCount: 1, travelerNames: [], style, requirements: req }))
check('B8 a city needs a country', e.includes('country'), e)
e = await err(() => tripService.createTrip(baseInput({ destinations: [{ city: 'X', country: 'Y', region: '', timezone: 'Not/AZone' }] })))
check('B9 the wizard checks time zones too', e.includes('Not/AZone'), e)
done()
