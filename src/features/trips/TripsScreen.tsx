import PageIntro from '../../shared/components/PageIntro'
import PlaceholderPanel from '../../shared/components/PlaceholderPanel'
import CompassIcon from '../../shared/icons/CompassIcon'
import PlusIcon from '../../shared/icons/PlusIcon'

function TripsScreen() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Your travel workspace"
        title="My Trips"
        description="Every trip will start here — from the first idea through planning, preparation, and the days you are actually travelling."
        action={
          <button className="button button--primary" type="button" disabled title="Trip creation arrives in Milestone 3">
            <PlusIcon />
            New Trip
          </button>
        }
      />

      <div className="status-banner" role="status">
        <span className="status-banner__dot" />
        Foundation ready. Trip creation and local storage are the next milestones.
      </div>

      <PlaceholderPanel
        icon={<CompassIcon />}
        title="No trips yet"
        body="This clean state is intentional for Milestone 1. Once the database layer is added, trips you create will appear here and remain available offline."
      >
        <div className="feature-preview" aria-label="Future trip card preview">
          <div className="feature-preview__label">Coming in Milestone 3</div>
          <div className="feature-preview__row">
            <span>Trip cards</span>
            <span>Dates · status · duration</span>
          </div>
        </div>
      </PlaceholderPanel>

      <section className="foundation-grid" aria-label="Foundation capabilities">
        <article className="foundation-card">
          <span className="foundation-card__index">01</span>
          <h3>Installable</h3>
          <p>Configured as a standalone PWA for Home Screen installation.</p>
        </article>
        <article className="foundation-card">
          <span className="foundation-card__index">02</span>
          <h3>Offline shell</h3>
          <p>The application shell is prepared for caching after the first load.</p>
        </article>
        <article className="foundation-card">
          <span className="foundation-card__index">03</span>
          <h3>Responsive</h3>
          <p>Bottom navigation on phones becomes a planning sidebar on larger screens.</p>
        </article>
      </section>
    </div>
  )
}

export default TripsScreen
