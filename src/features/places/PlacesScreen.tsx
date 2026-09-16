import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { placeService, type PlaceLifecycleStatus } from '../../data/services/placeService'
import type { PlaceCategory } from '../../data/types/entities'

const categoryLabels: Record<PlaceCategory, string> = {
  attraction: 'Attraction',
  food: 'Food',
  cafe: 'Café',
  nightlife: 'Nightlife',
  shopping: 'Shopping',
  nature: 'Nature',
  accommodation: 'Accommodation',
  transport: 'Transport',
  event: 'Event',
  activity: 'Activity',
  custom: 'Custom',
}

const statusLabels: Record<PlaceLifecycleStatus, string> = {
  saved: 'Saved',
  scheduled: 'Scheduled',
  visited: 'Visited',
}

const formatDuration = (minutes: number | null) => {
  if (!minutes) return 'No duration set'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function PlacesScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const places = useLiveQuery(() => placeService.listTripPlaces(tripId), [tripId])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | PlaceLifecycleStatus>('all')
  const [category, setCategory] = useState<'all' | PlaceCategory>('all')
  const [error, setError] = useState('')

  const visible = useMemo(() => {
    if (!places) return []
    const query = search.trim().toLowerCase()
    return places.filter((item) => {
      const haystack = [item.place.name, item.place.city, item.place.area, item.place.address, item.place.notes, item.tripPlace.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (!query || haystack.includes(query))
        && (status === 'all' || item.status === status)
        && (category === 'all' || item.place.category === category)
    })
  }, [places, search, status, category])

  const counts = useMemo(() => ({
    all: places?.length ?? 0,
    saved: places?.filter((item) => item.status === 'saved').length ?? 0,
    scheduled: places?.filter((item) => item.status === 'scheduled').length ?? 0,
    visited: places?.filter((item) => item.status === 'visited').length ?? 0,
  }), [places])

  const remove = async (tripPlaceId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this trip's Places library?`)) return
    setError('')
    try {
      await placeService.removeTripPlace(tripId, tripPlaceId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this place.')
    }
  }

  if (places === undefined) return <div className="page-stack"><div className="loading-card">Opening Places…</div></div>

  return (
    <div className="page-stack places-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>← More</button></div>
      <PageIntro
        eyebrow="Trip library"
        title="Places"
        description="Save ideas before deciding where they fit. Scheduling a saved place links it to the itinerary without duplicating the place record."
        action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/places/new`)}>+ New place</button>}
      />

      <section className="places-summary" aria-label="Place status summary">
        {(['all', 'saved', 'scheduled', 'visited'] as const).map((key) => (
          <button key={key} className={`places-summary__item${status === key || (key === 'all' && status === 'all') ? ' is-active' : ''}`} type="button" onClick={() => setStatus(key === 'all' ? 'all' : key)}>
            <span>{key === 'all' ? 'All places' : statusLabels[key]}</span>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </section>

      <section className="places-controls">
        <label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, city, area, address…" /></label>
        <label className="field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as 'all' | PlaceCategory)}><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </section>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {places.length === 0 ? (
        <section className="places-empty">
          <span className="eyebrow">Idea inbox</span>
          <h2>No saved places yet</h2>
          <p>Start with places you might want to visit. You can decide the exact day and time later.</p>
          <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/places/new`)}>Save your first place</button>
        </section>
      ) : visible.length === 0 ? (
        <section className="places-empty"><h2>No places match these filters</h2><p>Change the search, category, or lifecycle filter to see more of your trip library.</p><button className="button button--secondary" type="button" onClick={() => { setSearch(''); setCategory('all'); setStatus('all') }}>Clear filters</button></section>
      ) : (
        <section className="place-grid" aria-label="Saved places">
          {visible.map((item) => (
            <article className="place-card" key={item.tripPlace.id}>
              <div className="place-card__topline">
                <div className="place-card__badges">
                  <span className={`place-status place-status--${item.status}`}>{statusLabels[item.status]}</span>
                  <span className="place-category">{categoryLabels[item.place.category]}</span>
                  <span className={`priority-pill priority-pill--${item.tripPlace.priority}`}>{item.tripPlace.priority === 'must_do' ? 'Must do' : item.tripPlace.priority === 'preferred' ? 'Preferred' : 'Optional'}</span>
                </div>
                <details className="activity-menu">
                  <summary aria-label={`More actions for ${item.place.name}`}>•••</summary>
                  <div className="activity-menu__popover">
                    <button type="button" onClick={() => navigate(`/trip/${tripId}/more/places/${item.tripPlace.id}/edit`)}>Edit</button>
                    <button type="button" onClick={() => remove(item.tripPlace.id, item.place.name)}>Remove</button>
                  </div>
                </details>
              </div>

              <h2>{item.place.name}</h2>
              <p className="place-card__location">{[item.place.area, item.place.city].filter(Boolean).join(' · ') || 'Location not added yet'}</p>

              <div className="place-card__meta">
                <div><span>Expected visit</span><strong>{formatDuration(item.tripPlace.estimated_visit_minutes)}</strong></div>
                <div><span>Itinerary uses</span><strong>{item.scheduledCount || '—'}</strong></div>
              </div>

              {item.place.address ? <p className="place-card__detail"><strong>Address</strong>{item.place.address}</p> : null}
              {item.tripPlace.notes || item.place.notes ? <p className="place-card__notes">{item.tripPlace.notes ?? item.place.notes}</p> : null}

              <div className="place-card__actions">
                <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/places/${item.tripPlace.id}/schedule`)}>Schedule</button>
                <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/places/${item.tripPlace.id}/edit`)}>Edit</button>
                {item.place.website ? <a className="button button--secondary" href={item.place.website} target="_blank" rel="noreferrer">Website</a> : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

export default PlacesScreen
