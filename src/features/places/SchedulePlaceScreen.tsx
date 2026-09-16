import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { placeService } from '../../data/services/placeService'
import { itineraryService } from '../../data/services/itineraryService'
import type { BookingRequirement } from '../../data/types/entities'
import { formatShortDate } from '../../data/utils/tripDate'

function SchedulePlaceScreen() {
  const { tripId = '', tripPlaceId = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const [place, itinerary] = await Promise.all([
      placeService.getTripPlace(tripId, tripPlaceId),
      itineraryService.getOverview(tripId),
    ])
    return { place, itinerary }
  }, [tripId, tripPlaceId])

  const [dayId, setDayId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [bookingRequirement, setBookingRequirement] = useState<BookingRequirement>('none')
  const [timeLocked, setTimeLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Preparing place…</div></div>
  if (!data.place || !data.itinerary) return <div className="page-stack"><PageIntro eyebrow="Places" title="Place not found" description="The place or trip is no longer available." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/places`)}>Back to Places</button>} /></div>

  const resolvedDayId = dayId || data.itinerary.days[0]?.day.id || ''

  const schedule = async () => {
    setError('')
    setBusy(true)
    try {
      if (!resolvedDayId) throw new Error('This trip has no itinerary days to schedule into.')
      await placeService.scheduleTripPlace({
        tripId,
        tripPlaceId,
        tripDayId: resolvedDayId,
        startTime: startTime || null,
        bookingRequirement,
        timeLocked,
      })
      navigate(`/trip/${tripId}/itinerary/day/${resolvedDayId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not schedule this place.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack schedule-place-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/places`)}>← Places</button></div>
      <PageIntro eyebrow="Schedule place" title={data.place.place.name} description="Choose the day now. Timing can stay flexible, or you can add a fixed start time when the place has a reservation or timed entry." />

      <section className="activity-editor-card">
        <div className="schedule-place-summary">
          <span className={`place-status place-status--${data.place.status}`}>{data.place.status}</span>
          <strong>{[data.place.place.area, data.place.place.city].filter(Boolean).join(' · ') || 'Location not added'}</strong>
          <small>{data.place.tripPlace.estimated_visit_minutes ? `${data.place.tripPlace.estimated_visit_minutes} min expected visit` : 'No default duration'} · {data.place.tripPlace.priority.replace('_', ' ')}</small>
        </div>

        {data.itinerary.days.length ? (
          <div className="form-stack">
            <label className="field"><span>Day</span><select value={resolvedDayId} onChange={(event) => setDayId(event.target.value)}>{data.itinerary.days.map(({ day, destination }) => <option key={day.id} value={day.id}>Day {day.day_number} · {formatShortDate(day.date)}{destination?.city ? ` · ${destination.city}` : ''}{day.title ? ` · ${day.title}` : ''}</option>)}</select></label>
            <div className="field-grid field-grid--2">
              <label className="field"><span>Start time <small>optional</small></span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
              <label className="field"><span>Booking requirement</span><select value={bookingRequirement} onChange={(event) => setBookingRequirement(event.target.value as BookingRequirement)}><option value="none">None</option><option value="recommended">Recommended</option><option value="required">Required</option></select></label>
            </div>
            <label className="check-row"><input type="checkbox" checked={timeLocked} onChange={(event) => setTimeLocked(event.target.checked)} /><span><strong>Lock this time</strong><small>Use when the selected start time should be treated as fixed during later replanning.</small></span></label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/places`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={schedule}>{busy ? 'Scheduling…' : 'Add to itinerary'}</button></div>
          </div>
        ) : (
          <div className="inline-empty"><strong>No trip days are available.</strong><span>Add dates to this trip first so the app can create itinerary days.</span><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Edit trip dates</button></div>
        )}
      </section>
    </div>
  )
}

export default SchedulePlaceScreen
