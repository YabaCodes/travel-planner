import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { travelLegService, type TravelLegCenterData, type TravelLegView } from '../../data/services/travelLegService'
import './travel-legs.css'

interface QueryResult {
  value: TravelLegCenterData | null
  error: string | null
}

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Could not open major travel.'

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not set'
  const [date, time = ''] = value.split('T')
  return `${date} ${time.slice(0, 5)}`.trim()
}

const destinationLabel = (view: TravelLegView) => {
  const from = view.fromDestination ? `${view.fromDestination.city}, ${view.fromDestination.country}` : 'Unlinked'
  const to = view.toDestination ? `${view.toDestination.city}, ${view.toDestination.country}` : 'Unlinked'
  return `${from} → ${to}`
}

function TravelLegsScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const result = useLiveQuery<QueryResult>(async () => {
    try {
      return { value: await travelLegService.getCenter(tripId), error: null }
    } catch (reason) {
      return { value: null, error: errorMessage(reason) }
    }
  }, [tripId])

  if (result === undefined) return <div className="page-stack"><div className="loading-card">Opening major travel…</div></div>
  if (result.error) return <div className="page-stack"><PageIntro eyebrow="Major travel" title="Travel legs couldn't open" description={result.error} action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more`)}>Back to trip tools</button>} /></div>
  if (!result.value) return <div className="page-stack"><PageIntro eyebrow="Major travel" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const data = result.value

  const remove = async (view: TravelLegView) => {
    const liveBookings = view.bookings.filter((booking) => booking.status !== 'cancelled')
    const suffix = liveBookings.length ? ` ${liveBookings.length} linked booking record${liveBookings.length === 1 ? '' : 's'} will be preserved and unlinked.` : ''
    if (!window.confirm(`Delete the travel leg “${view.leg.origin} → ${view.leg.destination}”?${suffix}`)) return
    await travelLegService.softDeleteTravelLeg(view.leg.id)
  }

  return (
    <div className="page-stack travel-legs-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>← Trip tools</button></div>
      <PageIntro
        eyebrow={`Major travel · ${data.trip.title}`}
        title="Travel legs"
        description="Track the major moves between cities, regions, airports, stations, and other trip stops. Local movement between itinerary activities stays in day transport."
        action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/travel-legs/new`)}><PlusIcon />Add travel leg</button>}
      />

      <section className="travel-leg-summary" aria-label="Travel leg summary">
        <div><span>Travel legs</span><strong>{data.counts.all}</strong></div>
        <div><span>With booking</span><strong>{data.counts.withBookings}</strong></div>
        <div><span>Booked</span><strong>{data.counts.booked}</strong></div>
        <div><span>Not tracked</span><strong>{data.counts.unbooked}</strong></div>
      </section>

      {!data.legs.length ? (
        <section className="travel-leg-empty">
          <span className="eyebrow">Major transport</span>
          <h2>No travel legs yet</h2>
          <p>Add flights, inter-city trains, ferries, long-distance buses, rental-car transfers, or other major movement between trip stops.</p>
          <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/travel-legs/new`)}><PlusIcon />Add first travel leg</button>
        </section>
      ) : (
        <section className="travel-leg-stack" aria-label="Major travel records">
          {data.legs.map((view) => {
            const leg = view.leg
            const liveBookings = view.bookings.filter((booking) => booking.status !== 'cancelled')
            const booked = liveBookings.some((booking) => booking.status === 'booked')
            const toBook = liveBookings.some((booking) => booking.status === 'to_book')
            return <article className="travel-leg-card" key={leg.id}>
              <div className="travel-leg-card__topline">
                <div className="travel-leg-card__badges"><span className="travel-leg-mode">{titleCase(leg.mode)}</span>{booked ? <span className="travel-leg-booking travel-leg-booking--booked">Booked</span> : toBook ? <span className="travel-leg-booking">To book</span> : null}</div>
                <div className="inline-actions"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/travel-legs/${leg.id}/edit`)}>Edit</button><button className="text-button danger-text" type="button" onClick={() => remove(view)}>Delete</button></div>
              </div>

              <h2>{leg.origin} <span aria-hidden="true">→</span> {leg.destination}</h2>
              <p className="travel-leg-card__linked">{destinationLabel(view)}</p>

              <div className="travel-leg-meta">
                <div><span>Departure</span><strong>{formatDateTime(leg.departure_at)}</strong></div>
                <div><span>Arrival</span><strong>{formatDateTime(leg.arrival_at)}</strong></div>
                <div><span>Operator</span><strong>{leg.operator || 'Not set'}</strong></div>
                <div><span>Service</span><strong>{leg.service_number || 'Not set'}</strong></div>
              </div>

              {leg.notes ? <p className="travel-leg-card__notes">{leg.notes}</p> : null}

              <div className="travel-leg-card__actions">
                {!liveBookings.length ? <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings/new?travelLegId=${leg.id}`)}>Track booking</button> : null}
                {liveBookings.length === 1 ? <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings/${liveBookings[0].id}/edit`)}>Manage booking</button> : null}
                {liveBookings.length > 1 ? <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}>View {liveBookings.length} bookings</button> : null}
                {liveBookings.find((booking) => booking.url)?.url ? <a className="button button--secondary" href={liveBookings.find((booking) => booking.url)?.url ?? '#'} target="_blank" rel="noreferrer">Open booking link</a> : null}
              </div>
            </article>
          })}
        </section>
      )}
    </div>
  )
}

export default TravelLegsScreen
