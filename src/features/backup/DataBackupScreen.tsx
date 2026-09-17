import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import {
  backupService,
  type BackupPreview,
  type RestoreMode,
  type RestoreResult,
  type StorageHealth,
} from '../../data/services/backupService'
import './backup.css'

const MAX_BACKUP_BYTES = 50 * 1024 * 1024

const formatBytes = (bytes: number | null) => {
  if (bytes === null) return 'Unavailable'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`
}

const formatExportDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function DataBackupScreen() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const overview = useLiveQuery(() => backupService.getOverview(), [])
  const [storage, setStorage] = useState<StorageHealth | null>(null)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('replace')
  const [result, setResult] = useState<RestoreResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refreshStorage = async () => setStorage(await backupService.getStorageHealth())

  useEffect(() => {
    void refreshStorage()
  }, [])

  const exportBackup = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const backup = await backupService.createBackup()
      const text = backupService.serializeBackup(backup)
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = backupService.fileNameFor(backup)
      anchor.rel = 'noopener'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(`Backup created with ${backup.totalRecords} records. Save the JSON file somewhere outside this browser/device.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the backup.')
    } finally {
      setBusy(false)
    }
  }

  const chooseFile = () => fileInputRef.current?.click()

  const loadFile = async (file: File | undefined) => {
    setError('')
    setMessage('')
    setResult(null)
    setPreview(null)
    setSelectedFileName('')
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setError('This backup is larger than 50 MB. Choose a smaller Travel Planner JSON backup.')
      return
    }
    try {
      const text = await file.text()
      const nextPreview = backupService.parseBackup(text)
      setPreview(nextPreview)
      setSelectedFileName(file.name)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this backup file.')
    }
  }

  const restore = async () => {
    if (!preview) return
    const replaceMessage = `Replace ALL current Travel Planner data with “${selectedFileName}”?\n\nThis removes the current local database first. Create a fresh backup before continuing if you might need the current data.`
    const mergeMessage = `Merge “${selectedFileName}” into the current database?\n\nNew IDs will be added. Matching IDs will be overwritten by the backup. Identical records will be skipped.`
    if (!window.confirm(restoreMode === 'replace' ? replaceMessage : mergeMessage)) return

    setBusy(true)
    setError('')
    setMessage('')
    setResult(null)
    try {
      const restoreResult = await backupService.restoreBackup(preview.backup, restoreMode)
      setResult(restoreResult)
      setMessage(restoreMode === 'replace' ? 'Backup restored successfully. Your local database now matches the selected backup.' : 'Backup merged successfully with the current local database.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restore failed. No partial restore should be kept because the operation is transactional.')
    } finally {
      setBusy(false)
    }
  }

  const requestPersistence = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const granted = await backupService.requestPersistentStorage()
      await refreshStorage()
      if (granted === true) setMessage('Persistent browser storage was granted for this app on this device.')
      else if (granted === false) setMessage('The browser did not grant persistent storage. Your data still works offline, but regular backups are especially important.')
      else setMessage('This browser does not expose a persistent-storage request. Regular backups are recommended.')
    } finally {
      setBusy(false)
    }
  }

  const clearPreview = () => {
    setPreview(null)
    setSelectedFileName('')
    setResult(null)
    setError('')
    setMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="page-stack backup-page">
      <div className="back-row"><button className="text-button" type="button" onClick={() => navigate('/trips')}>← My Trips</button></div>
      <PageIntro
        eyebrow="Data safety"
        title="Backup & Restore"
        description="Travel Planner is local-first. Export a complete versioned JSON backup so your trips are recoverable even if browser storage is cleared, the app is reinstalled, or you move to another device."
      />

      <section className="backup-safety-card">
        <div className="backup-section-heading">
          <div><span className="eyebrow">Local storage</span><h2>Know where your data lives</h2></div>
          <span className={`backup-health-pill ${storage?.persisted ? 'is-good' : ''}`}>{storage?.persisted ? 'Persistent' : 'Device-bound'}</span>
        </div>
        <p className="backup-copy">Your trip database is stored in this browser/PWA on this device. It is available offline, but it is not cloud-synced. Clearing site data, deleting browser data, or some device-storage cleanup can remove it unless you have a backup.</p>
        <div className="backup-metrics">
          <div><span>Persistence</span><strong>{storage === null ? 'Checking…' : storage.persisted === true ? 'Granted' : storage.supported ? 'Browser-managed' : 'Unavailable'}</strong></div>
          <div><span>App data</span><strong>{storage === null ? 'Checking…' : formatBytes(storage.usage)}</strong></div>
          <div><span>Storage quota</span><strong>{storage === null ? 'Checking…' : formatBytes(storage.quota)}</strong></div>
          <div><span>App version</span><strong>{overview?.appVersion ?? '…'}</strong></div>
        </div>
        {storage?.persisted !== true ? <div className="backup-inline-actions"><button className="button button--secondary" type="button" disabled={busy} onClick={requestPersistence}>Request persistent storage</button><small>The browser decides whether this request can be granted.</small></div> : null}
      </section>

      <section className="backup-card">
        <div className="backup-section-heading">
          <div><span className="eyebrow">Export</span><h2>Create a full backup</h2></div>
          <span className="backup-health-pill is-good">Schema v1</span>
        </div>
        <p className="backup-copy">Exports every IndexedDB table, including active records and soft-deleted history, so IDs and relationships remain intact during restore.</p>
        <div className="backup-metrics backup-metrics--compact">
          <div><span>Active trips</span><strong>{overview?.activeTrips ?? '…'}</strong></div>
          <div><span>Total records</span><strong>{overview?.totalRecords ?? '…'}</strong></div>
          <div><span>Tables</span><strong>18</strong></div>
        </div>
        <div className="backup-actions"><button className="button button--primary" type="button" disabled={busy || overview === undefined} onClick={exportBackup}>{busy ? 'Working…' : 'Export JSON backup'}</button></div>
      </section>

      <section className="backup-card">
        <div className="backup-section-heading">
          <div><span className="eyebrow">Import</span><h2>Validate before restore</h2></div>
          <span className="backup-health-pill">No silent changes</span>
        </div>
        <p className="backup-copy">Selecting a file only validates and previews it. The database is not changed until you explicitly confirm Restore.</p>
        <input
          ref={fileInputRef}
          className="backup-file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event: ChangeEvent<HTMLInputElement>) => void loadFile(event.target.files?.[0])}
        />
        <div className="backup-actions"><button className="button button--secondary" type="button" disabled={busy} onClick={chooseFile}>{preview ? 'Choose another backup' : 'Choose backup file'}</button>{preview ? <button className="text-button" type="button" onClick={clearPreview}>Clear</button> : null}</div>

        {preview ? (
          <div className="backup-preview">
            <div className="backup-preview__heading"><div><span>Validated backup</span><strong>{selectedFileName}</strong></div><span className="backup-health-pill is-good">Valid</span></div>
            <div className="backup-metrics">
              <div><span>Exported</span><strong>{formatExportDate(preview.backup.exportedAt)}</strong></div>
              <div><span>Backup app</span><strong>{preview.backup.appVersion}</strong></div>
              <div><span>Active trips</span><strong>{preview.activeTrips}</strong></div>
              <div><span>Records</span><strong>{preview.totalRecords}</strong></div>
            </div>
            {preview.warnings.length ? <div className="backup-warning-list">{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}

            <label className="field backup-mode-field"><span>Restore mode</span><select value={restoreMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRestoreMode(event.target.value as RestoreMode)}><option value="replace">Replace all local data</option><option value="merge">Merge with current data</option></select><small>{restoreMode === 'replace' ? 'Clears the current Travel Planner database, then restores this complete backup.' : 'Adds new IDs, overwrites matching IDs, and skips records that are already identical.'}</small></label>

            <div className={`backup-destructive-note ${restoreMode === 'replace' ? 'is-replace' : ''}`}><strong>{restoreMode === 'replace' ? 'Replace is destructive.' : 'Merge can overwrite matching IDs.'}</strong><span>{restoreMode === 'replace' ? 'Export your current data first if there is anything you may want to recover.' : 'The import is transactional, but make a backup first if you may want to undo the merge.'}</span></div>
            <div className="backup-actions"><button className="button button--primary" type="button" disabled={busy} onClick={restore}>{busy ? 'Restoring…' : 'Restore backup'}</button></div>
          </div>
        ) : null}
      </section>

      {result ? <section className="backup-result" aria-live="polite"><div><span>Created</span><strong>{result.created}</strong></div><div><span>Updated</span><strong>{result.updated}</strong></div><div><span>Skipped</span><strong>{result.skipped}</strong></div><div><span>Errors</span><strong>{result.errors}</strong></div></section> : null}
      {message ? <div className="status-banner" role="status"><span className="status-banner__dot" />{message}</div> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  )
}

export default DataBackupScreen
