import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlaceholderPanel from '../../shared/components/PlaceholderPanel'
import TripCard from '../../shared/components/TripCard'
import CompassIcon from '../../shared/icons/CompassIcon'
import PlusIcon from '../../shared/icons/PlusIcon'
import { tripService, type TripSummary } from '../../data/services/tripService'

const groups: Array<{ key: ReturnType<typeof tripService.classifySummary>; title: string; description: string }> = [
  { key: 'current', title: 'Current', description: 'Trips happening now.' },
  { key: 'upcoming', title: 'Upcoming', description: 'Dated trips ahead.' },
  { key: 'idea', title: 'Ideas & planning', description: 'Flexible or not-yet-dated trips.' },
  { key: 'past', title: 'Past', description: 'Completed, archived, or finished trips.' },
]

function TripsScreen() {
  const navigate = useNavigate()
  const summaries = useLiveQuery(() => tripService.listSummaries(), [])

  const duplicate = async (summary: TripSummary) => {
    const id = await tripService.duplicateTrip(summary.trip.id)
    navigate(`/trip/${id}`)
  }

  const remove = async (summary: TripSummary) => {
    if (!window.confirm(`Delete “${summary.trip.title}”? The trip will be soft-deleted so its records remain recoverable in the database.`)) return
    await tripService.softDeleteTrip(summary.trip.id)
  }

  const hasTrips = Boolean(summaries?.length)

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Your travel workspace"
        title="My Trips"
        description="Plan, prepare, and travel from one reusable workspace. Each trip keeps its own itinerary, preferences, bookings, packing, and essential information."
        action={<div className="inline-actions"><button className="button button--secondary" type="button" onClick={() => navigate('/data')}>Data & Backup</button><button className="button button--primary" type="button" onClick={() => navigate('/trips/new')}><PlusIcon />New Trip</button></div>}
      />

      <div className="status-banner" role="status"><span className="status-banner__dot" />Local-first storage is active. Trips remain available offline on this device; use Data & Backup to keep a recoverable copy outside the browser.</div>

      {summaries === undefined ? <div className="loading-card">Loading your trips…</div> : null}

      {summaries !== undefined && !hasTrips ? (
        <PlaceholderPanel icon={<CompassIcon />} title="Start with your first trip" body="Create a Trip Brief now. You can use exact dates or keep it as an idea until the schedule is decided.">
          <button className="button button--primary empty-state-action" type="button" onClick={() => navigate('/trips/new')}><PlusIcon />Create first trip</button>
        </PlaceholderPanel>
      ) : null}

      {hasTrips ? <div className="trip-groups">
        {groups.map((group) => {
          const items = summaries!.filter((summary) => tripService.classifySummary(summary) === group.key)
          if (!items.length) return null
          return <section className="trip-group" key={group.key}><div className="trip-group__heading"><div><h2>{group.title}</h2><p>{group.description}</p></div><span>{items.length}</span></div><div className="trip-card-grid">{items.map((summary) => <TripCard key={summary.trip.id} summary={summary} onOpen={() => navigate(`/trip/${summary.trip.id}`)} onEdit={() => navigate(`/trip/${summary.trip.id}/edit`)} onDuplicate={() => duplicate(summary)} onDelete={() => remove(summary)} />)}</div></section>
        })}
      </div> : null}
    </div>
  )
}

export default TripsScreen
