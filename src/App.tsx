import { Navigate, Route, Routes } from 'react-router-dom'
import { HashRouter } from 'react-router-dom'
import AppShell from './app/AppShell'
import TripsScreen from './features/trips/TripsScreen'
import TripWizardScreen from './features/trips/TripWizardScreen'
import TripEditScreen from './features/trips/TripEditScreen'
import TripDashboardScreen from './features/trips/TripDashboardScreen'
import ItineraryScreen from './features/itinerary/ItineraryScreen'
import TripDayScreen from './features/itinerary/TripDayScreen'
import ActivityEditorScreen from './features/itinerary/ActivityEditorScreen'
import TodayScreen from './features/today/TodayScreen'
import MoreScreen from './features/more/MoreScreen'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsScreen />} />
          <Route path="/trips/new" element={<TripWizardScreen />} />
          <Route path="/trip/:tripId" element={<TripDashboardScreen />} />
          <Route path="/trip/:tripId/edit" element={<TripEditScreen />} />
          <Route path="/trip/:tripId/itinerary" element={<ItineraryScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId" element={<TripDayScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId/activity/new" element={<ActivityEditorScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId/activity/:activityId/edit" element={<ActivityEditorScreen />} />
          <Route path="/trip/:tripId/today" element={<TodayScreen />} />
          <Route path="/trip/:tripId/more" element={<MoreScreen />} />
          <Route path="*" element={<Navigate to="/trips" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
