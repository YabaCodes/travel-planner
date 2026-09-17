import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { readinessService, type ReadinessStatus } from '../../data/services/readinessService'
import { tripService } from '../../data/services/tripService'
import { formatDateRange } from '../../data/utils/tripDate'
import './trip-dashboard.css'

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const readinessLabel = (state: 'ready' | 'review' | 'attention') => {
  if (state === 'ready') return 'Ready to travel'
  if (state === 'review') return 'Final review'
  return 'Needs attention'
}

const checkStatusLabel = (status: ReadinessStatus) => status === 'ready' ? 'Clear' : status === 'review' ? 'Review' : 'Action'

function TripDashboardScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => tripService.getDashboard(tripId), [tripId])
  const readiness = useLiveQuery(() => readinessService.getReadiness(tripId), [tripId])

  useEffect(() => {
    if (data?.trip.id) localStorage.setItem('lastOpenedTripId', data.trip.id)
  }, [data?.trip.id])

  if (data === undefined || readiness === undefined) return <div className="page-stack"><div className="loading-card">Opening trip…</div></div>
  if (data === null || readiness === null) return <div className="page-stack"><PageIntro eyebrow="Trip workspace" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

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
    <div className="page-stack trip-dashboard-page">
      <PageIntro
        eyebrow="Trip workspace"
        title={data.trip.title}
        description={`${destinationLabel || 'Destination not set'} · ${formatDateRange(data.trip.start_date, data.trip.end_date)}`}
        action={<div className="inline-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Edit trip</button><button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Open itinerary</button></div>}
      />

      <section className={`readiness-card readiness-card--${readiness.summary.state}`} aria-label="Trip readiness">
        <div className="readiness-card__heading">
          <div>
            <span className="eyebrow">Trip readiness</span>
            <h2>{readinessLabel(readiness.summary.state)}</h2>
            <p>{readiness.summary.ready} of {readiness.summary.total} transparent readiness checks are clear. This status is calculated from your trip data and does not change the trip status automatically.</p>
          </div>
          <div className={`readiness-state readiness-state--${readiness.summary.state}`}>
            {readiness.summary.state === 'ready' ? '✓' : readiness.summary.state === 'review' ? '!' : readiness.summary.action}
          </div>
        </div>

        <div className="readiness-metrics">
          <div><span>Clear</span><strong>{readiness.summary.ready}</strong></div>
          <div><span>Action</span><strong>{readiness.summary.action}</strong></div>
          <div><span>Review</span><strong>{readiness.summary.review}</strong></div>
        </div>

        <div className="readiness-checks">
          {readiness.checks.map((check) => (
            <button className={`readiness-check readiness-check--${check.status}`} type="button" key={check.id} onClick={() => navigate(check.path)}>
              <span className="readiness-check__marker" aria-hidden="true">{check.status === 'ready' ? '✓' : check.status === 'review' ? '!' : '•'}</span>
              <span className="readiness-check__body">
                <span className="readiness-check__topline"><strong>{check.label}</strong><small>{check.category}</small></span>
                <span>{check.detail}</span>
              </span>
              <span className="readiness-check__action">{checkStatusLabel(check.status)} →</span>
            </button>
          ))}
        </div>
      </section>

      <section className="trip-overview-strip">
        <div><span>Status</span><strong>{titleCase(data.trip.status)}</strong></div>
        <div><span>Trip days</span><strong>{data.days.length || 'Flexible'}</strong></div>
        <div><span>Travelers</span><strong>{data.travelers.length}</strong></div>
        <div><span>Destinations</span><strong>{data.destinations.length}</strong></div>
      </section>

      <section className="dashboard-grid dashboard-grid--expanded">
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}><span>Itinerary</span><strong>{data.counts.activities} activities</strong><small>{readiness.inventory.emptyDays ? `${readiness.inventory.emptyDays} day${readiness.inventory.emptyDays === 1 ? '' : 's'} still empty` : data.days.length ? 'Every trip day has a plan' : 'Set dates to generate trip days'}</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more/places`)}><span>Places</span><strong>{data.counts.places} saved</strong><small>Ideas, priorities, and scheduled places.</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}><span>Bookings</span><strong>{data.counts.bookings} records</strong><small>{readiness.inventory.missingRequiredBookings || readiness.inventory.toBookBookings ? `${readiness.inventory.missingRequiredBookings + readiness.inventory.toBookBookings} booking action${readiness.inventory.missingRequiredBookings + readiness.inventory.toBookBookings === 1 ? '' : 's'} outstanding` : 'No booking actions outstanding'}</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing`)}><span>Packing</span><strong>{data.counts.packingItems} items</strong><small>{readiness.inventory.requiredPackingRemaining ? `${readiness.inventory.requiredPackingRemaining} required item${readiness.inventory.requiredPackingRemaining === 1 ? '' : 's'} incomplete` : readiness.inventory.packingItems ? `${readiness.inventory.packedUnits}/${readiness.inventory.totalPackingUnits} units packed` : 'Checklist not started'}</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more/travel-legs`)}><span>Travel legs</span><strong>{readiness.inventory.travelLegs} recorded</strong><small>Major flights, trains, ferries, buses, and inter-city moves.</small></button>
        <button className="dashboard-card" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}><span>Trip info</span><strong>{readiness.inventory.tripInfoItems} items</strong><small>{readiness.inventory.tripInfoSections ? `${readiness.inventory.tripInfoSections} offline reference section${readiness.inventory.tripInfoSections === 1 ? '' : 's'}` : 'Offline reference binder not started'}</small></button>
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
