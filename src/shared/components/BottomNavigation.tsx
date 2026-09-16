import { NavLink } from 'react-router-dom'
import HomeIcon from '../icons/HomeIcon'
import CalendarIcon from '../icons/CalendarIcon'
import TodayIcon from '../icons/TodayIcon'
import MoreIcon from '../icons/MoreIcon'

interface BottomNavigationProps {
  tripId: string | null
}

const getClassName = ({ isActive }: { isActive: boolean }) => `bottom-nav__item${isActive ? ' is-active' : ''}`

function BottomNavigation({ tripId }: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/trips" className={getClassName}>
        <HomeIcon />
        <span>Trips</span>
      </NavLink>

      {tripId ? (
        <>
          <NavLink to={`/trip/${tripId}/itinerary`} className={getClassName}>
            <CalendarIcon />
            <span>Itinerary</span>
          </NavLink>
          <NavLink to={`/trip/${tripId}/today`} className={getClassName}>
            <TodayIcon />
            <span>Today</span>
          </NavLink>
          <NavLink to={`/trip/${tripId}/more`} className={getClassName}>
            <MoreIcon />
            <span>More</span>
          </NavLink>
        </>
      ) : (
        <>
          <span className="bottom-nav__item is-disabled"><CalendarIcon /><span>Itinerary</span></span>
          <span className="bottom-nav__item is-disabled"><TodayIcon /><span>Today</span></span>
          <span className="bottom-nav__item is-disabled"><MoreIcon /><span>More</span></span>
        </>
      )}
    </nav>
  )
}

export default BottomNavigation
