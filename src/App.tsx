import { Navigate, Route, Routes } from 'react-router-dom'
import { HashRouter } from 'react-router-dom'
import AppShell from './app/AppShell'
import TripsScreen from './features/trips/TripsScreen'
import TripDashboardScreen from './features/trips/TripDashboardScreen'
import ItineraryScreen from './features/itinerary/ItineraryScreen'
import TodayScreen from './features/today/TodayScreen'
import MoreScreen from './features/more/MoreScreen'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsScreen />} />
          <Route path="/trip/:tripId" element={<TripDashboardScreen />} />
          <Route path="/trip/:tripId/itinerary" element={<ItineraryScreen />} />
          <Route path="/trip/:tripId/today" element={<TodayScreen />} />
          <Route path="/trip/:tripId/more" element={<MoreScreen />} />
          <Route path="*" element={<Navigate to="/trips" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
