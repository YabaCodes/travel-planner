import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripService } from '../../data/services/tripService'
import { formatDateRange } from '../../data/utils/tripDate'

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function TripDashboardScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => tripService.getDashboard(tripId), [tripId])

  useEffect(() => {
    if (data?.trip.id) localStorage.setItem('lastOpenedTripId', data.trip.id)
  }, [data?.trip.id])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening trip…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Trip workspace" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const destinationLabel = data.destinations.map((destination) => `${destination.city}, ${destination.country}`).join(' · ')
  const travelerNames = data.travelers.map((traveler) => traveler.name).filter(Boolean).join(', ')

  const duplicate = async () => {
    const id = await tripService.duplicateTrip(tripId)
    navigate(`/trip/${id}`)
  }

  const remove = async () => {
    if (!window.confirm(`Delete “${data.trip.title}”?`)) return
    await tripService.softDeleteTrip(tripId)
    navigate('/trips')
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Trip workspace"
        title={data.trip.title}
        description={`${destinationLabel || 'Destination not set'} · ${formatDateRange(data.trip.start_date, data.trip.end_date)}`}
        action={<div className="inline-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Edit trip</button><button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Open itinerary</button></div>}
      />

      <section className="trip-overview-strip">
        <div><span>Status</span><strong>{titleCase(data.trip.status)}</strong></div>
        <div><span>Trip days</span><strong>{data.days.length || 'Flexible'}</strong></div>
        <div><span>Travelers</span><strong>{data.travelers.length}</strong></div>
        <div><span>Destinations</span><strong>{data.destinations.length}</strong></div>
      </section>

      <section className="dashboard-grid">
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}><span>Itinerary</span><strong>{data.counts.activities} activities</strong><small>{data.days.length ? `${data.days.length} days ready to plan` : 'Set dates to generate trip days'}</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}><span>Places</span><strong>{data.counts.places} saved</strong><small>Ideas and scheduled places will live here.</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}><span>Bookings</span><strong>{data.counts.bookings} records</strong><small>Reservations, confirmations, costs, and deadlines.</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}><span>Packing</span><strong>{data.counts.packingItems} items</strong><small>Offline packing lists arrive in the next feature milestones.</small></button>
      </section>

      <section className="brief-card">
        <div className="brief-card__heading"><div><span className="eyebrow">Trip Brief</span><h2>Planning context</h2></div><span className="trip-status">{titleCase(data.trip.status)}</span></div>
        <div className="brief-grid">
          <div><span>Destinations</span><strong>{destinationLabel || 'Not specified'}</strong></div>
          <div><span>Travelers</span><strong>{travelerNames || `${data.travelers.length} traveler${data.travelers.length === 1 ? '' : 's'}`}</strong></div>
          <div><span>Pace</span><strong>{data.preferences ? titleCase(data.preferences.pace) : 'Not specified'}</strong></div>
          <div><span>Day start</span><strong>{data.preferences?.preferred_day_start ?? 'Flexible'}</strong></div>
          <div className="brief-grid__wide"><span>Interests</span><strong>{data.preferences?.interests.length ? data.preferences.interests.join(' · ') : 'None specified'}</strong></div>
          <div className="brief-grid__wide"><span>Must-do</span><strong>{data.preferences?.must_do.length ? data.preferences.must_do.join(' · ') : 'None specified'}</strong></div>
          <div className="brief-grid__wide"><span>Food restrictions</span><strong>{data.preferences?.food_restrictions.length ? data.preferences.food_restrictions.join(' · ') : 'None specified'}</strong></div>
        </div>
      </section>

      <section className="trip-management"><button className="text-button" type="button" onClick={duplicate}>Duplicate trip</button><button className="text-button danger-text" type="button" onClick={remove}>Delete trip</button></section>
    </div>
  )
}

export default TripDashboardScreen
