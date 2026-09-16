import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { itineraryService } from '../../data/services/itineraryService'
import { formatShortDate } from '../../data/utils/tripDate'

const weekday = (value: string | null) => {
  if (!value) return 'Flexible day'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function ItineraryScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => itineraryService.getOverview(tripId), [tripId])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Loading itinerary…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Itinerary" title="Trip not found" description="Return to My Trips and choose another trip." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const firstDay = data.days[0]?.day

  return (
    <div className="page-stack itinerary-page">
      <PageIntro
        eyebrow={data.trip.title}
        title="Itinerary"
        description={data.days.length ? `${data.days.length} trip days. Build each day as a flexible sequence, then adjust times and order as plans change.` : 'This trip does not have dated days yet. Set trip dates first and the day planner will be generated automatically.'}
        action={firstDay ? <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${firstDay.id}/activity/new`)}><PlusIcon />Add activity</button> : <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Set trip dates</button>}
      />

      {data.days.length ? (
        <section className="itinerary-summary-strip" aria-label="Itinerary summary">
          <div><span>Activities</span><strong>{data.counts.activities}</strong></div>
          <div><span>Timed</span><strong>{data.counts.timed}</strong></div>
          <div><span>Free time</span><strong>{data.counts.freeTime}</strong></div>
          <div><span>Days</span><strong>{data.days.length}</strong></div>
        </section>
      ) : null}

      {!data.days.length ? (
        <section className="itinerary-empty">
          <div className="itinerary-empty__number">01</div>
          <h2>Add dates to unlock the day planner</h2>
          <p>Trip days are generated from your departure and return dates. Existing activities are protected when shortening a trip: the editor warns you before affected days are removed.</p>
          <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Edit trip dates</button>
        </section>
      ) : (
        <section className="day-card-list" aria-label="Trip days">
          {data.days.map(({ day, destination, activities, load, overlapCount }) => (
            <article className="day-card" key={day.id}>
              <button className="day-card__main" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${day.id}`)}>
                <div className="day-card__identity">
                  <span>Day {day.day_number}</span>
                  <strong>{formatShortDate(day.date)}</strong>
                  <small>{weekday(day.date)}</small>
                </div>
                <div className="day-card__content">
                  <div className="day-card__topline">
                    <h2>{day.title || destination?.city || 'Plan this day'}</h2>
                    <span className={`load-pill load-pill--${load.label.toLowerCase().replace(' ', '-')}`}>{load.label}</span>
                  </div>
                  <p>{destination ? `${destination.city}, ${destination.country}` : 'Destination can be assigned later'} </p>
                  <div className="day-card__meta">
                    <span>{activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
                    {load.target ? <span>Target {load.target}</span> : null}
                    {overlapCount ? <span className="warning-text">{overlapCount} time conflict{overlapCount === 1 ? '' : 's'}</span> : null}
                  </div>
                </div>
              </button>
              <button className="day-card__add" type="button" aria-label={`Add activity to day ${day.day_number}`} onClick={() => navigate(`/trip/${tripId}/itinerary/day/${day.id}/activity/new`)}><PlusIcon /></button>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

export default ItineraryScreen
