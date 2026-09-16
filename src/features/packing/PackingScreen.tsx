import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { packingService, type PackingOverview } from '../../data/services/packingService'
import type { PackingItem } from '../../data/types/entities'
import './packing.css'

type PackingFilter = 'all' | 'unpacked' | 'required'
type InitState = 'loading' | 'ready' | 'error'

interface PackingQueryResult {
  value: PackingOverview | null
  error: string | null
}

const itemMatches = (item: PackingItem, filter: PackingFilter, search: string) => {
  const filterMatch = filter === 'all'
    || (filter === 'unpacked' && item.packed_quantity < item.quantity)
    || (filter === 'required' && item.required)
  const term = search.trim().toLowerCase()
  const searchMatch = !term || `${item.name} ${item.notes ?? ''}`.toLowerCase().includes(term)
  return filterMatch && searchMatch
}

const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Could not open the packing list.'

function PackingScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<PackingFilter>('all')
  const [search, setSearch] = useState('')
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

  const queryResult = useLiveQuery<PackingQueryResult>(async () => {
    if (initState !== 'ready') return { value: null, error: null }
    try {
      return { value: await packingService.getOverview(tripId), error: null }
    } catch (reason) {
      return { value: null, error: errorMessage(reason) }
    }
  }, [initState, tripId])

  const data = queryResult?.value ?? null
  const visibleCategories = useMemo(() => {
    if (!data) return []
    return data.categories.map((view) => ({
      ...view,
      items: view.items.filter((item) => itemMatches(item, filter, search)),
    })).filter((view) => filter === 'all' && !search.trim() ? true : view.items.length > 0)
  }, [data, filter, search])

  if (initState === 'loading' || queryResult === undefined) return <div className="page-stack"><div className="loading-card">Opening packing list…</div></div>

  const screenError = initState === 'error' ? initError : queryResult.error
  if (screenError) {
    return <div className="page-stack">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>← Trip tools</button></div>
      <PageIntro
        eyebrow="Packing"
        title="Packing couldn't open"
        description={`${screenError} Your existing trip data has not been changed.`}
        action={<div className="inline-actions"><button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>Back to trip tools</button><button className="button button--primary" type="button" onClick={() => setInitAttempt((value) => value + 1)}>Retry</button></div>}
      />
    </div>
  }

  if (!data) return <div className="page-stack"><PageIntro eyebrow="Packing" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const remove = async (item: PackingItem) => {
    if (!window.confirm(`Delete “${item.name}” from the packing list?`)) return
    await packingService.softDeleteItem(item.id)
  }

  const reset = async () => {
    if (!data.counts.packedQuantity) return
    if (!window.confirm('Mark every packing item as unpacked? The items themselves will stay on the list.')) return
    await packingService.resetPacked(tripId)
  }

  return (
    <div className="page-stack packing-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>← Trip tools</button></div>
      <PageIntro
        eyebrow={`Packing · ${data.trip.title}`}
        title="Packing list"
        description="Prepare once, then use the checklist offline while you pack. Quantities let you track partial packing without duplicating items."
        action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing/item/new`)}><PlusIcon />Add item</button>}
      />

      <section className="packing-progress-card" aria-label="Packing progress">
        <div className="packing-progress-card__top"><div><span className="eyebrow">Overall progress</span><strong>{data.counts.percentage}% packed</strong></div><span>{data.counts.packedQuantity} / {data.counts.totalQuantity} units</span></div>
        <div className="packing-progress-track" aria-hidden="true"><span style={{ width: `${data.counts.percentage}%` }} /></div>
        <div className="packing-progress-metrics">
          <div><span>Items</span><strong>{data.counts.items}</strong></div>
          <div><span>Still unpacked</span><strong>{data.counts.unpackedQuantity}</strong></div>
          <div><span>Required left</span><strong>{data.counts.requiredRemaining}</strong></div>
        </div>
      </section>

      <section className="packing-controls">
        <label className="field packing-search"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Passport, charger, jacket…" /></label>
        <div className="packing-filter-group" role="group" aria-label="Packing filter">
          {([['all', 'All'], ['unpacked', 'Unpacked'], ['required', 'Required']] as Array<[PackingFilter, string]>).map(([value, label]) => <button key={value} className={`packing-filter${filter === value ? ' is-active' : ''}`} type="button" onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <button className="text-button" type="button" onClick={reset} disabled={!data.counts.packedQuantity}>Reset packed</button>
      </section>

      {!data.counts.items ? (
        <section className="packing-empty"><span className="eyebrow">Ready to prepare</span><h2>Build your trip checklist</h2><p>Your eight default packing categories are ready. Add only what this trip needs.</p><button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing/item/new`)}><PlusIcon />Add first item</button></section>
      ) : visibleCategories.length === 0 ? (
        <section className="packing-empty"><span className="eyebrow">No matching items</span><h2>Nothing matches this view</h2><p>Change the filter or search term to see the rest of your packing list.</p></section>
      ) : (
        <section className="packing-category-stack" aria-label="Packing categories">
          {visibleCategories.map(({ category, items }) => (
            <article className="packing-category" key={category.id}>
              <header className="packing-category__header">
                <div><h2>{category.name}</h2><p>{items.length} item{items.length === 1 ? '' : 's'}</p></div>
                <button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing/item/new?categoryId=${category.id}`)}><PlusIcon />Add</button>
              </header>
              {items.length ? <div className="packing-items">
                {items.map((item) => {
                  const fullyPacked = item.packed_quantity >= item.quantity
                  return <div className={`packing-item${fullyPacked ? ' is-packed' : ''}`} key={item.id}>
                    <button className="packing-check" type="button" onClick={() => packingService.togglePacked(item.id)} aria-label={fullyPacked ? `Mark ${item.name} unpacked` : `Mark ${item.name} packed`} aria-pressed={fullyPacked}><span>{fullyPacked ? '✓' : ''}</span></button>
                    <div className="packing-item__body">
                      <div className="packing-item__title"><strong>{item.name}</strong>{item.required ? <span className="packing-required">Required</span> : null}</div>
                      <div className="packing-item__meta"><span>{item.packed_quantity} / {item.quantity} packed</span>{item.notes ? <span>{item.notes}</span> : null}</div>
                    </div>
                    <div className="packing-stepper" aria-label={`Packed quantity for ${item.name}`}>
                      <button type="button" onClick={() => packingService.setPackedQuantity(item.id, item.packed_quantity - 1)} disabled={item.packed_quantity <= 0}>−</button>
                      <span>{item.packed_quantity}</span>
                      <button type="button" onClick={() => packingService.setPackedQuantity(item.id, item.packed_quantity + 1)} disabled={item.packed_quantity >= item.quantity}>+</button>
                    </div>
                    <div className="packing-item__actions"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing/item/${item.id}/edit`)}>Edit</button><button className="text-button danger-text" type="button" onClick={() => remove(item)}>Delete</button></div>
                  </div>
                })}
              </div> : <div className="packing-category__empty">No items in this category yet.</div>}
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

export default PackingScreen
