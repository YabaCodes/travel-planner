import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { itineraryService } from '../../data/services/itineraryService'
import type { ActivityStatus, ActivityType, BookingRequirement, Priority } from '../../data/types/entities'
import { formatShortDate } from '../../data/utils/tripDate'

const typeOptions: Array<{ value: ActivityType; label: string; description: string }> = [
  { value: 'custom', label: 'Custom', description: 'Attraction, experience, appointment, or anything else.' },
  { value: 'free_time', label: 'Free Time', description: 'Protect breathing room without deciding what to do yet.' },
  { value: 'meal', label: 'Meal', description: 'Breakfast, lunch, dinner, café, or food stop.' },
  { value: 'transportation', label: 'Transfer', description: 'A travel block between places. Detailed routes arrive later.' },
  { value: 'booking', label: 'Booking', description: 'A scheduled reservation or ticketed activity.' },
]

const defaultTitle: Partial<Record<ActivityType, string>> = {
  free_time: 'Free time',
  meal: 'Meal',
  transportation: 'Transfer',
  booking: 'Reservation',
}

function ActivityEditorScreen() {
  const { tripId = '', dayId = '', activityId } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const day = await itineraryService.getDay(tripId, dayId)
    const activity = activityId ? await itineraryService.getActivity(tripId, activityId) : null
    return { day, activity }
  }, [tripId, dayId, activityId])

  const [initializedFor, setInitializedFor] = useState('')
  const [tripDayId, setTripDayId] = useState(dayId)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ActivityType>('custom')
  const [priority, setPriority] = useState<Priority>('preferred')
  const [bookingRequirement, setBookingRequirement] = useState<BookingRequirement>('none')
  const [status, setStatus] = useState<ActivityStatus>('planned')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [timeLocked, setTimeLocked] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data?.day) return
    const key = activityId ? `${activityId}:${data.activity?.revision ?? 'missing'}` : `new:${dayId}`
    if (initializedFor === key) return
    if (activityId && data.activity) {
      setTripDayId(data.activity.trip_day_id)
      setTitle(data.activity.title)
      setType(data.activity.type)
      setPriority(data.activity.priority)
      setBookingRequirement(data.activity.booking_requirement)
      setStatus(data.activity.status)
      setStartTime(data.activity.start_time ?? '')
      setDuration(data.activity.duration_minutes?.toString() ?? '')
      setTimeLocked(data.activity.time_locked)
      setNotes(data.activity.notes ?? '')
    } else {
      setTripDayId(dayId)
      setTitle('')
      setType('custom')
      setPriority('preferred')
      setBookingRequirement('none')
      setStatus('planned')
      setStartTime('')
      setDuration('60')
      setTimeLocked(false)
      setNotes('')
    }
    setInitializedFor(key)
  }, [activityId, data, dayId, initializedFor])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening activity editor…</div></div>
  if (!data.day || (activityId && !data.activity)) return <div className="page-stack"><PageIntro eyebrow="Activity" title="Activity not found" description="The activity or trip day may have been deleted." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Back to itinerary</button>} /></div>

  const chooseType = (nextType: ActivityType) => {
    setType(nextType)
    if (!activityId && (!title || Object.values(defaultTitle).includes(title))) setTitle(defaultTitle[nextType] ?? '')
    if (nextType === 'free_time') {
      setPriority('optional')
      setBookingRequirement('none')
    }
  }

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      const durationMinutes = duration.trim() ? Number(duration) : null
      const draft = {
        tripDayId,
        title,
        type,
        priority,
        bookingRequirement,
        status,
        startTime: startTime || null,
        durationMinutes,
        timeLocked,
        notes: notes || null,
      }
      if (activityId) await itineraryService.updateActivity(tripId, activityId, draft)
      else await itineraryService.createActivity(tripId, draft)
      navigate(`/trip/${tripId}/itinerary/day/${tripDayId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this activity.')
    } finally {
      setBusy(false)
    }
  }

  const isEditing = Boolean(activityId)

  return (
    <div className="page-stack activity-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}`)}>← Day {data.day.day.day_number}</button></div>
      <PageIntro eyebrow={isEditing ? 'Edit activity' : `Day ${data.day.day.day_number}`} title={isEditing ? 'Update activity' : 'Add activity'} description="Keep the structure useful but lightweight: title first, timing only when it matters, and lock fixed reservations so later replanning can respect them." />

      <section className="activity-editor-card">
        <div className="form-stack">
          <div className="section-heading"><span className="eyebrow">Activity type</span><h2>What are you adding?</h2><p>Saved Places will plug into this same activity model in Milestone 5.</p></div>
          <div className="activity-type-grid">
            {typeOptions.map((option) => <button key={option.value} className={`activity-type-option${type === option.value ? ' is-selected' : ''}`} type="button" onClick={() => chooseType(option.value)}><strong>{option.label}</strong><small>{option.description}</small></button>)}
            <button className="activity-type-option is-disabled" type="button" disabled><strong>Saved Place</strong><small>Connect a place from the trip library · Milestone 5</small></button>
            <button className="activity-type-option is-disabled" type="button" disabled><strong>Create New Place</strong><small>Add a place and schedule it together · Milestone 5</small></button>
          </div>

          <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What is happening?" autoFocus /></label>

          <div className="field-grid field-grid--2">
            <label className="field"><span>Day</span><select value={tripDayId} onChange={(event) => setTripDayId(event.target.value)}>{data.day.allDays.map((day) => <option key={day.id} value={day.id}>Day {day.day_number} · {formatShortDate(day.date)}{day.title ? ` · ${day.title}` : ''}</option>)}</select></label>
            <label className="field"><span>Start time <small>optional</small></span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <label className="field"><span>Duration <small>minutes, optional</small></span><input type="number" min="5" max="1440" step="5" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="60" /></label>
            <label className="field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="must_do">Must do</option><option value="preferred">Preferred</option><option value="optional">Optional</option></select></label>
          </div>

          {type !== 'free_time' ? <label className="field"><span>Booking requirement</span><select value={bookingRequirement} onChange={(event) => setBookingRequirement(event.target.value as BookingRequirement)}><option value="none">None</option><option value="recommended">Recommended</option><option value="required">Required</option></select></label> : null}

          {isEditing ? <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as ActivityStatus)}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option><option value="cancelled">Cancelled</option></select></label> : null}

          <label className="check-row"><input type="checkbox" checked={timeLocked} onChange={(event) => setTimeLocked(event.target.checked)} /><span><strong>Lock this time</strong><small>Use this for fixed reservations, tickets, appointments, and other times that future planning should not move automatically.</small></span></label>

          <label className="field"><span>Notes <small>optional</small></span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Meeting point, confirmation context, what to remember…" /></label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : isEditing ? 'Save changes' : 'Add activity'}</button></div>
        </div>
      </section>
    </div>
  )
}

export default ActivityEditorScreen
