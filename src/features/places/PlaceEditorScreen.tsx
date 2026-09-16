import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { placeService } from '../../data/services/placeService'
import type { PlaceCategory, Priority } from '../../data/types/entities'

const categories: Array<{ value: PlaceCategory; label: string }> = [
  { value: 'attraction', label: 'Attraction' },
  { value: 'food', label: 'Food' },
  { value: 'cafe', label: 'Café' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'nature', label: 'Nature' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'transport', label: 'Transport' },
  { value: 'event', label: 'Event' },
  { value: 'activity', label: 'Activity' },
  { value: 'custom', label: 'Custom' },
]

const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value)

function PlaceEditorScreen() {
  const { tripId = '', tripPlaceId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnDayId = searchParams.get('returnDayId')
  const existing = useLiveQuery(() => tripPlaceId ? placeService.getTripPlace(tripId, tripPlaceId) : Promise.resolve(null), [tripId, tripPlaceId])

  const [initializedFor, setInitializedFor] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('attraction')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [priority, setPriority] = useState<Priority>('preferred')
  const [duration, setDuration] = useState('90')
  const [placeNotes, setPlaceNotes] = useState('')
  const [tripNotes, setTripNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tripPlaceId && existing === undefined) return
    const key = tripPlaceId ? `${tripPlaceId}:${existing?.tripPlace.revision ?? 'missing'}` : 'new'
    if (initializedFor === key) return
    if (existing) {
      setName(existing.place.name)
      setCategory(existing.place.category)
      setCity(existing.place.city ?? '')
      setArea(existing.place.area ?? '')
      setAddress(existing.place.address ?? '')
      setWebsite(existing.place.website ?? '')
      setLatitude(existing.place.latitude?.toString() ?? '')
      setLongitude(existing.place.longitude?.toString() ?? '')
      setPriority(existing.tripPlace.priority)
      setDuration(existing.tripPlace.estimated_visit_minutes?.toString() ?? '')
      setPlaceNotes(existing.place.notes ?? '')
      setTripNotes(existing.tripPlace.notes ?? '')
    }
    setInitializedFor(key)
  }, [existing, initializedFor, tripPlaceId])

  if (tripPlaceId && existing === undefined) return <div className="page-stack"><div className="loading-card">Opening place…</div></div>
  if (tripPlaceId && existing === null) return <div className="page-stack"><PageIntro eyebrow="Places" title="Place not found" description="This place may have been removed from the trip library." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/places`)}>Back to Places</button>} /></div>

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      const draft = {
        name,
        category,
        city: city || null,
        area: area || null,
        address: address || null,
        website: website || null,
        latitude: numberOrNull(latitude),
        longitude: numberOrNull(longitude),
        priority,
        estimatedVisitMinutes: numberOrNull(duration),
        placeNotes: placeNotes || null,
        tripNotes: tripNotes || null,
      }
      if (tripPlaceId) {
        await placeService.updateTripPlace(tripId, tripPlaceId, draft)
        navigate(`/trip/${tripId}/more/places`)
      } else {
        const createdId = await placeService.createTripPlace(tripId, draft)
        if (returnDayId) navigate(`/trip/${tripId}/itinerary/day/${returnDayId}/activity/new?tripPlaceId=${createdId}`)
        else navigate(`/trip/${tripId}/more/places`)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this place.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack place-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => returnDayId ? navigate(`/trip/${tripId}/itinerary/day/${returnDayId}`) : navigate(`/trip/${tripId}/more/places`)}>← {returnDayId ? 'Day planner' : 'Places'}</button></div>
      <PageIntro
        eyebrow={tripPlaceId ? 'Edit place' : 'New place'}
        title={tripPlaceId ? 'Update saved place' : 'Save a place'}
        description={returnDayId ? 'Save the place once. After this, you’ll return to the activity editor with it already selected.' : 'Keep the factual place details separate from trip-specific priority, expected duration, and planning notes.'}
      />

      <section className="activity-editor-card">
        <div className="form-stack">
          <div className="section-heading"><span className="eyebrow">Place details</span><h2>What and where?</h2><p>Only the name is required. Add location and reference details when they are useful.</p></div>

          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Modern Art Museum" autoFocus /></label>
          <div className="field-grid field-grid--2">
            <label className="field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as PlaceCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field"><span>City <small>optional</small></span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" /></label>
            <label className="field"><span>Area / neighborhood <small>optional</small></span><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Neighborhood or district" /></label>
            <label className="field"><span>Website <small>optional</small></span><input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="example.com" /></label>
          </div>
          <label className="field"><span>Address <small>optional</small></span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address" /></label>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Latitude <small>optional</small></span><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="25.0330" /></label>
            <label className="field"><span>Longitude <small>optional</small></span><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="121.5654" /></label>
          </div>

          <label className="field"><span>Place notes <small>optional</small></span><textarea rows={3} value={placeNotes} onChange={(event) => setPlaceNotes(event.target.value)} placeholder="Opening-hour reminder, what makes this place interesting, entrance location…" /></label>

          <div className="section-heading"><span className="eyebrow">For this trip</span><h2>How important is it?</h2><p>These settings belong to this trip and become useful defaults when you schedule the place.</p></div>
          <div className="field-grid field-grid--2">
            <label className="field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="must_do">Must do</option><option value="preferred">Preferred</option><option value="optional">Optional</option></select></label>
            <label className="field"><span>Expected visit <small>minutes</small></span><input type="number" min="5" max="1440" step="5" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="90" /></label>
          </div>
          <label className="field"><span>Trip-specific notes <small>optional</small></span><textarea rows={3} value={tripNotes} onChange={(event) => setTripNotes(event.target.value)} placeholder="Why we want to go, what to order, best day to fit it…" /></label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => returnDayId ? navigate(`/trip/${tripId}/itinerary/day/${returnDayId}`) : navigate(`/trip/${tripId}/more/places`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : tripPlaceId ? 'Save changes' : returnDayId ? 'Save & schedule' : 'Save place'}</button></div>
        </div>
      </section>
    </div>
  )
}

export default PlaceEditorScreen
