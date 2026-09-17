import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripInfoService } from '../../data/services/tripInfoService'
import './trip-info.css'

function TripInfoSectionEditorScreen() {
  const { tripId = '', sectionId } = useParams()
  const navigate = useNavigate()
  const data = useLiveQuery(() => tripInfoService.getSectionEditorData(tripId, sectionId), [tripId, sectionId])
  const [title, setTitle] = useState('')
  const [initializedKey, setInitializedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data) return
    const key = sectionId ? `${sectionId}:${data.section?.revision ?? 'missing'}` : `new:${tripId}`
    if (initializedKey === key) return
    setTitle(data.section?.title ?? '')
    setInitializedKey(key)
  }, [data, initializedKey, sectionId, tripId])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening section editor…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>
  if (sectionId && !data.section) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Section not found" description="This section may have been deleted." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}>Back to Trip Info</button>} /></div>

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      if (sectionId) await tripInfoService.updateSection(tripId, sectionId, { title })
      else await tripInfoService.createSection(tripId, { title })
      navigate(`/trip/${tripId}/more/trip-info`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this section.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack trip-info-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}>← Trip Info</button></div>
      <PageIntro eyebrow={`Trip Info · ${data.trip.title}`} title={sectionId ? 'Edit section' : 'Add section'} description="Sections are flexible containers. Name them according to what this particular trip needs." />
      <section className="trip-info-editor-card">
        <div className="form-stack">
          <label className="field"><span>Section title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Emergency contacts, Documents, Connectivity…" /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : sectionId ? 'Save changes' : 'Add section'}</button></div>
        </div>
      </section>
    </div>
  )
}

export default TripInfoSectionEditorScreen
