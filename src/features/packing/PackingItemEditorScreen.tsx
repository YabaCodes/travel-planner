import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { packingService, type PackingItemEditorData } from '../../data/services/packingService'
import './packing.css'

interface FormState {
  categoryId: string
  name: string
  quantity: string
  packedQuantity: string
  required: boolean
  notes: string
}

interface EditorQueryResult {
  value: PackingItemEditorData | null
  error: string | null
}

type InitState = 'loading' | 'ready' | 'error'

const emptyForm: FormState = { categoryId: '', name: '', quantity: '1', packedQuantity: '0', required: false, notes: '' }
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Could not open the packing item.'

function PackingItemEditorScreen() {
  const { tripId = '', itemId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [initializedKey, setInitializedKey] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [initState, setInitState] = useState<InitState>('loading')
  const [initError, setInitError] = useState('')
  const [initAttempt, setInitAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setInitState('loading')
    setInitError('')

    packingService.initializePacking(tripId)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          setInitError('This trip could not be found.')
          setInitState('error')
          return
        }
        setInitState('ready')
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setInitError(errorMessage(reason))
        setInitState('error')
      })

    return () => { cancelled = true }
  }, [initAttempt, tripId])

  const queryResult = useLiveQuery<EditorQueryResult>(async () => {
    if (initState !== 'ready') return { value: null, error: null }
    try {
      return { value: await packingService.getItemEditorData(tripId, itemId), error: null }
    } catch (reason) {
      return { value: null, error: errorMessage(reason) }
    }
  }, [initState, itemId, tripId])

  const data = queryResult?.value ?? null

  useEffect(() => {
    if (!data) return
    const key = `${tripId}:${itemId ?? 'new'}`
    if (initializedKey === key) return
    const requestedCategory = searchParams.get('categoryId')
    const fallbackCategory = data.categories.find((category) => category.id === requestedCategory)?.id ?? data.categories[0]?.id ?? ''
    if (itemId && data.item) {
      setForm({
        categoryId: data.item.category_id,
        name: data.item.name,
        quantity: String(data.item.quantity),
        packedQuantity: String(data.item.packed_quantity),
        required: data.item.required,
        notes: data.item.notes ?? '',
      })
    } else {
      setForm({ ...emptyForm, categoryId: fallbackCategory })
    }
    setInitializedKey(key)
  }, [data, initializedKey, itemId, searchParams, tripId])

  if (initState === 'loading' || queryResult === undefined) return <div className="page-stack"><div className="loading-card">Opening packing item…</div></div>

  const screenError = initState === 'error' ? initError : queryResult.error
  if (screenError) {
    return <div className="page-stack">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing`)}>← Packing list</button></div>
      <PageIntro
        eyebrow="Packing"
        title="Packing item couldn't open"
        description={`${screenError} Your existing trip data has not been changed.`}
        action={<div className="inline-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>Back to trip tools</button><button className="button button--primary" type="button" onClick={() => setInitAttempt((value) => value + 1)}>Retry</button></div>}
      />
    </div>
  }

  if (!data) return <div className="page-stack"><PageIntro eyebrow="Packing" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>
  if (itemId && !data.item) return <div className="page-stack"><PageIntro eyebrow="Packing" title="Item not found" description="This packing item may have been deleted." action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more/packing`)}>Back to packing</button>} /></div>

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const quantity = Number(form.quantity)
      const packedQuantity = Number(form.packedQuantity)
      if (itemId) {
        await packingService.updateItem(tripId, itemId, { categoryId: form.categoryId, name: form.name, quantity, packedQuantity, required: form.required, notes: form.notes || null })
      } else {
        await packingService.createItem(tripId, { categoryId: form.categoryId, name: form.name, quantity, packedQuantity, required: form.required, notes: form.notes || null })
      }
      navigate(`/trip/${tripId}/more/packing`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the packing item.')
    } finally {
      setSaving(false)
    }
  }

  const quantityValue = Math.max(1, Number(form.quantity) || 1)

  return (
    <div className="page-stack packing-editor-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing`)}>← Packing list</button></div>
      <PageIntro
        eyebrow={`Packing · ${data.trip.title}`}
        title={itemId ? 'Edit packing item' : 'Add packing item'}
        description="Track the quantity you need and the quantity already packed. Required items are surfaced separately in packing progress."
      />

      <form className="form-panel packing-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field field--wide"><span>Item name</span><input autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Passport, T-shirt, charger…" /></label>
          <label className="field"><span>Category</span><select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="field"><span>Quantity needed</span><input type="number" min="1" max="999" inputMode="numeric" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value, packedQuantity: String(Math.min(Number(current.packedQuantity) || 0, Math.max(1, Number(event.target.value) || 1))) }))} /></label>
          <label className="field"><span>Already packed</span><input type="number" min="0" max={quantityValue} inputMode="numeric" value={form.packedQuantity} onChange={(event) => setForm((current) => ({ ...current, packedQuantity: event.target.value }))} /></label>
          <label className="toggle-field packing-required-toggle"><input type="checkbox" checked={form.required} onChange={(event) => setForm((current) => ({ ...current, required: event.target.checked }))} /><span><strong>Required item</strong><small>Count this item in the must-pack progress.</small></span></label>
          <label className="field field--wide"><span>Notes</span><textarea rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Size, color, where it is stored, special reminder…" /></label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="wizard-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing`)}>Cancel</button><button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Saving…' : itemId ? 'Save changes' : 'Add item'}</button></div>
      </form>
    </div>
  )
}

export default PackingItemEditorScreen
