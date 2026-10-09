import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripService, type DateChangeMode, type DateChangePreview } from '../../data/services/tripService'
import type { TripStatus } from '../../data/types/entities'
import { daysBetween, formatShortDate } from '../../data/utils/tripDate'
import './trip-edit.css'

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

function TripEditScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const workspace = useLiveQuery(() => tripService.getWorkspace(tripId), [tripId])
  const [initialized, setInitialized] = useState(false)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TripStatus>('planning')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [datesUnknown, setDatesUnknown] = useState(false)
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<DateChangeMode>('keep')
  const [modeTouched, setModeTouched] = useState(false)
  const [preview, setPreview] = useState<DateChangePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace || initialized) return
    setInitialized(true)
    setTitle(workspace.trip.title)
    setStatus(workspace.trip.status)
    setStartDate(workspace.trip.start_date ?? '')
    setEndDate(workspace.trip.end_date ?? '')
    setDatesUnknown(!workspace.trip.start_date || !workspace.trip.end_date)
    setNotes(workspace.trip.notes ?? '')
  }, [workspace, initialized])

  const originalStart = workspace?.trip.start_date ?? null
  const originalEnd = workspace?.trip.end_date ?? null
  const nextStart = datesUnknown ? null : startDate || null
  const nextEnd = datesUnknown ? null : endDate || null
  const datesChanged = initialized && (nextStart !== originalStart || nextEnd !== originalEnd)
  const datesValid = datesUnknown || Boolean(startDate && endDate && endDate >= startDate)
  const startShift = originalStart && nextStart ? daysBetween(originalStart, nextStart) : 0
  const endShift = originalEnd && nextEnd ? daysBetween(originalEnd, nextEnd) : 0
  // Moving both dates by the same amount means the whole trip moved, so plans should move with it.
  const suggestedMode: DateChangeMode = startShift !== 0 && startShift === endShift ? 'shift' : 'keep'
  const activeMode = modeTouched ? mode : suggestedMode
  const offerChoice = startShift !== 0 && (workspace?.days.length ?? 0) > 0

  useEffect(() => {
    if (!initialized || !datesChanged || !datesValid) {
      setPreview(null)
      return
    }
    let cancelled = false
    tripService.previewDateChange(tripId, nextStart, nextEnd, activeMode)
      .then((result) => { if (!cancelled) setPreview(result) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [tripId, initialized, datesChanged, datesValid, nextStart, nextEnd, activeMode])

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await tripService.updateTripBasics(tripId, { title, status, startDate: nextStart, endDate: nextEnd, notes: notes.trim() || null, dateMode: activeMode })
      navigate(`/trip/${tripId}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save trip changes.')
    } finally {
      setBusy(false)
    }
  }

  if (workspace === undefined) return <div className="page-stack"><div className="loading-card">Loading trip…</div></div>
  if (workspace === null) return <div className="page-stack"><PageIntro eyebrow="Trip settings" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const shiftLabel = (days: number) => `${plural(Math.abs(days), 'day')} ${days > 0 ? 'later' : 'earlier'}`
  const moved = preview?.movedActivities ?? []

  return (
    <div className="page-stack">
      <PageIntro eyebrow="Trip settings" title="Edit trip" description="Change the title, dates or status. Before you save, you'll see exactly what a date change does to your plans." />
      <section className="form-panel form-stack">
        <label className="field"><span>Trip title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as TripStatus)}><option value="idea">Idea</option><option value="planning">Planning</option><option value="ready">Ready</option><option value="traveling">Traveling</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
        <label className="check-row"><input type="checkbox" checked={datesUnknown} onChange={(event) => setDatesUnknown(event.target.checked)} /><span><strong>Dates are not decided</strong><small>Removes the trip days. Only possible when no activities are planned on them.</small></span></label>
        {!datesUnknown ? <div className="field-grid field-grid--2"><label className="field"><span>Departure</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="field"><span>Return</span><input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div> : null}

        {datesChanged && datesValid && offerChoice ? (
          <fieldset className="date-mode">
            <legend>What should happen to your plans?</legend>
            <label className={`date-mode__option${activeMode === 'shift' ? ' is-selected' : ''}`}>
              <input type="radio" name="date-mode" checked={activeMode === 'shift'} onChange={() => { setMode('shift'); setModeTouched(true) }} />
              <span><strong>Move them with the trip</strong><small>Every day and its plans move {shiftLabel(startShift)}, e.g. {formatShortDate(originalStart)} becomes {formatShortDate(nextStart)}.</small></span>
            </label>
            <label className={`date-mode__option${activeMode === 'keep' ? ' is-selected' : ''}`}>
              <input type="radio" name="date-mode" checked={activeMode === 'keep'} onChange={() => { setMode('keep'); setModeTouched(true) }} />
              <span><strong>Keep them on their dates</strong><small>Plans stay on the same calendar dates; the trip just starts {startShift < 0 ? 'earlier' : 'later'}.</small></span>
            </label>
          </fieldset>
        ) : null}

        {preview && (preview.addedDays || preview.removedDays || moved.length || preview.blockedReason) ? (
          <div className={`date-impact${preview.blockedReason ? ' date-impact--blocked' : ''}`} role="status">
            <strong>{preview.blockedReason ? 'Dates can’t be cleared yet' : 'When you save'}</strong>
            {preview.blockedReason ? <p>{preview.blockedReason}</p> : (
              <ul>
                {preview.addedDays ? <li>{plural(preview.addedDays, 'new empty day')} will be added.</li> : null}
                {preview.removedDays && !moved.length ? <li>{plural(preview.removedDays, 'empty day')} will be removed.</li> : null}
                {moved.length ? <li>{plural(moved.length, 'activity', 'activities')} on {preview.removedDays === 1 ? 'a day' : 'days'} outside the new dates will move, so nothing is lost:
                  <ul className="date-impact__moves">{moved.slice(0, 6).map((item, index) => <li key={index}>{item.title}: {formatShortDate(item.from)} → {formatShortDate(item.to)}</li>)}{moved.length > 6 ? <li>and {moved.length - 6} more</li> : null}</ul>
                </li> : null}
                {preview.removedTransport ? <li>{plural(preview.removedTransport, 'travel time')} between moved activities will be removed.</li> : null}
                {preview.removedDayNotes ? <li>Titles or notes on {plural(preview.removedDayNotes, 'removed day')} will be removed.</li> : null}
              </ul>
            )}
          </div>
        ) : null}

        <label className="field"><span>Trip notes</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="wizard-actions"><button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}`)}>Cancel</button><button className="button button--primary" disabled={busy || Boolean(preview?.blockedReason)} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </section>
      <button className="text-button edit-brief-link" type="button" onClick={() => navigate(`/trip/${tripId}/brief`)}>Edit cities, travelers and travel style →</button>
    </div>
  )
}

export default TripEditScreen
