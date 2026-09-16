import PageIntro from '../../shared/components/PageIntro'
import PlaceholderPanel from '../../shared/components/PlaceholderPanel'
import TodayIcon from '../../shared/icons/TodayIcon'

function TodayScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Travel mode"
        title="Today"
        description="A deliberately simpler travel-day view will surface what is next, when to leave, and the information you need without the planning clutter."
      />

      <PlaceholderPanel
        icon={<TodayIcon />}
        title="Built for the day of travel"
        body="Today Mode is already separated from Planner Mode in navigation. The live activity timeline arrives after the itinerary, places, bookings, and transport foundations are built."
      />
    </div>
  )
}

export default TodayScreen
