import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { itineraryService } from '../../data/services/itineraryService'
import { transportService } from '../../data/services/transportService'
import type { TransportMode } from '../../data/types/entities'
import { formatShortDate } from '../../data/utils/tripDate'

const modes: Array<{ value: TransportMode; label: string }> = [
  { value: 'walk', label: 'Walk' },
  { value: 'bike', label: 'Bike' },
  { value: 'metro', label: 'Metro / subway' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'taxi', label: 'Taxi / rideshare' },
  { value: 'car', label: 'Car' },
  { value: 'ferry', label: 'Ferry' },
  { value: 'flight', label: 'Flight' },
  { value: 'other', label: 'Other' },
]

function TransportEditorScreen() {
  const { tripId = '', dayId = '', segmentId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useLiveQuery(async () => {
    const day = await itineraryService.getDay(tripId, dayId)
    const segment = segmentId ? await transportService.getSegment(tripId, segmentId) : null
    return { day, segment }
  }, [tripId, dayId, segmentId])

  const [initializedFor, setInitializedFor] = useState('')
  const [fromActivityId, setFromActivityId] = useState('')
  const [toActivityId, setToActivityId] = useState('')
  const [mode, setMode] = useState<TransportMode>('walk')
  const [departureTime, setDepartureTime] = useState('')
  const [duration, setDuration] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState('')
  const [routeNotes, setRouteNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data?.day) return
    const key = segmentId ? `${segmentId}:${data.segment?.revision ?? 'missing'}` : `new:${dayId}:${searchParams.toString()}`
    if (initializedFor === key) return

    if (segmentId && data.segment) {
      setFromActivityId(data.segment.from_activity_id ?? '')
      setToActivityId(data.segment.to_activity_id ?? '')
      setMode(data.segment.mode)
      setDepartureTime(data.segment.departure_time ?? '')
      setDuration(data.segment.duration_minutes?.toString() ?? '')
      setCost(data.segment.cost?.toString() ?? '')
      setCurrency(data.segment.currency ?? data.day.trip.base_currency ?? '')
      setRouteNotes(data.segment.route_notes ?? '')
    } else {
      const requestedFrom = searchParams.get('from') ?? ''
      const requestedTo = searchParams.get('to') ?? ''
      const validIds = new Set(data.day.activities.map((activity) => activity.id))
      setFromActivityId(validIds.has(requestedFrom) ? requestedFrom : data.day.activities[0]?.id ?? '')
      setToActivityId(validIds.has(requestedTo) ? requestedTo : data.day.activities[1]?.id ?? '')
      setMode('walk')
      setDepartureTime('')
      setDuration('')
      setCost('')
      setCurrency(data.day.trip.base_currency ?? '')
      setRouteNotes('')
    }
    setInitializedFor(key)
  }, [data, dayId, initializedFor, searchParams, segmentId])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening transport editor…</div></div>
  if (!data.day || (segmentId && !data.segment)) return <div className="page-stack"><PageIntro eyebrow="Transport" title="Transport segment not found" description="The route or day may have been removed." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Back to itinerary</button>} /></div>

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      const draft = {
        tripDayId: dayId,
        fromActivityId,
        toActivityId,
        mode,
        departureTime: departureTime || null,
        durationMinutes: duration.trim() ? Number(duration) : null,
        cost: cost.trim() ? Number(cost) : null,
        currency: currency.trim() || null,
        routeNotes: routeNotes || null,
      }
      if (segmentId) await transportService.updateSegment(tripId, segmentId, draft)
      else await transportService.createSegment(tripId, draft)
      navigate(`/trip/${tripId}/itinerary/day/${dayId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this transport segment.')
    } finally {
      setBusy(false)
    }
  }

  const isEditing = Boolean(segmentId)
  const activityLabel = (activityId: string) => {
    const activity = data.day?.activities.find((item) => item.id === activityId)
    return activity ? activity.title : 'Choose activity'
  }

  return (
    <div className="page-stack transport-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}`)}>← Day {data.day.day.day_number}</button></div>
      <PageIntro
        eyebrow={isEditing ? 'Edit transport' : `Day ${data.day.day.day_number} · ${formatShortDate(data.day.day.date)}`}
        title={isEditing ? 'Update route details' : 'Add transport'}
        description="Record the practical movement between two itinerary stops. This is manual and works offline; live routing and maps can plug into the same data later."
      />

      <section className="activity-editor-card">
        {data.day.activities.length < 2 ? <div className="inline-empty"><strong>Add at least two activities first</strong><span>Transportation connects one activity to another, so this day needs two itinerary stops.</span><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}/activity/new`)}>Add activity</button></div> : <div className="form-stack">
          <div className="transport-route-preview" aria-label="Selected route"><span>{activityLabel(fromActivityId)}</span><strong>→</strong><span>{activityLabel(toActivityId)}</span></div>

          <div className="field-grid field-grid--2">
            <label className="field"><span>From activity</span><select value={fromActivityId} onChange={(event) => setFromActivityId(event.target.value)}>{data.day.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
            <label className="field"><span>To activity</span><select value={toActivityId} onChange={(event) => setToActivityId(event.target.value)}>{data.day.activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
            <label className="field"><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as TransportMode)}>{modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field"><span>Departure time <small>optional</small></span><input type="time" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} /></label>
            <label className="field"><span>Duration <small>minutes, optional</small></span><input type="number" min="1" max="1440" step="1" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="25" /></label>
            <label className="field"><span>Cost <small>optional</small></span><input type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0" /></label>
            <label className="field"><span>Currency <small>3-letter code</small></span><input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="TWD" /></label>
          </div>

          <label className="field"><span>Route notes <small>optional</small></span><textarea rows={4} value={routeNotes} onChange={(event) => setRouteNotes(event.target.value)} placeholder="Station entrance, platform, bus number, transfer point, ticket note…" /></label>
          <p className="field-hint">The route remains usable offline. Maps, live schedules, and automatic travel-time calculations are intentionally deferred.</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : isEditing ? 'Save route' : 'Add transport'}</button></div>
        </div>}
      </section>
    </div>
  )
}

export default TransportEditorScreen
