import type { TripSummary } from '../../data/services/tripService'
import { formatDateRange } from '../../data/utils/tripDate'

interface TripCardProps {
  summary: TripSummary
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const statusLabel: Record<string, string> = {
  idea: 'Idea',
  planning: 'Planning',
  ready: 'Ready',
  traveling: 'Traveling',
  completed: 'Completed',
  archived: 'Archived',
}

function TripCard({ summary, onOpen, onEdit, onDuplicate, onDelete }: TripCardProps) {
  const destinations = summary.destinations.map((destination) => destination.city).join(' · ') || 'Destination not set'
  const duration = summary.dayCount ? `${summary.dayCount} ${summary.dayCount === 1 ? 'day' : 'days'}` : 'Flexible dates'

  return (
    <article className="trip-card">
      <button className="trip-card__main" type="button" onClick={onOpen}>
        <div className="trip-card__topline">
          <span className={`trip-status trip-status--${summary.trip.status}`}>{statusLabel[summary.trip.status]}</span>
          <span className="trip-card__duration">{duration}</span>
        </div>
        <h3>{summary.trip.title}</h3>
        <p className="trip-card__destination">{destinations}</p>
        <p className="trip-card__dates">{formatDateRange(summary.trip.start_date, summary.trip.end_date)}</p>
      </button>

      <details className="trip-card__menu">
        <summary aria-label={`Trip actions for ${summary.trip.title}`}>•••</summary>
        <div className="trip-card__menu-popover">
          <button type="button" onClick={onEdit}>Edit trip</button>
          <button type="button" onClick={onDuplicate}>Duplicate</button>
          <button className="danger-text" type="button" onClick={onDelete}>Delete</button>
        </div>
      </details>
    </article>
  )
}

export default TripCard
