import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripService, type DestinationDraft } from '../../data/services/tripService'
import type { TravelerType, TripPace } from '../../data/types/entities'
import './trip-edit.css'

type CityDraft = DestinationDraft & { id?: string; key: string }

const splitList = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
const joinList = (value: string[]) => value.join(', ')
let keySeed = 0
const newKey = () => `city-${++keySeed}`
const travelerChoices: Array<[TravelerType, string]> = [['self', 'Just me'], ['partner_friend', 'Partner / friend'], ['group', 'Group'], ['family', 'Family']]

// Edits everything the new-trip wizard asked for, except title and dates (those are on Edit trip).
function TripBriefScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const workspace = useLiveQuery(() => tripService.getWorkspace(tripId), [tripId])
  const [initialized, setInitialized] = useState(false)
  const [cities, setCities] = useState<CityDraft[]>([])
  const [travelerType, setTravelerType] = useState<TravelerType>('self')
  const [countText, setCountText] = useState('1')
  const [names, setNames] = useState<string[]>([''])
  const [pace, setPace] = useState<TripPace>('balanced')
  const [interests, setInterests] = useState('')
  const [dayStart, setDayStart] = useState('09:00')
  const [perDay, setPerDay] = useState('3')
  const [walking, setWalking] = useState<'low' | 'medium' | 'high'>('medium')
  const [mustDo, setMustDo] = useState('')
  const [wouldLike, setWouldLike] = useState('')
  const [food, setFood] = useState('')
  const [special, setSpecial] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace || initialized) return
    setInitialized(true)
    setCities(workspace.destinations.map((destination) => ({ id: destination.id, key: destination.id, city: destination.city, country: destination.country, region: destination.region ?? '', timezone: destination.timezone === 'UTC' ? '' : destination.timezone })))
    setTravelerType(workspace.trip.traveler_type)
    const travelers = [...workspace.travelers].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at))
    setCountText(String(Math.max(1, travelers.length)))
    setNames(travelers.length ? travelers.map((traveler) => traveler.name ?? '') : [''])
    const preferences = workspace.preferences
    if (preferences) {
      setPace(preferences.pace)
      setInterests(joinList(preferences.interests))
      setDayStart(preferences.preferred_day_start ?? '')
      setPerDay(preferences.major_activities_per_day ? String(preferences.major_activities_per_day) : '')
      setWalking(preferences.walking_tolerance ?? 'medium')
      setMustDo(preferences.must_do.join('\n'))
      setWouldLike(preferences.would_like.join('\n'))
      setFood(joinList(preferences.food_restrictions))
      setSpecial(preferences.special_requirements.join('\n'))
    }
  }, [workspace, initialized])

  if (workspace === undefined) return <div className="page-stack"><div className="loading-card">Loading trip…</div></div>
  if (workspace === null) return <div className="page-stack"><PageIntro eyebrow="Trip brief" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const count = travelerType === 'self' ? 1 : Math.max(1, Math.min(20, Number.parseInt(countText, 10) || 1))
  const shownNames = Array.from({ length: count }, (_, index) => names[index] ?? '')
  const removed = workspace.destinations.filter((destination) => !cities.some((city) => city.id === destination.id))
  const daysIn = (id: string) => workspace.days.filter((day) => day.destination_id === id).length

  const updateCity = (key: string, field: keyof DestinationDraft, value: string) => setCities((current) => current.map((city) => city.key === key ? { ...city, [field]: value } : city))
  const moveCity = (index: number, offset: -1 | 1) => setCities((current) => {
    const next = [...current]
    const [item] = next.splice(index, 1)
    next.splice(index + offset, 0, item)
    return next
  })
  const chooseTravelerType = (value: TravelerType) => {
    setTravelerType(value)
    if (value === 'self') setCountText('1')
    else if (value === 'partner_friend') setCountText('2')
    else if (count < 3) setCountText('3')
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await tripService.updateTripBrief(tripId, {
        destinations: cities.map(({ id, city, country, region, timezone }) => ({ id, city, country, region, timezone })),
        travelerType,
        travelerCount: count,
        travelerNames: shownNames,
        style: {
          pace,
          interests: splitList(interests),
          preferredDayStart: dayStart || null,
          majorActivitiesPerDay: Number.parseInt(perDay, 10) || null,
          walkingTolerance: walking,
        },
        requirements: { mustDo: splitList(mustDo), wouldLike: splitList(wouldLike), foodRestrictions: splitList(food), specialRequirements: splitList(special) },
      })
      navigate(`/trip/${tripId}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the trip details.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack trip-brief-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}`)}>← {workspace.trip.title}</button></div>
      <PageIntro eyebrow="Trip brief" title="Edit trip details" description="Cities, who's traveling and how you like to travel. The title and dates are on Edit trip." />

      <section className="form-panel form-stack">
        <div className="section-heading"><h2>Cities</h2><p>In travel order. Days and travel legs link to these.</p></div>
        {cities.map((city, index) => (
          <div className="destination-editor" key={city.key}>
            <div className="destination-editor__heading">
              <span>City {index + 1}{city.id && daysIn(city.id) ? <small className="brief-days"> · {daysIn(city.id)} day{daysIn(city.id) === 1 ? '' : 's'}</small> : null}</span>
              <span className="brief-city-actions">
                <button type="button" className="icon-text-button" disabled={index === 0} onClick={() => moveCity(index, -1)} aria-label={`Move ${city.city || 'city'} earlier`}>↑</button>
                <button type="button" className="icon-text-button" disabled={index === cities.length - 1} onClick={() => moveCity(index, 1)} aria-label={`Move ${city.city || 'city'} later`}>↓</button>
                {cities.length > 1 ? <button type="button" className="icon-text-button danger-text" onClick={() => setCities((current) => current.filter((item) => item.key !== city.key))}>Remove</button> : null}
              </span>
            </div>
            <div className="field-grid field-grid--2">
              <label className="field"><span>City</span><input value={city.city} onChange={(event) => updateCity(city.key, 'city', event.target.value)} placeholder="City" /></label>
              <label className="field"><span>Country</span><input value={city.country} onChange={(event) => updateCity(city.key, 'country', event.target.value)} placeholder="Country" /></label>
            </div>
            <div className="field-grid field-grid--2">
              <label className="field"><span>Region <small>optional</small></span><input value={city.region} onChange={(event) => updateCity(city.key, 'region', event.target.value)} placeholder="State / region" /></label>
              <label className="field"><span>Time zone <small>optional</small></span><input value={city.timezone} onChange={(event) => updateCity(city.key, 'timezone', event.target.value)} placeholder="e.g. Europe/Berlin" /></label>
            </div>
          </div>
        ))}
        <button className="button button--secondary brief-add-city" type="button" onClick={() => setCities((current) => [...current, { key: newKey(), city: '', country: current.at(-1)?.country ?? '', region: '', timezone: current.at(-1)?.timezone ?? '' }])}>+ Add city</button>
        {removed.length ? <div className="date-impact" role="status"><strong>When you save</strong><ul>{removed.map((destination) => <li key={destination.id}>{destination.city} is removed{daysIn(destination.id) ? `; its ${daysIn(destination.id)} day${daysIn(destination.id) === 1 ? '' : 's'} will need a city again` : ''}. Travel legs linked to it are unlinked, not deleted.</li>)}</ul></div> : null}
      </section>

      <section className="form-panel form-stack">
        <div className="section-heading"><h2>Who is traveling?</h2></div>
        <div className="choice-grid" role="group" aria-label="Travelers">
          {travelerChoices.map(([value, label]) => <button key={value} type="button" aria-pressed={travelerType === value} className={`choice-card${travelerType === value ? ' is-selected' : ''}`} onClick={() => chooseTravelerType(value)}><strong>{label}</strong></button>)}
        </div>
        {travelerType !== 'self' ? <label className="field"><span>Number of travelers</span><input type="number" inputMode="numeric" min="1" max="20" value={countText} onChange={(event) => setCountText(event.target.value)} /></label> : null}
        <div className="field-grid field-grid--2">
          {shownNames.map((name, index) => <label className="field" key={index}><span>{index === 0 ? 'Primary traveler' : `Traveler ${index + 1}`} <small>optional</small></span><input value={name} onChange={(event) => setNames(() => shownNames.map((item, i) => i === index ? event.target.value : item))} placeholder="Name" /></label>)}
        </div>
      </section>

      <section className="form-panel form-stack">
        <div className="section-heading"><h2>Travel style</h2></div>
        <div className="segmented-control" role="group" aria-label="Trip pace">{(['relaxed', 'balanced', 'packed'] as TripPace[]).map((value) => <button type="button" key={value} aria-pressed={pace === value} className={pace === value ? 'is-selected' : ''} onClick={() => setPace(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        <label className="field"><span>Interests <small>comma-separated</small></span><input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Food, museums, nature…" /></label>
        <div className="field-grid field-grid--2">
          <label className="field"><span>Preferred day start</span><input type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} /></label>
          <label className="field"><span>Major activities a day <small>optional</small></span><input type="number" inputMode="numeric" min="1" max="8" value={perDay} onChange={(event) => setPerDay(event.target.value)} placeholder="No target" /></label>
        </div>
        <label className="field"><span>Walking tolerance</span><select value={walking} onChange={(event) => setWalking(event.target.value as 'low' | 'medium' | 'high')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </section>

      <section className="form-panel form-stack">
        <div className="section-heading"><h2>Requirements</h2></div>
        <label className="field"><span>Must-do <small>one per line</small></span><textarea rows={3} value={mustDo} onChange={(event) => setMustDo(event.target.value)} /></label>
        <label className="field"><span>Would like <small>one per line</small></span><textarea rows={3} value={wouldLike} onChange={(event) => setWouldLike(event.target.value)} /></label>
        <label className="field"><span>Food restrictions <small>comma-separated</small></span><input value={food} onChange={(event) => setFood(event.target.value)} /></label>
        <label className="field"><span>Special requirements <small>one per line</small></span><textarea rows={3} value={special} onChange={(event) => setSpecial(event.target.value)} placeholder="Work calls, luggage, accessibility…" /></label>
      </section>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="wizard-actions brief-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save details'}</button></div>
    </div>
  )
}

export default TripBriefScreen
