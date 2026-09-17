import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripInfoService } from '../../data/services/tripInfoService'
import type { TripInfoValueType } from '../../data/types/entities'
import './trip-info.css'

const typeOptions: Array<{ value: TripInfoValueType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'note', label: 'Long note' },
  { value: 'url', label: 'Website / URL' },
  { value: 'phone', label: 'Phone number' },
  { value: 'address', label: 'Address' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'number', label: 'Number' },
]

function TripInfoItemEditorScreen() {
  const { tripId = '', itemId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useLiveQuery(() => tripInfoService.getItemEditorData(tripId, itemId), [tripId, itemId])
  const requestedSectionId = searchParams.get('sectionId')
  const [sectionId, setSectionId] = useState('')
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [type, setType] = useState<TripInfoValueType>('text')
  const [initializedKey, setInitializedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const requestedSection = useMemo(() => data?.sections.find((section) => section.id === requestedSectionId) ?? null, [data, requestedSectionId])

  useEffect(() => {
    if (!data) return
    const key = itemId ? `${itemId}:${data.item?.revision ?? 'missing'}` : `new:${requestedSectionId ?? 'none'}:${data.sections.length}`
    if (initializedKey === key) return
    if (data.item) {
      setSectionId(data.item.section_id)
      setLabel(data.item.label)
      setValue(data.item.value)
      setType(data.item.type)
    } else {
      setSectionId(requestedSection?.id ?? data.sections[0]?.id ?? '')
    }
    setInitializedKey(key)
  }, [data, initializedKey, itemId, requestedSection, requestedSectionId])

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening information editor…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>
  if (itemId && !data.item) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Information item not found" description="This item may have been deleted." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}>Back to Trip Info</button>} /></div>
  if (!data.sections.length) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Create a section first" description="Information items need a section to live in." action={<button className="button button--primary" onClick={() => navigate(`/trip/${tripId}/more/trip-info/section/new`)}>Add section</button>} /></div>

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const draft = { sectionId, label, value, type }
      if (itemId) await tripInfoService.updateItem(tripId, itemId, draft)
      else await tripInfoService.createItem(tripId, draft)
      navigate(`/trip/${tripId}/more/trip-info`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this information.')
    } finally {
      setBusy(false)
    }
  }

  const valueInput = type === 'note'
    ? <textarea rows={6} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter the information you want available during the trip…" />
    : <input
        type={type === 'date' ? 'date' : type === 'time' ? 'time' : type === 'number' ? 'number' : type === 'url' ? 'url' : type === 'phone' ? 'tel' : 'text'}
        inputMode={type === 'number' ? 'decimal' : type === 'url' ? 'url' : type === 'phone' ? 'tel' : undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={type === 'url' ? 'https://…' : type === 'phone' ? '+886…' : type === 'address' ? 'Street, city, country' : 'Value'}
      />

  return (
    <div className="page-stack trip-info-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}>← Trip Info</button></div>
      <PageIntro eyebrow={`Trip Info · ${data.trip.title}`} title={itemId ? 'Edit information' : 'Add information'} description="Choose a value type so links, phone numbers, dates, and notes can be presented appropriately while keeping the binder flexible." />
      <section className="trip-info-editor-card">
        <div className="form-stack">
          <div className="field-grid field-grid--2">
            <label className="field"><span>Section</span><select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>{data.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>
            <label className="field"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as TripInfoValueType)}>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          <label className="field"><span>Label</span><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Emergency contact, Hotel address, Policy number…" /></label>
          <label className="field"><span>Value</span>{valueInput}</label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info`)}>Cancel</button><button className="button button--primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : itemId ? 'Save changes' : 'Add information'}</button></div>
        </div>
      </section>
    </div>
  )
}

export default TripInfoItemEditorScreen
