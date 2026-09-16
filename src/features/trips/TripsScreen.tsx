import PageIntro from '../../shared/components/PageIntro'
import PlaceholderPanel from '../../shared/components/PlaceholderPanel'
import DatabaseStatusPanel from '../../shared/components/DatabaseStatusPanel'
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
        Local-first storage is active. Milestone 3 will connect real trip creation to this database.
      </div>

      <DatabaseStatusPanel />

      <PlaceholderPanel
        icon={<CompassIcon />}
        title="No trips yet"
        body="Trip creation arrives next. The database underneath this screen is already structured for trips, destinations, itinerary days, places, bookings, packing, and trip information."
      >
        <div className="feature-preview" aria-label="Future trip card preview">
          <div className="feature-preview__label">Coming in Milestone 3</div>
          <div className="feature-preview__row">
            <span>Trip cards</span>
            <span>Dates · status · duration</span>
          </div>
        </div>
      </PlaceholderPanel>

      <section className="foundation-grid" aria-label="Data foundation capabilities">
        <article className="foundation-card">
          <span className="foundation-card__index">01</span>
          <h3>Local-first</h3>
          <p>Travel data is stored in IndexedDB through Dexie and remains usable offline.</p>
        </article>
        <article className="foundation-card">
          <span className="foundation-card__index">02</span>
          <h3>Typed schema</h3>
          <p>Eighteen related tables establish the data model before feature screens depend on it.</p>
        </article>
        <article className="foundation-card">
          <span className="foundation-card__index">03</span>
          <h3>Reactive</h3>
          <p>Dexie live queries update the interface automatically when database records change.</p>
        </article>
      </section>
    </div>
  )
}

export default TripsScreen
