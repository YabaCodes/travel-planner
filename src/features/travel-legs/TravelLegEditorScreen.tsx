import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { travelLegService } from '../../data/services/travelLegService'
import type { TransportMode } from '../../data/types/entities'
import './travel-legs.css'

const modes: Array<{ value: TransportMode; label: string }> = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'ferry', label: 'Ferry' },
  { value: 'car', label: 'Car' },
  { value: 'taxi', label: 'Taxi / transfer' },
  { value: 'metro', label: 'Metro' },
  { value: 'walk', label: 'Walk' },
  { value: 'bike', label: 'Bike' },
  { value: 'other', label: 'Other' },
]

function TravelLegEditorScreen() {
  const { tripId = '', travelLegId } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => travelLegService.getEditorData(tripId, travelLegId), [tripId, travelLegId])
  const [initializedKey, setInitializedKey] = useState('')
  const [fromDestinationId, setFromDestinationId] = useState('')
  const [toDestinationId, setToDestinationId] = useState('')
  const [mode, setMode] = useState<TransportMode>('flight')
  const [operator, setOperator] = useState('')
  const [serviceNumber, setServiceNumber] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [departureAt, setDepartureAt] = useState('')
  const [arrivalAt, setArrivalAt] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data) return
    const key = travelLegId ? `${travelLegId}:${data.leg?.revision ?? 'missing'}` : `new:${tripId}`
    if (initializedKey === key) return
    if (data.leg) {
      setFromDestinationId(data.leg.from_destination_id ?? '')
      setToDestinationId(data.leg.to_destination_id ?? '')
      setMode(data.leg.mode)
      setOperator(data.leg.operator ?? '')
      setServiceNumber(data.leg.service_number ?? '')
      setOrigin(data.leg.origin)
      setDestination(data.leg.destination)
      setDepartureAt(data.leg.departure_at ?? '')
      setArrivalAt(data.leg.arrival_at ?? '')
      setNotes(data.leg.notes ?? '')
    }
    setInitializedKey(key)
  }, [data, initializedKey, travelLegId, tripId])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening travel leg…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Major travel" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>
  if (travelLegId && !data.leg) return <div className="page-stack"><PageIntro eyebrow="Major travel" title="Travel leg not found" description="This travel leg may have been deleted." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/travel-legs`)}>Back to travel legs</button>} /></div>

  const isEditing = Boolean(travelLegId)
  const labelForDestination = (id: string) => {
    const item = data.destinations.find((candidate) => candidate.id === id)
    return item ? `${item.city}, ${item.country}` : ''
  }

  const changeFromDestination = (id: string) => {
    setFromDestinationId(id)
    if (!origin.trim() && id) setOrigin(labelForDestination(id))
  }

  const changeToDestination = (id: string) => {
    setToDestinationId(id)
    if (!destination.trim() && id) setDestination(labelForDestination(id))
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const draft = {
        fromDestinationId: fromDestinationId || null,
        toDestinationId: toDestinationId || null,
        mode,
        operator: operator || null,
        serviceNumber: serviceNumber || null,
        origin,
        destination,
        departureAt: departureAt || null,
        arrivalAt: arrivalAt || null,
        notes: notes || null,
      }
      if (travelLegId) await travelLegService.updateTravelLeg(tripId, travelLegId, draft)
      else await travelLegService.createTravelLeg(tripId, draft)
      navigate(`/trip/${tripId}/more/travel-legs`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this travel leg.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack travel-leg-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/travel-legs`)}>← Travel legs</button></div>
      <PageIntro
        eyebrow={isEditing ? 'Edit major travel' : `Major travel · ${data.trip.title}`}
        title={isEditing ? 'Update travel leg' : 'Add travel leg'}
        description="Use linked destinations for the trip stops this leg connects, and origin/destination for the actual airport, station, terminal, city, or pickup point."
      />

      <section className="travel-leg-editor-card">
        <div className="form-stack">
          <div className="field-grid field-grid--2">
            <label className="field"><span>From trip destination <small>optional</small></span><select value={fromDestinationId} onChange={(event) => changeFromDestination(event.target.value)}><option value="">Not linked</option>{data.destinations.map((item) => <option key={item.id} value={item.id}>{item.city}, {item.country}</option>)}</select></label>
            <label className="field"><span>To trip destination <small>optional</small></span><select value={toDestinationId} onChange={(event) => changeToDestination(event.target.value)}><option value="">Not linked</option>{data.destinations.map((item) => <option key={item.id} value={item.id}>{item.city}, {item.country}</option>)}</select></label>
          </div>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Origin</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="TPE Airport, Tokyo Station, Paris…" /></label>
            <label className="field"><span>Destination</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="NRT Airport, Kyoto Station, Zurich…" /></label>
          </div>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as TransportMode)}>{modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field"><span>Operator <small>optional</small></span><input value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="Airline, railway, ferry company…" /></label>
            <label className="field"><span>Service number <small>optional</small></span><input value={serviceNumber} onChange={(event) => setServiceNumber(event.target.value)} placeholder="Flight / train / bus number" /></label>
          </div>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Departure <small>optional</small></span><input type="datetime-local" value={departureAt} onChange={(event) => setDepartureAt(event.target.value)} /></label>
            <label className="field"><span>Arrival <small>optional</small></span><input type="datetime-local" value={arrivalAt} onChange={(event) => setArrivalAt(event.target.value)} /></label>
          </div>

          <label className="field"><span>Notes <small>optional</small></span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Terminal, seat, baggage, pickup point, connection details…" /></label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/travel-legs`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : isEditing ? 'Save changes' : 'Add travel leg'}</button></div>
        </div>
      </section>
    </div>
  )
}

export default TravelLegEditorScreen
