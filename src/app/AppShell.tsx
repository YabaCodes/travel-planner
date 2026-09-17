import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import AppMark from '../shared/components/AppMark'
import BottomNavigation from '../shared/components/BottomNavigation'
import SidebarNavigation from '../shared/components/SidebarNavigation'
import '../styles/app-shell.css'

const getTripIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/trip\/([^/]+)/)
  return match?.[1] ?? null
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const tripId = getTripIdFromPath(location.pathname)

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <AppMark compact />
        <SidebarNavigation tripId={tripId} />
      </aside>

      <div className="app-column">
        <header className="mobile-header">
          <button className="brand-button" onClick={() => navigate('/trips')} aria-label="Open My Trips">
            <AppMark />
          </button>
          <span className="milestone-pill">Trip tools · 0.10</span>
        </header>

        <main className="app-content">
          <Outlet />
        </main>

        <BottomNavigation tripId={tripId} />
      </div>
    </div>
  )
}

export default AppShell
