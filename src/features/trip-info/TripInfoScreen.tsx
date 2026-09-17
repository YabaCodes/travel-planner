import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlusIcon from '../../shared/icons/PlusIcon'
import { tripInfoService, type TripInfoOverview } from '../../data/services/tripInfoService'
import type { TripInfoItem } from '../../data/types/entities'
import './trip-info.css'

interface QueryResult {
  value: TripInfoOverview | null
  error: string | null
}

const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Could not open Trip Info.'
const typeLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const itemValue = (item: TripInfoItem) => {
  if (item.type === 'url') return <a href={item.value} target="_blank" rel="noreferrer">{item.value}</a>
  if (item.type === 'phone') return <a href={`tel:${item.value}`}>{item.value}</a>
  return <span>{item.value}</span>
}

function TripInfoScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const result = useLiveQuery<QueryResult>(async () => {
    try {
      return { value: await tripInfoService.getOverview(tripId), error: null }
    } catch (reason) {
      return { value: null, error: errorMessage(reason) }
    }
  }, [tripId])

  if (result === undefined) return <div className="page-stack"><div className="loading-card">Opening Trip Info…</div></div>
  if (result.error) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Trip Info couldn't open" description={result.error} action={<button className="button button--secondary" onClick={() => navigate(`/trip/${tripId}/more`)}>Back to trip tools</button>} /></div>
  if (!result.value) return <div className="page-stack"><PageIntro eyebrow="Trip Info" title="Trip not found" description="This trip may have been deleted." action={<button className="button button--secondary" onClick={() => navigate('/trips')}>Back to trips</button>} /></div>

  const data = result.value

  const removeSection = async (sectionId: string, title: string, itemCount: number) => {
    const suffix = itemCount ? ` This also removes ${itemCount} item${itemCount === 1 ? '' : 's'} from the section.` : ''
    if (!window.confirm(`Delete the section “${title}”?${suffix}`)) return
    await tripInfoService.softDeleteSection(tripId, sectionId)
  }

  const removeItem = async (item: TripInfoItem) => {
    if (!window.confirm(`Delete “${item.label}”?`)) return
    await tripInfoService.softDeleteItem(tripId, item.id)
  }

  return (
    <div className="page-stack trip-info-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more`)}>← Trip tools</button></div>
      <PageIntro
        eyebrow={`Offline binder · ${data.trip.title}`}
        title="Trip Info"
        description="Keep essential information in flexible sections so the details you need can stay available with the trip even when you are offline."
        action={<button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info/section/new`)}><PlusIcon />Add section</button>}
      />

      <section className="trip-info-summary" aria-label="Trip Info summary">
        <div><span>Sections</span><strong>{data.counts.sections}</strong></div>
        <div><span>Information items</span><strong>{data.counts.items}</strong></div>
      </section>

      {!data.sections.length ? (
        <section className="trip-info-empty">
          <span className="eyebrow">Flexible by design</span>
          <h2>Create your first information section</h2>
          <p>Use sections that fit the trip: emergency contacts, documents, connectivity, addresses, reference numbers, local notes, or anything else you want available offline.</p>
          <button className="button button--primary" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info/section/new`)}><PlusIcon />Add first section</button>
        </section>
      ) : (
        <section className="trip-info-section-stack" aria-label="Trip information sections">
          {data.sections.map((view, sectionIndex) => (
            <article className="trip-info-section" key={view.section.id}>
              <header className="trip-info-section__header">
                <div><h2>{view.section.title}</h2><p>{view.items.length} item{view.items.length === 1 ? '' : 's'}</p></div>
                <div className="trip-info-section__actions">
                  <button className="text-button" type="button" disabled={sectionIndex === 0} onClick={() => tripInfoService.moveSectionByOffset(tripId, view.section.id, -1)}>↑</button>
                  <button className="text-button" type="button" disabled={sectionIndex === data.sections.length - 1} onClick={() => tripInfoService.moveSectionByOffset(tripId, view.section.id, 1)}>↓</button>
                  <button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info/section/${view.section.id}/edit`)}>Edit</button>
                  <button className="text-button danger-text" type="button" onClick={() => removeSection(view.section.id, view.section.title, view.items.length)}>Delete</button>
                </div>
              </header>

              {view.items.length ? <div className="trip-info-items">
                {view.items.map((item, itemIndex) => (
                  <div className="trip-info-item" key={item.id}>
                    <div className="trip-info-item__body">
                      <div className="trip-info-item__label"><strong>{item.label}</strong><span>{typeLabel(item.type)}</span></div>
                      <div className={`trip-info-item__value${item.type === 'note' ? ' trip-info-item__value--note' : ''}`}>{itemValue(item)}</div>
                    </div>
                    <div className="trip-info-item__actions">
                      <button className="text-button" type="button" disabled={itemIndex === 0} onClick={() => tripInfoService.moveItemByOffset(tripId, item.id, -1)}>↑</button>
                      <button className="text-button" type="button" disabled={itemIndex === view.items.length - 1} onClick={() => tripInfoService.moveItemByOffset(tripId, item.id, 1)}>↓</button>
                      <button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info/item/${item.id}/edit`)}>Edit</button>
                      <button className="text-button danger-text" type="button" onClick={() => removeItem(item)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div> : <div className="trip-info-section__empty">No information in this section yet.</div>}

              <footer className="trip-info-section__footer"><button className="text-button" type="button" onClick={() => navigate(`/trip/${tripId}/more/trip-info/item/new?sectionId=${view.section.id}`)}><PlusIcon />Add information</button></footer>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

export default TripInfoScreen
