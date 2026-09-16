import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import MoreIcon from '../../shared/icons/MoreIcon'

const futureTools = [
  ['Packing', 'Prepare reusable, trip-specific packing lists.'],
  ['Trip Info', 'Keep essential travel information accessible offline.'],
]

function MoreScreen() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Trip tools"
        title="More"
        description="Secondary planning tools stay out of the core navigation while remaining one tap away when you need them."
      />

      <section className="tool-list" aria-label="Trip tools">
        <button className="tool-row tool-row--interactive" type="button" onClick={() => navigate(`/trip/${tripId}/more/places`)}>
          <span className="tool-row__number">01</span>
          <div>
            <h2>Places</h2>
            <p>Save ideas, organize priorities, and schedule them into the itinerary when you are ready.</p>
          </div>
          <MoreIcon />
        </button>

        <button className="tool-row tool-row--interactive" type="button" onClick={() => navigate(`/trip/${tripId}/more/bookings`)}>
          <span className="tool-row__number">02</span>
          <div>
            <h2>Bookings</h2>
            <p>Track reservations, confirmations, costs, links, and booking or cancellation deadlines.</p>
          </div>
          <MoreIcon />
        </button>

        {futureTools.map(([name, description], index) => (
          <article className="tool-row" key={name}>
            <span className="tool-row__number">{String(index + 3).padStart(2, '0')}</span>
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
