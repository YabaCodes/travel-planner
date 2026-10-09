import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { itineraryService } from '../../data/services/itineraryService'
import { formatShortDate, todayYmd } from '../../data/utils/tripDate'
import type { TripDestination } from '../../data/types/entities'
import './itinerary-tools.css'

// "Lyon May 2 – May 9" for each city, from the days assigned to it.
const cityRanges = (days: Array<{ day: { date: string | null; destination_id: string | null } }>, destinations: TripDestination[]) => destinations.map((destination) => {
  const dates = days.filter((item) => item.day.destination_id === destination.id && item.day.date).map((item) => item.day.date as string)
  return { destination, count: dates.length, from: dates[0] ?? null, to: dates.at(-1) ?? null }
})

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

  // "Add activity" goes to today's day while traveling, otherwise the first day.
  const firstDay = data.days.find((item) => item.day.date === todayYmd())?.day ?? data.days[0]?.day
  const ranges = data.destinations.length > 1 ? cityRanges(data.days, data.destinations) : []
  const withoutCity = data.destinations.length > 1 ? data.days.filter((item) => !item.day.destination_id).length : 0
  const moveUnplaced = async (activityId: string, dayId: string) => {
    if (dayId) await itineraryService.moveActivityToDay(activityId, dayId)
  }
  const deleteUnplaced = async (activityId: string, title: string) => {
    if (window.confirm(`Delete “${title}”?`)) await itineraryService.softDeleteActivity(activityId)
  }

  return (
    <div className="page-stack itinerary-page">
      <PageIntro
        eyebrow={data.trip.title}
        title="Itinerary"
        description={data.days.length ? `${data.days.length} trip days. Build each day as a flexible sequence, then adjust times and order as plans change.` : 'This trip does not have dated days yet. Set trip dates first and the day planner will be generated automatically.'}
        action={firstDay ? <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${firstDay.id}/activity/new`)}><PlusIcon />Add activity</button> : <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Set trip dates</button>}
      />

      {data.unplaced.length ? (
        <section className="unplaced-card" aria-label="Activities that need a day">
          <div><strong>{data.unplaced.length} activit{data.unplaced.length === 1 ? 'y needs' : 'ies need'} a day</strong><p>{data.unplaced.length === 1 ? 'It was' : 'They were'} on days removed by an earlier date change. Choose a day to bring {data.unplaced.length === 1 ? 'it' : 'them'} back.</p></div>
          <ul>
            {data.unplaced.map(({ activity, formerDate }) => (
              <li key={activity.id}>
                <span><strong>{activity.title}</strong><small>Was on {formatShortDate(formerDate)}{activity.start_time ? ` at ${activity.start_time}` : ''}</small></span>
                <span className="unplaced-card__actions">
                  {data.days.length ? <label><span className="visually-hidden">Move {activity.title} to</span><select value="" onChange={(event) => moveUnplaced(activity.id, event.target.value)}><option value="">Move to…</option>{data.days.map(({ day }) => <option key={day.id} value={day.id}>Day {day.day_number} · {formatShortDate(day.date)}</option>)}</select></label> : null}
                  <button className="text-button danger-text" type="button" onClick={() => deleteUnplaced(activity.id, activity.title)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ranges.length && data.days.length ? (
        <section className="city-summary" aria-label="Cities">
          <div className="city-summary__list">
            {ranges.map(({ destination, count, from, to }) => <div key={destination.id}><strong>{destination.city}</strong><span>{count ? `${formatShortDate(from)}${from !== to ? ` – ${formatShortDate(to)}` : ''} · ${count} day${count === 1 ? '' : 's'}` : 'No days yet'}</span></div>)}
            {withoutCity ? <div className="city-summary__missing"><strong>No city</strong><span>{withoutCity} day{withoutCity === 1 ? '' : 's'}</span></div> : null}
          </div>
          <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/cities`)}>Set city dates</button>
        </section>
      ) : null}

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
