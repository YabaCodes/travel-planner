import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  clearMilestone2TestData,
  getDatabaseDiagnostics,
  readPersistenceStatus,
  requestPersistentStorage,
  seedMilestone2TestData,
  type PersistenceSupport,
} from '../../data/services/databaseService'

const persistenceLabel = (status: PersistenceSupport | undefined) => {
  if (status === 'granted') return 'Persistent storage granted'
  if (status === 'not-granted') return 'Best-effort browser storage'
  if (status === 'unsupported') return 'Persistence API unavailable'
  return 'Checking storage policy…'
}

function DatabaseStatusPanel() {
  const diagnostics = useLiveQuery(() => getDatabaseDiagnostics(), [])
  const persistence = useLiveQuery(() => readPersistenceStatus(), [])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage(successMessage)
    } catch (error) {
      console.error(error)
      setMessage('The database action failed. Check the browser console for details.')
    } finally {
      setBusy(false)
    }
  }

  const retryPersistence = async () => {
    setBusy(true)
    const result = await requestPersistentStorage()
    setMessage(persistenceLabel(result))
    setBusy(false)
  }

  return (
    <section className="database-panel" aria-labelledby="database-panel-title">
      <div className="database-panel__heading">
        <div>
          <span className="eyebrow">Milestone 2 validation</span>
          <h2 id="database-panel-title">Local database</h2>
        </div>
        <span className="database-panel__badge">IndexedDB · Dexie</span>
      </div>

      <div className="database-metrics" aria-live="polite">
        <div className="database-metric">
          <span>Schema</span>
          <strong>v{diagnostics?.schemaVersion ?? '—'}</strong>
        </div>
        <div className="database-metric">
          <span>Tables</span>
          <strong>{diagnostics?.tableCount ?? '—'}</strong>
        </div>
        <div className="database-metric">
          <span>Records</span>
          <strong>{diagnostics?.totalRecords ?? '—'}</strong>
        </div>
        <div className="database-metric">
          <span>Storage</span>
          <strong className="database-metric__text">{persistenceLabel(persistence)}</strong>
        </div>
      </div>

      <p className="database-panel__copy">
        Add the test record, close the app completely, then reopen it. If the record count stays at 3, IndexedDB persistence is working on this device. Clear the sample afterward.
      </p>

      <div className="database-panel__actions">
        <button
          className="button button--secondary"
          type="button"
          disabled={busy}
          onClick={() => run(seedMilestone2TestData, 'Test data saved. Close and reopen the app to verify persistence.')}
        >
          Add persistence test
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={busy}
          onClick={() => run(clearMilestone2TestData, 'Milestone 2 test data cleared.')}
        >
          Clear test data
        </button>
        <button className="button button--secondary" type="button" disabled={busy} onClick={retryPersistence}>
          Retry storage request
        </button>
      </div>

      {message ? <p className="database-panel__message" role="status">{message}</p> : null}
    </section>
  )
}

export default DatabaseStatusPanel
