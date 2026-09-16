import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { bookingService, type BookingView } from '../../data/services/bookingService'
import type { BookingStatus, BookingType } from '../../data/types/entities'

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not set'
  const [date, time = ''] = value.split('T')
  return `${date} ${time.slice(0, 5)}`.trim()
}

const bookingTypes: Array<{ value: 'all' | BookingType; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'attraction', label: 'Attraction' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'event', label: 'Event' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
]

const statusOptions: Array<{ value: 'all' | BookingStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'to_book', label: 'To book' },
  { value: 'booked', label: 'Booked' },
  { value: 'cancelled', label: 'Cancelled' },
]

function BookingsScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const data = useLiveQuery(() => bookingService.getCenter(tripId), [tripId])
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | BookingType>('all')
  const [search, setSearch] = useState('')
  const activityFilter = searchParams.get('activityId')

  const filtered = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    return data.bookings.filter((view) => {
      const matchesStatus = statusFilter === 'all' || view.booking.status === statusFilter
      const matchesType = typeFilter === 'all' || view.booking.type === typeFilter
      const matchesActivity = !activityFilter || view.booking.activity_id === activityFilter
      const haystack = [view.booking.provider, view.booking.confirmation_number, view.linkLabel, view.booking.notes, view.booking.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return matchesStatus && matchesType && matchesActivity && (!term || haystack.includes(term))
    })
  }, [activityFilter, data, search, statusFilter, typeFilter])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening bookings…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Booking Center" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const remove = async (view: BookingView) => {
    const label = view.booking.provider || titleCase(view.booking.type)
    if (!window.confirm(`Delete booking “${label}”?`)) return
    await bookingService.softDeleteBooking(view.booking.id)
  }

  const clearActivityFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('activityId')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="page-stack bookings-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>← Trip tools</button></div>
      <PageIntro
        eyebrow={`Booking Center · ${data.trip.title}`}
        title="Bookings"
        description="Keep reservations, confirmation details, deadlines, and costs in one place. Booking requirements in the itinerary remain separate from the actual reservation record."
        action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings/new`)}><PlusIcon />Add booking</button>}
      />

      <section className="bookings-summary" aria-label="Booking summary">
        <button type="button" className={`bookings-summary__item${statusFilter === 'all' ? ' is-active' : ''}`} onClick={() => setStatusFilter('all')}><span>All</span><strong>{data.counts.all}</strong></button>
        <button type="button" className={`bookings-summary__item${statusFilter === 'to_book' ? ' is-active' : ''}`} onClick={() => setStatusFilter('to_book')}><span>To book</span><strong>{data.counts.toBook}</strong></button>
        <button type="button" className={`bookings-summary__item${statusFilter === 'booked' ? ' is-active' : ''}`} onClick={() => setStatusFilter('booked')}><span>Booked</span><strong>{data.counts.booked}</strong></button>
        <div className="bookings-summary__item"><span>With deadlines</span><strong>{data.counts.withDeadlines}</strong></div>
      </section>

      {activityFilter ? <div className="booking-filter-banner"><span>Showing bookings linked to one itinerary activity.</span><button className="text-button" type="button" onClick={clearActivityFilter}>Show all bookings</button></div> : null}

      <section className="bookings-controls">
        <label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Provider, confirmation, activity…" /></label>
        <label className="field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | BookingStatus)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | BookingType)}>{bookingTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </section>

      {!filtered.length ? (
        <section className="bookings-empty"><span className="eyebrow">No matching bookings</span><h2>{data.counts.all ? 'Nothing matches these filters' : 'Start with your first reservation'}</h2><p>{data.counts.all ? 'Change the filters or search term to see other booking records.' : 'Track flights, hotels, attractions, restaurants, events, transport, and other reservations.'}</p>{!data.counts.all ? <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings/new`)}><PlusIcon />Add booking</button> : null}</section>
      ) : (
        <section className="booking-grid" aria-label="Booking records">
          {filtered.map((view) => {
            const booking = view.booking
            const costLabel = booking.cost !== null ? `${booking.currency ?? ''} ${booking.cost.toLocaleString()}`.trim() : 'Not set'
            return <article className="booking-card" key={booking.id}>
              <div className="booking-card__topline"><div className="booking-card__badges"><span className={`booking-status booking-status--${booking.status}`}>{titleCase(booking.status)}</span><span className="booking-type">{titleCase(booking.type)}</span></div><div className="inline-actions"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings/${booking.id}/edit`)}>Edit</button><button className="text-button danger-text" type="button" onClick={() => remove(view)}>Delete</button></div></div>
              <h2>{booking.provider || titleCase(booking.type)}</h2>
              <p className="booking-card__link">{view.linkLabel}</p>
              <div className="booking-card__meta">
                <div><span>Date / time</span><strong>{formatDateTime(booking.date_time)}</strong></div>
                <div><span>Cost</span><strong>{costLabel}</strong></div>
                <div><span>Confirmation</span><strong>{booking.confirmation_number || 'Not set'}</strong></div>
                <div><span>Booking opens</span><strong>{formatDateTime(booking.booking_opens_at)}</strong></div>
              </div>
              {booking.cancellation_deadline ? <p className="booking-deadline"><strong>Cancellation deadline</strong>{formatDateTime(booking.cancellation_deadline)}</p> : null}
              {booking.notes ? <p className="booking-card__notes">{booking.notes}</p> : null}
              <div className="booking-card__actions">
                {booking.status === 'to_book' ? <button className="button button--secondary" type="button" onClick={() => bookingService.setStatus(booking.id, 'booked')}>Mark booked</button> : null}
                {booking.status === 'booked' ? <button className="button button--secondary" type="button" onClick={() => bookingService.setStatus(booking.id, 'to_book')}>Back to To book</button> : null}
                {booking.url ? <a className="button button--secondary" href={booking.url} target="_blank" rel="noreferrer">Open booking link</a> : null}
              </div>
            </article>
          })}
        </section>
      )}
    </div>
  )
}

export default BookingsScreen
