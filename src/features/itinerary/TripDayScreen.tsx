import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { itineraryService } from '../../data/services/itineraryService'
import type { Activity, ActivityStatus } from '../../data/types/entities'
import { endTimeForActivity, findActivityOverlaps, formatClockTime, formatDuration } from '../../data/utils/activityTime'
import { formatShortDate } from '../../data/utils/tripDate'

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function TripDayScreen() {
  const { tripId = '', dayId = '' } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => itineraryService.getDay(tripId, dayId), [tripId, dayId])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [editingDay, setEditingDay] = useState(false)
  const [dayBusy, setDayBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    setTitle(data.day.title ?? '')
    setNotes(data.day.notes ?? '')
    setDestinationId(data.day.destination_id ?? '')
  }, [data?.day.id, data?.day.revision])

  const overlapIds = useMemo(() => {
    if (!data) return new Set<string>()
    return new Set(findActivityOverlaps(data.activities).flatMap((item) => [item.firstId, item.secondId]))
  }, [data])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening day planner…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Day planner" title="Day not found" description="This day may have been removed when the trip dates changed." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>Back to itinerary</button>} /></div>

  const saveDay = async () => {
    setDayBusy(true)
    try {
      await itineraryService.updateDayDetails(dayId, { title: title || null, notes: notes || null, destinationId: destinationId || null })
      setEditingDay(false)
    } finally {
      setDayBusy(false)
    }
  }

  const duplicate = async (activity: Activity) => {
    await itineraryService.duplicateActivity(activity.id)
  }

  const remove = async (activity: Activity) => {
    if (!window.confirm(`Delete “${activity.title}”?`)) return
    await itineraryService.softDeleteActivity(activity.id)
  }

  const setStatus = async (activity: Activity, status: ActivityStatus) => {
    await itineraryService.setActivityStatus(activity.id, status)
  }

  const moveDay = async (activity: Activity, targetDayId: string) => {
    await itineraryService.moveActivityToDay(activity.id, targetDayId)
  }

  const dayDescription = `${formatShortDate(data.day.date)}${data.destination ? ` · ${data.destination.city}, ${data.destination.country}` : ''}`

  return (
    <div className="page-stack day-planner-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>← All trip days</button></div>
      <PageIntro
        eyebrow={`Day ${data.day.day_number} · ${data.trip.title}`}
        title={data.day.title || data.destination?.city || 'Plan this day'}
        description={dayDescription}
        action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}/activity/new`)}><PlusIcon />Add activity</button>}
      />

      <section className="day-control-strip">
        <div><span>Load</span><strong>{data.load.label}</strong><small>{data.load.target ? `${data.load.count} of ${data.load.target} major activities` : `${data.load.count} major activities`}</small></div>
        <div><span>Timeline</span><strong>{data.activities.length}</strong><small>{data.activities.filter((activity) => activity.start_time).length} timed</small></div>
        <div><span>Conflicts</span><strong>{data.overlapCount}</strong><small>{data.overlapCount ? 'Review overlapping times' : 'No overlaps detected'}</small></div>
      </section>

      <section className="day-details-card">
        <div className="day-details-card__heading"><div><span className="eyebrow">Day details</span><h2>Context for this day</h2></div><button className="text-button" type="button" onClick={() => setEditingDay((current) => !current)}>{editingDay ? 'Close' : 'Edit'}</button></div>
        {editingDay ? <div className="form-stack compact-form">
          <label className="field"><span>Day title <small>optional</small></span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Old town & evening views" /></label>
          <label className="field"><span>Destination</span><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Not assigned</option>{data.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.city}, {destination.country}</option>)}</select></label>
          <label className="field"><span>Notes <small>optional</small></span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Meeting point, neighborhood focus, day-level reminders…" /></label>
          <div className="inline-actions"><button className="button button--primary" type="button" disabled={dayBusy} onClick={saveDay}>{dayBusy ? 'Saving…' : 'Save day'}</button></div>
        </div> : <div className="day-details-summary"><div><span>Destination</span><strong>{data.destination ? `${data.destination.city}, ${data.destination.country}` : 'Not assigned'}</strong></div><div><span>Notes</span><strong>{data.day.notes || 'No day notes'}</strong></div></div>}
      </section>

      {data.overlapCount ? <div className="conflict-banner" role="status"><strong>Timing conflict detected.</strong><span> Activities marked below overlap based on their start time and duration. This is a warning only—you can keep the plan as-is.</span></div> : null}

      {!data.activities.length ? (
        <section className="timeline-empty">
          <div className="timeline-empty__line" />
          <div><h2>This day is open</h2><p>Add a timed activity, flexible stop, meal, transfer, booking, or a Free Time block.</p><button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}/activity/new`)}><PlusIcon />Add first activity</button></div>
        </section>
      ) : (
        <section className="activity-timeline" aria-label="Day activities">
          {data.activities.map((activity, index) => {
            const end = endTimeForActivity(activity)
            const hasOverlap = overlapIds.has(activity.id)
            return <article className={`activity-card${hasOverlap ? ' has-conflict' : ''}${activity.status === 'completed' ? ' is-complete' : ''}`} key={activity.id}>
              <div className="activity-card__rail"><span className="activity-card__dot" /><span className="activity-card__line" /></div>
              <div className="activity-card__time"><strong>{formatClockTime(activity.start_time)}</strong>{end ? <small>to {end.replace('+1', ' +1d')}</small> : <small>{formatDuration(activity.duration_minutes)}</small>}</div>
              <div className="activity-card__body">
                <div className="activity-card__topline"><div className="activity-badges"><span className="activity-type">{titleCase(activity.type)}</span><span className={`priority-pill priority-pill--${activity.priority}`}>{titleCase(activity.priority)}</span>{activity.time_locked ? <span className="lock-pill">Locked</span> : null}{hasOverlap ? <span className="conflict-pill">Overlap</span> : null}</div><details className="activity-menu"><summary aria-label={`Actions for ${activity.title}`}>•••</summary><div className="activity-menu__popover"><button type="button" onClick={() => navigate(`/trip/${tripId}/itinerary/day/${dayId}/activity/${activity.id}/edit`)}>Edit</button><button type="button" onClick={() => duplicate(activity)}>Duplicate</button><button type="button" disabled={index === 0} onClick={() => itineraryService.moveActivityByOffset(activity.id, -1)}>Move up</button><button type="button" disabled={index === data.activities.length - 1} onClick={() => itineraryService.moveActivityByOffset(activity.id, 1)}>Move down</button><button className="danger-text" type="button" onClick={() => remove(activity)}>Delete</button></div></details></div>
                <h2>{activity.title}</h2>
                <p>{activity.notes || formatDuration(activity.duration_minutes)}</p>
                <div className="activity-card__controls">
                  <label><span>Status</span><select value={activity.status} onChange={(event) => setStatus(activity, event.target.value as ActivityStatus)}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option><option value="cancelled">Cancelled</option></select></label>
                  <label><span>Move to</span><select value={activity.trip_day_id} onChange={(event) => moveDay(activity, event.target.value)}>{data.allDays.map((day) => <option key={day.id} value={day.id}>Day {day.day_number} · {formatShortDate(day.date)}</option>)}</select></label>
                </div>
              </div>
            </article>
          })}
        </section>
      )}
    </div>
  )
}

export default TripDayScreen
