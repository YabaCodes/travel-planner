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
import TransportEditorScreen from './features/itinerary/TransportEditorScreen'
import TodayScreen from './features/today/TodayScreen'
import MoreScreen from './features/more/MoreScreen'
import PlacesScreen from './features/places/PlacesScreen'
import PlaceEditorScreen from './features/places/PlaceEditorScreen'
import SchedulePlaceScreen from './features/places/SchedulePlaceScreen'
import BookingsScreen from './features/bookings/BookingsScreen'
import BookingEditorScreen from './features/bookings/BookingEditorScreen'
import PackingScreen from './features/packing/PackingScreen'
import PackingItemEditorScreen from './features/packing/PackingItemEditorScreen'
import TravelLegsScreen from './features/travel-legs/TravelLegsScreen'
import TravelLegEditorScreen from './features/travel-legs/TravelLegEditorScreen'
import TripInfoScreen from './features/trip-info/TripInfoScreen'
import TripInfoSectionEditorScreen from './features/trip-info/TripInfoSectionEditorScreen'
import TripInfoItemEditorScreen from './features/trip-info/TripInfoItemEditorScreen'
import DataBackupScreen from './features/backup/DataBackupScreen'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/trips" replace />} />
          <Route path="/trips" element={<TripsScreen />} />
          <Route path="/trips/new" element={<TripWizardScreen />} />
          <Route path="/data" element={<DataBackupScreen />} />
          <Route path="/trip/:tripId" element={<TripDashboardScreen />} />
          <Route path="/trip/:tripId/edit" element={<TripEditScreen />} />
          <Route path="/trip/:tripId/itinerary" element={<ItineraryScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId" element={<TripDayScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId/activity/new" element={<ActivityEditorScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId/activity/:activityId/edit" element={<ActivityEditorScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId/transport/new" element={<TransportEditorScreen />} />
          <Route path="/trip/:tripId/itinerary/day/:dayId/transport/:segmentId/edit" element={<TransportEditorScreen />} />
          <Route path="/trip/:tripId/today" element={<TodayScreen />} />
          <Route path="/trip/:tripId/more" element={<MoreScreen />} />
          <Route path="/trip/:tripId/more/places" element={<PlacesScreen />} />
          <Route path="/trip/:tripId/more/places/new" element={<PlaceEditorScreen />} />
          <Route path="/trip/:tripId/more/places/:tripPlaceId/edit" element={<PlaceEditorScreen />} />
          <Route path="/trip/:tripId/more/places/:tripPlaceId/schedule" element={<SchedulePlaceScreen />} />
          <Route path="/trip/:tripId/more/bookings" element={<BookingsScreen />} />
          <Route path="/trip/:tripId/more/bookings/new" element={<BookingEditorScreen />} />
          <Route path="/trip/:tripId/more/bookings/:bookingId/edit" element={<BookingEditorScreen />} />
          <Route path="/trip/:tripId/more/packing" element={<PackingScreen />} />
          <Route path="/trip/:tripId/more/packing/item/new" element={<PackingItemEditorScreen />} />
          <Route path="/trip/:tripId/more/packing/item/:itemId/edit" element={<PackingItemEditorScreen />} />
          <Route path="/trip/:tripId/more/travel-legs" element={<TravelLegsScreen />} />
          <Route path="/trip/:tripId/more/travel-legs/new" element={<TravelLegEditorScreen />} />
          <Route path="/trip/:tripId/more/travel-legs/:travelLegId/edit" element={<TravelLegEditorScreen />} />
          <Route path="/trip/:tripId/more/trip-info" element={<TripInfoScreen />} />
          <Route path="/trip/:tripId/more/trip-info/section/new" element={<TripInfoSectionEditorScreen />} />
          <Route path="/trip/:tripId/more/trip-info/section/:sectionId/edit" element={<TripInfoSectionEditorScreen />} />
          <Route path="/trip/:tripId/more/trip-info/item/new" element={<TripInfoItemEditorScreen />} />
          <Route path="/trip/:tripId/more/trip-info/item/:itemId/edit" element={<TripInfoItemEditorScreen />} />
          <Route path="*" element={<Navigate to="/trips" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
