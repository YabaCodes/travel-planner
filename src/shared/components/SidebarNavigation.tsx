import { NavLink } from 'react-router-dom'
import HomeIcon from '../icons/HomeIcon'
import CalendarIcon from '../icons/CalendarIcon'
import TodayIcon from '../icons/TodayIcon'
import MoreIcon from '../icons/MoreIcon'

interface SidebarNavigationProps {
  tripId: string | null
}

const activeClass = ({ isActive }: { isActive: boolean }) => `sidebar-link${isActive ? ' is-active' : ''}`

function SidebarNavigation({ tripId }: SidebarNavigationProps) {
  return (
    <div className="sidebar-stack">
      <div className="sidebar-brand">
        <div className="sidebar-brand__name">Travel Planner</div>
        <div className="sidebar-brand__caption">Personal travel workspace</div>
      </div>

      <NavLink to="/trips" className={activeClass}>
        <HomeIcon />
        <span>Trips</span>
      </NavLink>

      {tripId ? (
        <>
          <NavLink to={`/trip/${tripId}/itinerary`} className={activeClass}>
            <CalendarIcon />
            <span>Itinerary</span>
          </NavLink>
          <NavLink to={`/trip/${tripId}/today`} className={activeClass}>
            <TodayIcon />
            <span>Today</span>
          </NavLink>
          <NavLink to={`/trip/${tripId}/more`} className={activeClass}>
            <MoreIcon />
            <span>More</span>
          </NavLink>
        </>
      ) : (
        <div className="sidebar-hint">Open a trip to unlock itinerary, today, and trip tools.</div>
      )}

      <div className="sidebar-version">Milestone 8 · v0.8</div>
    </div>
  )
}

export default SidebarNavigation
