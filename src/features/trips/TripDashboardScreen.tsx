import { useNavigate, useParams } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import PlaceholderPanel from '../../shared/components/PlaceholderPanel'
import CalendarIcon from '../../shared/icons/CalendarIcon'

function TripDashboardScreen() {
  const { tripId = 'trip' } = useParams()
  const navigate = useNavigate()

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Trip workspace"
        title="Trip Dashboard"
        description={`Foundation route active for trip ${tripId}. Real trip details arrive with the local database and trip-management milestones.`}
        action={
          <button className="button button--secondary" type="button" onClick={() => navigate(`/trip/${tripId}/itinerary`)}>
            Open itinerary
          </button>
        }
      />

      <PlaceholderPanel
        icon={<CalendarIcon />}
        title="Dashboard structure is ready"
        body="This screen will become the command center for itinerary progress, bookings, packing, saved places, and trip readiness."
      />
    </div>
  )
}

export default TripDashboardScreen
