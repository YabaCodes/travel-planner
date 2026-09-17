import { useEffect, useState } from 'react'

function ConnectionStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="runtime-status runtime-status--offline" role="status" aria-live="polite">
      <span className="runtime-status__dot" />
      <div><strong>Offline mode</strong><span>Your saved trip data remains available. Live websites, directions, and other external services may not open until you reconnect.</span></div>
    </div>
  )
}

export default ConnectionStatus
