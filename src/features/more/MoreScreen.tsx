import PageIntro from '../../shared/components/PageIntro'
import MoreIcon from '../../shared/icons/MoreIcon'

const futureTools = [
  ['Places', 'Save ideas before deciding where they fit.'],
  ['Bookings', 'Track reservations, confirmations, and deadlines.'],
  ['Packing', 'Prepare reusable, trip-specific packing lists.'],
  ['Trip Info', 'Keep essential travel information accessible offline.'],
]

function MoreScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Trip tools"
        title="More"
        description="Secondary planning tools stay out of the core navigation while remaining one tap away when you need them."
      />

      <section className="tool-list" aria-label="Future trip tools">
        {futureTools.map(([name, description], index) => (
          <article className="tool-row" key={name}>
            <span className="tool-row__number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>{name}</h2>
              <p>{description}</p>
            </div>
            <MoreIcon />
          </article>
        ))}
      </section>
    </div>
  )
}

export default MoreScreen
