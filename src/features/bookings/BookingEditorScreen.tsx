import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { bookingService, type BookingLinkType } from '../../data/services/bookingService'
import type { BookingStatus, BookingType } from '../../data/types/entities'

const bookingTypeOptions: Array<{ value: BookingType; label: string }> = [
  { value: 'flight', label: 'Flight' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'attraction', label: 'Attraction' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'event', label: 'Event' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
]

function BookingEditorScreen() {
  const { tripId = '', bookingId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedActivityId = searchParams.get('activityId')
  const requestedTravelLegId = searchParams.get('travelLegId')
  const data = useLiveQuery(() => bookingService.getEditorData(tripId, bookingId), [tripId, bookingId])

  const [initializedFor, setInitializedFor] = useState('')
  const [type, setType] = useState<BookingType>('other')
  const [status, setStatus] = useState<BookingStatus>('to_book')
  const [provider, setProvider] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState('')
  const [bookingOpensAt, setBookingOpensAt] = useState('')
  const [cancellationDeadline, setCancellationDeadline] = useState('')
  const [url, setUrl] = useState('')
  const [linkType, setLinkType] = useState<BookingLinkType>('none')
  const [linkId, setLinkId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const requestedActivity = useMemo(() => data?.activities.find((item) => item.activity.id === requestedActivityId) ?? null, [data, requestedActivityId])
  const requestedTravelLeg = useMemo(() => data?.travelLegs.find((item) => item.travelLeg.id === requestedTravelLegId) ?? null, [data, requestedTravelLegId])

  useEffect(() => {
    if (!data) return
    const key = bookingId ? `${bookingId}:${data.booking?.revision ?? 'missing'}` : `new:${requestedActivityId ?? 'none'}:${requestedTravelLegId ?? 'none'}`
    if (initializedFor === key) return

    if (data.booking) {
      const booking = data.booking
      setType(booking.type)
      setStatus(booking.status)
      setProvider(booking.provider ?? '')
      setConfirmation(booking.confirmation_number ?? '')
      setDateTime(booking.date_time ?? '')
      setCost(booking.cost?.toString() ?? '')
      setCurrency(booking.currency ?? '')
      setBookingOpensAt(booking.booking_opens_at ?? '')
      setCancellationDeadline(booking.cancellation_deadline ?? '')
      setUrl(booking.url ?? '')
      if (booking.activity_id) { setLinkType('activity'); setLinkId(booking.activity_id) }
      else if (booking.stay_id) { setLinkType('stay'); setLinkId(booking.stay_id) }
      else if (booking.travel_leg_id) { setLinkType('travel_leg'); setLinkId(booking.travel_leg_id) }
      else { setLinkType('none'); setLinkId('') }
      setNotes(booking.notes ?? '')
    } else {
      setType('other')
      setStatus('to_book')
      setProvider('')
      setConfirmation('')
      setDateTime('')
      setCost('')
      setCurrency('')
      setBookingOpensAt('')
      setCancellationDeadline('')
      setUrl('')
      setNotes('')
      if (requestedActivity) {
        setLinkType('activity')
        setLinkId(requestedActivity.activity.id)
        const dayDate = requestedActivity.day?.date
        const startTime = requestedActivity.activity.start_time
        if (dayDate && startTime) setDateTime(`${dayDate}T${startTime}`)
      } else if (requestedTravelLeg) {
        setType(requestedTravelLeg.travelLeg.mode === 'flight' ? 'flight' : 'transport')
        setLinkType('travel_leg')
        setLinkId(requestedTravelLeg.travelLeg.id)
        if (requestedTravelLeg.travelLeg.departure_at) setDateTime(requestedTravelLeg.travelLeg.departure_at)
        if (requestedTravelLeg.travelLeg.operator) setProvider(requestedTravelLeg.travelLeg.operator)
      } else {
        setLinkType('none')
        setLinkId('')
      }
    }
    setInitializedFor(key)
  }, [bookingId, data, initializedFor, requestedActivity, requestedActivityId, requestedTravelLeg, requestedTravelLegId])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening booking editor…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Booking Center" title="Booking not found" description="This booking or trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}>Back to bookings</button>} /></div>

  const isEditing = Boolean(bookingId)
  const availableLinkTypes: Array<{ value: BookingLinkType; label: string }> = [
    { value: 'none', label: 'Not linked' },
    { value: 'activity', label: 'Itinerary activity' },
    ...(data.stays.length ? [{ value: 'stay' as BookingLinkType, label: 'Stay' }] : []),
    ...(data.travelLegs.length ? [{ value: 'travel_leg' as BookingLinkType, label: 'Travel leg' }] : []),
  ]

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      const draft = {
        type,
        status,
        provider: provider || null,
        confirmationNumber: confirmation || null,
        dateTime: dateTime || null,
        cost: cost.trim() ? Number(cost) : null,
        currency: currency || null,
        bookingOpensAt: bookingOpensAt || null,
        cancellationDeadline: cancellationDeadline || null,
        url: url || null,
        linkType,
        linkId: linkType === 'none' ? null : linkId || null,
        notes: notes || null,
      }
      if (bookingId) await bookingService.updateBooking(tripId, bookingId, draft)
      else await bookingService.createBooking(tripId, draft)
      navigate(`/trip/${tripId}/more/bookings`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this booking.')
    } finally {
      setBusy(false)
    }
  }

  const changeLinkType = (next: BookingLinkType) => {
    setLinkType(next)
    setLinkId('')
  }

  return (
    <div className="page-stack booking-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}>← Booking Center</button></div>
      <PageIntro eyebrow={isEditing ? 'Edit booking' : `Booking Center · ${data.trip.title}`} title={isEditing ? 'Update booking' : 'Add booking'} description="Store the reservation itself here. The itinerary can separately say that an activity requires a booking, which keeps planning intent distinct from confirmation status." />

      <section className="booking-editor-card">
        <div className="form-stack">
          <div className="field-grid field-grid--2">
            <label className="field"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as BookingType)}>{bookingTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as BookingStatus)}><option value="to_book">To book</option><option value="booked">Booked</option><option value="cancelled">Cancelled</option></select></label>
          </div>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Provider <small>optional</small></span><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Airline, hotel, restaurant, ticket platform…" /></label>
            <label className="field"><span>Confirmation number <small>optional</small></span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Reference / reservation code" /></label>
          </div>

          <label className="field"><span>Linked to</span><select value={linkType} onChange={(event) => changeLinkType(event.target.value as BookingLinkType)}>{availableLinkTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>

          {linkType === 'activity' ? <label className="field"><span>Itinerary activity</span><select value={linkId} onChange={(event) => setLinkId(event.target.value)}><option value="">Choose an activity…</option>{data.activities.map((item) => <option key={item.activity.id} value={item.activity.id}>{item.label}</option>)}</select></label> : null}
          {linkType === 'stay' ? <label className="field"><span>Stay</span><select value={linkId} onChange={(event) => setLinkId(event.target.value)}><option value="">Choose a stay…</option>{data.stays.map((item) => <option key={item.stay.id} value={item.stay.id}>{item.label}</option>)}</select></label> : null}
          {linkType === 'travel_leg' ? <label className="field"><span>Travel leg</span><select value={linkId} onChange={(event) => setLinkId(event.target.value)}><option value="">Choose a travel leg…</option>{data.travelLegs.map((item) => <option key={item.travelLeg.id} value={item.travelLeg.id}>{item.label}</option>)}</select></label> : null}

          <div className="field-grid field-grid--2">
            <label className="field"><span>Reservation date / time <small>optional</small></span><input type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} /></label>
            <label className="field"><span>Booking opens <small>optional</small></span><input type="datetime-local" value={bookingOpensAt} onChange={(event) => setBookingOpensAt(event.target.value)} /></label>
            <label className="field"><span>Cancellation deadline <small>optional</small></span><input type="datetime-local" value={cancellationDeadline} onChange={(event) => setCancellationDeadline(event.target.value)} /></label>
            <label className="field"><span>Booking URL <small>optional</small></span><input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label>
          </div>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Cost <small>optional</small></span><input type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0" /></label>
            <label className="field"><span>Currency <small>3 letters</small></span><input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="TWD" /></label>
          </div>

          <label className="field"><span>Notes <small>optional</small></span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Seat, cancellation terms, pickup details, what to remember…" /></label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : isEditing ? 'Save changes' : 'Add booking'}</button></div>
        </div>
      </section>
    </div>
  )
}

export default BookingEditorScreen
