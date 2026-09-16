import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles/global.css'
import { initializeDatabase } from './data/services/databaseService'

registerSW({ immediate: true })
void initializeDatabase().catch((error) => console.error('Database initialization failed', error))

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
