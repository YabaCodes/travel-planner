import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/global.css'
import { initializeDatabase } from './data/services/databaseService'
import AppErrorBoundary from './shared/components/AppErrorBoundary'
import FatalAppScreen from './shared/components/FatalAppScreen'

registerSW({
  immediate: true,
  onRegisterError(error) {
    console.error('Service worker registration failed', error)
  },
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

const root = createRoot(rootElement)
const render = (node: ReactNode) => root.render(<StrictMode><AppErrorBoundary>{node}</AppErrorBoundary></StrictMode>)

async function start() {
  try {
    await initializeDatabase()
    render(<App />)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'Unknown database startup error.'
    console.error('Database initialization failed', cause)
    render(
      <FatalAppScreen
        eyebrow="Startup recovery"
        title="Travel Planner could not open its local database"
        description="The app stopped before loading trip screens so it would not continue in an uncertain data state. Reload the app first. Your existing browser data has not been intentionally deleted."
        detail={detail}
        showDataLink={false}
      />,
    )
  }
}

void start()
