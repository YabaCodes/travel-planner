import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { packingService } from '../../data/services/packingService'
import './packing.css'

interface FormState {
  categoryId: string
  name: string
  quantity: string
  packedQuantity: string
  required: boolean
  notes: string
}

const emptyForm: FormState = { categoryId: '', name: '', quantity: '1', packedQuantity: '0', required: false, notes: '' }

function PackingItemEditorScreen() {
  const { tripId = '', itemId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const data = useLiveQuery(() => packingService.getItemEditorData(tripId, itemId), [tripId, itemId])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [initializedKey, setInitializedKey] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  if (data === undefined) return <div className="page-stack"><div className="loading-card">Opening packing item…</div></div>
  if (data === null) return <div className="page-stack"><PageIntro eyebrow="Packing" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>
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
