import { useState, useSyncExternalStore } from 'react'
import { pwaUpdate } from '../pwaUpdate'

function UpdateBanner() {
  const ready = useSyncExternalStore(pwaUpdate.subscribe, pwaUpdate.isReady)
  const [busy, setBusy] = useState(false)
  if (!ready) return null
  return (
    <div className="status-banner update-banner" role="status">
      <span className="status-banner__dot" />
      <span>A new version is ready. Finish what you're doing, then reload.</span>
      <button className="button button--secondary" type="button" disabled={busy} onClick={() => { setBusy(true); void pwaUpdate.reload() }}>{busy ? 'Reloading…' : 'Reload'}</button>
    </div>
  )
}

export default UpdateBanner
