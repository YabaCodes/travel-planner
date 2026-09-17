import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import AppMark from '../shared/components/AppMark'
import BottomNavigation from '../shared/components/BottomNavigation'
import ConnectionStatus from '../shared/components/ConnectionStatus'
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

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
          <span className="milestone-pill">V1 candidate · 0.13</span>
        </header>

        <main className="app-content">
          <ConnectionStatus />
          <Outlet />
        </main>
        <BottomNavigation tripId={tripId} />
      </div>
    </div>
  )
}

export default AppShell
