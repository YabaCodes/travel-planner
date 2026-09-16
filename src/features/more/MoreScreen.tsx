import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import MoreIcon from '../../shared/icons/MoreIcon'

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

        <button className="tool-row tool-row--interactive" type="button" onClick={() => navigate(`/trip/${tripId}/more/packing`)}>
          <span className="tool-row__number">03</span>
          <div>
            <h2>Packing</h2>
            <p>Build an offline checklist, track quantities, and see what required items are still missing.</p>
          </div>
          <MoreIcon />
        </button>

        <article className="tool-row">
          <span className="tool-row__number">04</span>
          <div>
            <h2>Trip Info</h2>
            <p>Keep essential travel information accessible offline.</p>
          </div>
          <MoreIcon />
        </article>
      </section>
    </div>
  )
}

export default MoreScreen
