import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripService } from '../../data/services/tripService'
import type { TripStatus } from '../../data/types/entities'

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

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const nextStart = datesUnknown ? null : startDate || null
      const nextEnd = datesUnknown ? null : endDate || null
      const impact = await tripService.getDateChangeImpact(tripId, nextStart, nextEnd)
      if (impact.affectedActivityCount > 0) {
        const confirmed = window.confirm(`This date change removes ${impact.removedDayCount} day(s) containing ${impact.affectedActivityCount} planned activit${impact.affectedActivityCount === 1 ? 'y' : 'ies'}. Those days will be preserved as deleted records. Continue?`)
        if (!confirmed) return
      }
      await tripService.updateTripBasics(tripId, { title, status, startDate: nextStart, endDate: nextEnd, notes: notes.trim() || null })
      navigate(`/trip/${tripId}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save trip changes.')
    } finally {
      setBusy(false)
    }
  }

  if (workspace === undefined) return <div className="page-stack"><div className="loading-card">Loading trip…</div></div>
  if (workspace === null) return <div className="page-stack"><PageIntro eyebrow="Trip settings" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  return (
    <div className="page-stack">
      <PageIntro eyebrow="Trip settings" title="Edit trip" description="Change the trip identity, dates, or lifecycle status. Date changes keep itinerary days aligned automatically." />
      <section className="form-panel form-stack">
        <label className="field"><span>Trip title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as TripStatus)}><option value="idea">Idea</option><option value="planning">Planning</option><option value="ready">Ready</option><option value="traveling">Traveling</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
        <label className="check-row"><input type="checkbox" checked={datesUnknown} onChange={(event) => setDatesUnknown(event.target.checked)} /><span><strong>Dates are not decided</strong><small>Existing dated trip days will be retired from the active itinerary.</small></span></label>
        {!datesUnknown ? <div className="field-grid field-grid--2"><label className="field"><span>Departure</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="field"><span>Return</span><input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div> : null}
        <label className="field"><span>Trip notes</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="wizard-actions"><button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}`)}>Cancel</button><button className="button button--primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </section>
    </div>
  )
}

export default TripEditScreen
