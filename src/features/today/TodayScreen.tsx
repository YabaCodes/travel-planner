import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { itineraryService } from '../../data/services/itineraryService'
import { transportService } from '../../data/services/transportService'
import { bookingService } from '../../data/services/bookingService'
import { placeService } from '../../data/services/placeService'
import type { Activity, Booking, Place, TransportSegment, TripDay } from '../../data/types/entities'
import './today.css'

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const ymdFromDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDayDate = (value: string | null) => {
  if (!value) return 'Flexible date'
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`))
}

const formatClock = (value: Date) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(value)

const formatDuration = (minutes: number | null) => {
  if (!minutes) return 'Flexible'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

const subtractMinutes = (time: string | null, minutes: number | null) => {
  if (!time || !minutes) return null
  const [hours, mins] = time.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
  const total = (hours * 60 + mins - minutes + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const chooseDefaultDayId = (days: TripDay[], today: string) => {
  if (!days.length) return ''
  const exact = days.find((day) => day.date === today)
  if (exact) return exact.id
  const future = days.filter((day) => day.date && day.date > today).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  if (future[0]) return future[0].id
  const dated = days.filter((day) => day.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  return dated.at(-1)?.id ?? days[0].id
}

const directionsUrl = (place: Place | null) => {
  if (!place) return null
  const destination = place.latitude !== null && place.longitude !== null
    ? `${place.latitude},${place.longitude}`
    : place.address || [place.name, place.area, place.city].filter(Boolean).join(', ')
  if (!destination) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Today Mode could not load trip data.'

const bookingSummary = (bookings: Booking[], activity: Activity) => {
  const activeBookings = bookings.filter((booking) => booking.status !== 'cancelled')
  const booked = activeBookings.filter((booking) => booking.status === 'booked')
  if (booked.length) return `${booked.length} booked`
  if (activeBookings.some((booking) => booking.status === 'to_book')) return 'To book'
  if (activity.booking_requirement === 'required') return 'Required'
  if (activity.booking_requirement === 'recommended') return 'Recommended'
  return 'None'
}

function TodayScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now, setNow] = useState(() => new Date())
  const [busyActivityId, setBusyActivityId] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const overviewResult = useLiveQuery(async () => {
    try {
      return { value: await itineraryService.getOverview(tripId), error: '' }
    } catch (reason) {
      return { value: null, error: errorMessage(reason) }
    }
  }, [tripId])
  const overview = overviewResult?.value ?? null
  const browserToday = ymdFromDate(now)
  const requestedDayId = searchParams.get('day') ?? ''
  const selectedDayId = useMemo(() => {
    if (!overview) return ''
    if (requestedDayId && overview.days.some((item) => item.day.id === requestedDayId)) return requestedDayId
    return chooseDefaultDayId(overview.days.map((item) => item.day), browserToday)
  }, [browserToday, overview, requestedDayId])

  const executionResult = useLiveQuery(async () => {
    if (!selectedDayId) return { value: null, error: '' }
    try {
      const [dayData, transportData, bookingMap, tripPlaces] = await Promise.all([
        itineraryService.getDay(tripId, selectedDayId),
        transportService.getDaySegments(tripId, selectedDayId),
        bookingService.getActivityBookingMap(tripId),
        placeService.listTripPlaces(tripId),
      ])
      if (!dayData) return { value: null, error: '' }
      return { value: { dayData, transportData, bookingMap, tripPlaces }, error: '' }
    } catch (reason) {
      return { value: null, error: errorMessage(reason) }
    }
  }, [tripId, selectedDayId])
  const execution = executionResult?.value ?? null

  if (overviewResult === undefined || (selectedDayId && executionResult === undefined)) {
    return <div className="page-stack"><div className="loading-card">Opening Today Mode…</div></div>
  }

  const loadError = overviewResult?.error || executionResult?.error
  if (loadError) {
    return <div className="page-stack"><PageIntro eyebrow="Travel mode" title="Today couldn't open" description={`${loadError} Your trip data has not been changed.`} action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Open itinerary</button>} /></div>
  }

  if (overview === null) {
    return <div className="page-stack"><PageIntro eyebrow="Travel mode" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>
  }

  if (!overview.days.length) {
    return <div className="page-stack today-page">
      <PageIntro eyebrow="Travel mode" title="Today" description="Today Mode needs at least one trip day before it can build a travel-day timeline." action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Open itinerary</button>} />
      <section className="today-empty"><span className="eyebrow">No trip days yet</span><h2>Set trip dates or create itinerary days first</h2><p>Once days exist, Today Mode will surface your next activity, transport, bookings, directions, and quick status actions.</p></section>
    </div>
  }

  if (!execution) {
    return <div className="page-stack"><PageIntro eyebrow="Travel mode" title="Day not found" description="Choose another trip day from the itinerary." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Open itinerary</button>} /></div>
  }

  const { dayData, transportData, bookingMap, tripPlaces } = execution
  const selectedDay = dayData.day
  const isLiveDay = selectedDay.date === browserToday
  const placeMap = new Map<string, Place>(tripPlaces.map((view) => [view.tripPlace.id, view.place] as [string, Place]))
  const segmentByPair = new Map(transportData.segments.map((view) => [`${view.segment.from_activity_id}->${view.segment.to_activity_id}`, view.segment]))
  const visibleActivities = dayData.activities.filter((activity) => activity.status !== 'cancelled')
  const nextActivity = visibleActivities.find((activity) => activity.status === 'in_progress')
    ?? visibleActivities.find((activity) => activity.status === 'planned')
    ?? null
  const nextPlace = nextActivity?.trip_place_id ? placeMap.get(nextActivity.trip_place_id) ?? null : null
  const nextBookings = nextActivity ? bookingMap[nextActivity.id] ?? [] : []
  const inboundSegment = nextActivity
    ? transportData.segments.find((view) => view.segment.to_activity_id === nextActivity.id)?.segment ?? null
    : null
  const leaveBy = inboundSegment?.departure_time ?? subtractMinutes(nextActivity?.start_time ?? null, inboundSegment?.duration_minutes ?? null)
  const nextDirections = directionsUrl(nextPlace)

  const selectDay = (dayId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('day', dayId)
    setSearchParams(next, { replace: true })
  }

  const setStatus = async (activityId: string, status: 'planned' | 'in_progress' | 'completed' | 'skipped') => {
    setBusyActivityId(activityId)
    setActionError('')
    try {
      await itineraryService.setActivityStatus(activityId, status)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Could not update this activity.')
    } finally {
      setBusyActivityId('')
    }
  }

  const openBooking = (activity: Activity) => {
    const bookings = bookingMap[activity.id] ?? []
    if (bookings.some((booking) => booking.status !== 'cancelled')) {
      navigate(`/trip/${tripId}/more/bookings?activityId=${activity.id}`)
    } else {
      navigate(`/trip/${tripId}/more/bookings/new?activityId=${activity.id}`)
    }
  }

  return (
    <div className="page-stack today-page">
      <PageIntro
        eyebrow={isLiveDay ? `Live today · ${formatClock(now)}` : 'Travel-day preview'}
        title="Today"
        description={isLiveDay
          ? `${formatDayDate(selectedDay.date)} · ${dayData.destination?.city ?? 'Trip day'} · execution view`
          : `${formatDayDate(selectedDay.date)} · Previewing Day ${selectedDay.day_number}${dayData.destination ? ` in ${dayData.destination.city}` : ''}`}
        action={<button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${selectedDay.id}`)}>Planner view</button>}
      />

      <section className="today-day-picker" aria-label="Choose trip day">
        {overview.days.map(({ day, destination }) => <button key={day.id} type="button" className={`today-day-chip${day.id === selectedDay.id ? ' is-active' : ''}`} onClick={() => selectDay(day.id)}><span>Day {day.day_number}</span><strong>{formatDayDate(day.date)}</strong><small>{destination?.city ?? day.title ?? 'Trip day'}</small></button>)}
      </section>

      {actionError ? <div className="today-error" role="alert">{actionError}</div> : null}

      {nextActivity ? (
        <section className="today-next-card">
          <div className="today-next-card__header"><div><span className="eyebrow">{nextActivity.status === 'in_progress' ? 'In progress' : 'Up next'}</span><h2>{nextActivity.title}</h2><p>{nextPlace?.name ?? titleCase(nextActivity.type)}</p></div><div className="today-next-time"><span>{nextActivity.start_time ?? 'Flexible'}</span><small>{formatDuration(nextActivity.duration_minutes)}</small></div></div>

          <div className="today-next-metrics">
            <div><span>Priority</span><strong>{titleCase(nextActivity.priority)}</strong></div>
            <div><span>Booking</span><strong>{bookingSummary(nextBookings, nextActivity)}</strong></div>
            <div><span>Leave by</span><strong>{leaveBy ?? 'Not set'}</strong></div>
          </div>

          {inboundSegment ? <div className="today-transport-callout"><div><span className="eyebrow">Getting there</span><strong>{titleCase(inboundSegment.mode)}{inboundSegment.duration_minutes ? ` · ${formatDuration(inboundSegment.duration_minutes)}` : ''}</strong></div><p>{inboundSegment.route_notes || (inboundSegment.departure_time ? `Departure ${inboundSegment.departure_time}` : 'Manual transport plan')}</p></div> : null}
          {nextActivity.notes ? <p className="today-next-notes">{nextActivity.notes}</p> : null}

          <div className="today-next-actions">
            {nextDirections ? <a className="button button--secondary" href={nextDirections} target="_blank" rel="noreferrer">Directions</a> : null}
            {(nextBookings.length > 0 || nextActivity.booking_requirement !== 'none') ? <button className="button button--secondary" type="button" onClick={() => openBooking(nextActivity)}>{nextBookings.some((booking) => booking.status !== 'cancelled') ? 'Booking' : 'Track booking'}</button> : null}
            <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${selectedDay.id}/activity/${nextActivity.id}/edit`)}>Details</button>
            {nextActivity.status === 'planned' ? <button className="button button--secondary" type="button" disabled={busyActivityId === nextActivity.id} onClick={() => setStatus(nextActivity.id, 'in_progress')}>Start</button> : null}
            <button className="button button--primary" type="button" disabled={busyActivityId === nextActivity.id} onClick={() => setStatus(nextActivity.id, 'completed')}>Complete</button>
            <button className="text-button today-skip" type="button" disabled={busyActivityId === nextActivity.id} onClick={() => setStatus(nextActivity.id, 'skipped')}>Skip</button>
          </div>
        </section>
      ) : (
        <section className="today-complete-card"><span className="eyebrow">Day status</span><h2>{visibleActivities.length ? 'Everything is handled' : 'Nothing scheduled yet'}</h2><p>{visibleActivities.length ? 'All non-cancelled activities are completed or skipped. You can restore any item from the timeline below.' : 'Add activities in Planner Mode, then return here for the streamlined travel-day view.'}</p><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${selectedDay.id}`)}>Open day planner</button></section>
      )}

      <section className="today-timeline-section">
        <div className="today-section-heading"><div><span className="eyebrow">Day timeline</span><h2>{selectedDay.title || `Day ${selectedDay.day_number}`}</h2></div><span>{dayData.activities.length} activit{dayData.activities.length === 1 ? 'y' : 'ies'}</span></div>

        {!dayData.activities.length ? <div className="today-empty today-empty--compact"><p>No activities are scheduled for this day yet.</p></div> : <div className="today-timeline">
          {dayData.activities.map((activity, index) => {
            const place = activity.trip_place_id ? placeMap.get(activity.trip_place_id) ?? null : null
            const bookings = bookingMap[activity.id] ?? []
            const next = dayData.activities[index + 1]
            const segment: TransportSegment | null = next ? segmentByPair.get(`${activity.id}->${next.id}`) ?? null : null
            const packedStatus = activity.status === 'completed' || activity.status === 'skipped' || activity.status === 'cancelled'
            return <div className="today-timeline-block" key={activity.id}>
              <article className={`today-activity-card today-activity-card--${activity.status}${activity.id === nextActivity?.id ? ' is-next' : ''}`}>
                <div className="today-activity-time"><strong>{activity.start_time ?? '—'}</strong><span>{formatDuration(activity.duration_minutes)}</span></div>
                <div className="today-activity-main"><div className="today-activity-title"><h3>{activity.title}</h3><span className={`today-status today-status--${activity.status}`}>{titleCase(activity.status)}</span></div><p>{place?.name ?? titleCase(activity.type)}</p><div className="today-activity-meta"><span>{titleCase(activity.priority)}</span>{activity.booking_requirement !== 'none' || bookings.length ? <span>Booking: {bookingSummary(bookings, activity)}</span> : null}</div></div>
                <div className="today-activity-actions">
                  {packedStatus ? <button className="text-button" type="button" disabled={busyActivityId === activity.id} onClick={() => setStatus(activity.id, 'planned')}>Restore</button> : <>{activity.status === 'planned' ? <button className="text-button" type="button" disabled={busyActivityId === activity.id} onClick={() => setStatus(activity.id, 'in_progress')}>Start</button> : null}<button className="text-button" type="button" disabled={busyActivityId === activity.id} onClick={() => setStatus(activity.id, 'completed')}>Complete</button><button className="text-button" type="button" disabled={busyActivityId === activity.id} onClick={() => setStatus(activity.id, 'skipped')}>Skip</button></>}
                  {(bookings.length > 0 || activity.booking_requirement !== 'none') ? <button className="text-button" type="button" onClick={() => openBooking(activity)}>Booking</button> : null}
                  <button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${selectedDay.id}/activity/${activity.id}/edit`)}>Details</button>
                </div>
              </article>
              {segment ? <div className="today-transport-row"><span className="today-transport-rail" aria-hidden="true" /><div><strong>{titleCase(segment.mode)}</strong><span>{segment.departure_time ? `Leave ${segment.departure_time}` : 'Departure flexible'}{segment.duration_minutes ? ` · ${formatDuration(segment.duration_minutes)}` : ''}</span>{segment.route_notes ? <small>{segment.route_notes}</small> : null}</div></div> : null}
            </div>
          })}
        </div>}
      </section>
    </div>
  )
}

export default TodayScreen
