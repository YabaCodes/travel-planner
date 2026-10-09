import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { itineraryService, type DestinationRange } from '../../data/services/itineraryService'
import { formatShortDate } from '../../data/utils/tripDate'
import './itinerary-tools.css'

// Assign each city to a stretch of dates in one go, instead of day by day.
function CityRangesScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const [overview, ranges] = await Promise.all([itineraryService.getOverview(tripId), itineraryService.getDestinationRanges(tripId)])
    return overview ? { overview, ranges } : null
  }, [tripId])
  const [ranges, setRanges] = useState<Record<string, { from: string; to: string }>>({})
  const [initialized, setInitialized] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!data || initialized) return
    setInitialized(true)
    const { overview } = data
    const first = overview.days[0]?.day.date ?? ''
    const last = overview.days.at(-1)?.day.date ?? ''
    const initial: Record<string, { from: string; to: string }> = {}
    overview.destinations.forEach((destination, index) => {
      const current = data.ranges.find((range) => range.destinationId === destination.id)
      // With nothing assigned yet, start the first city on the first day and end the last city on the last day.
      initial[destination.id] = current
        ? { from: current.from, to: current.to }
        : { from: index === 0 && !data.ranges.length ? first : '', to: index === overview.destinations.length - 1 && !data.ranges.length ? last : '' }
    })
    setRanges(initial)
  }, [data, initialized])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Loading cities…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Itinerary" title="Trip not found" description="Return to My Trips and choose another trip." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const { overview } = data
  const dates = overview.days.map((item) => item.day.date).filter((date): date is string => Boolean(date))
  const first = dates[0] ?? ''
  const last = dates.at(-1) ?? ''
  const cityFor = (date: string) => overview.destinations.filter((destination) => {
    const range = ranges[destination.id]
    return range?.from && range?.to && range.from <= date && date <= range.to
  })
  const covered = dates.filter((date) => cityFor(date).length === 1).length
  const overlaps = dates.filter((date) => cityFor(date).length > 1)
  const dayCount = (id: string) => dates.filter((date) => cityFor(date).length === 1 && cityFor(date)[0].id === id).length

  const setRange = (id: string, field: 'from' | 'to', value: string) => setRanges((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const list: DestinationRange[] = overview.destinations.map((destination) => ({ destinationId: destination.id, from: ranges[destination.id]?.from ?? '', to: ranges[destination.id]?.to ?? '' }))
      await itineraryService.assignDestinationRanges(tripId, list)
      navigate(`/trip/${tripId}/itinerary`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not assign the cities.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack city-ranges-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>← Itinerary</button></div>
      <PageIntro eyebrow={overview.trip.title} title="City dates" description="Give each city its dates. A day belongs to the city where you sleep that night." />
      {!dates.length ? <section className="form-panel"><p>Set the trip dates first.</p><button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/edit`)}>Edit trip dates</button></section> : (
        <section className="form-panel form-stack">
          {overview.destinations.map((destination) => (
            <div className="city-range" key={destination.id}>
              <div className="city-range__heading"><strong>{destination.city}</strong><span>{dayCount(destination.id) ? `${dayCount(destination.id)} day${dayCount(destination.id) === 1 ? '' : 's'}` : 'No days'}</span></div>
              <div className="field-grid field-grid--2">
                <label className="field"><span>First day</span><input type="date" min={first} max={last} value={ranges[destination.id]?.from ?? ''} onChange={(event) => setRange(destination.id, 'from', event.target.value)} /></label>
                <label className="field"><span>Last day</span><input type="date" min={ranges[destination.id]?.from || first} max={last} value={ranges[destination.id]?.to ?? ''} onChange={(event) => setRange(destination.id, 'to', event.target.value)} /></label>
              </div>
            </div>
          ))}
          <div className={`date-impact${overlaps.length ? ' date-impact--blocked' : ''}`} role="status">
            <strong>{overlaps.length ? 'Two cities share a day' : `${covered} of ${dates.length} days have a city`}</strong>
            <p>{overlaps.length
              ? `${overlaps.slice(0, 3).map((date) => formatShortDate(date)).join(', ')}${overlaps.length > 3 ? '…' : ''}: pick one city for ${overlaps.length === 1 ? 'that day' : 'those days'}.`
              : covered < dates.length ? 'Days outside every range keep the city they have now.' : 'Every day will have a city.'}</p>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy || overlaps.length > 0} onClick={save}>{busy ? 'Saving…' : 'Save city dates'}</button></div>
        </section>
      )}
    </div>
  )
}

export default CityRangesScreen
