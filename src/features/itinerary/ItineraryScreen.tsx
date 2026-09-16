import PageIntro from '../../shared/components/PageIntro'
import PlaceholderPanel from '../../shared/components/PlaceholderPanel'
import CalendarIcon from '../../shared/icons/CalendarIcon'

function ItineraryScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Planner mode"
        title="Itinerary"
        description="The day-by-day planning workspace is routed and ready. Trip days and editable activities arrive in Milestone 4."
      />

      <PlaceholderPanel
        icon={<CalendarIcon />}
        title="Your days will live here"
        body="The final planner will show day cards, scheduled and unscheduled activities, priorities, free-time blocks, and schedule warnings."
      >
        <div className="skeleton-days" aria-hidden="true">
          <div className="skeleton-day"><span /><b /><i /></div>
          <div className="skeleton-day"><span /><b /><i /></div>
          <div className="skeleton-day"><span /><b /><i /></div>
        </div>
      </PlaceholderPanel>
    </div>
  )
}

export default ItineraryScreen
