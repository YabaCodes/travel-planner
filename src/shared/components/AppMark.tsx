import CompassIcon from '../icons/CompassIcon'

interface AppMarkProps {
  compact?: boolean
}

function AppMark({ compact = false }: AppMarkProps) {
  return (
    <div className={`app-mark${compact ? ' app-mark--compact' : ''}`}>
      <span className="app-mark__icon" aria-hidden="true">
        <CompassIcon />
      </span>
      {!compact && (
        <span>
          <strong>Travel Planner</strong>
          <small>Plan clearly. Travel freely.</small>
        </span>
      )}
    </div>
  )
}

export default AppMark
