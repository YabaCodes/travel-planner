import { db } from '../db'
import packageJson from '../../../package.json'

export const BACKUP_FORMAT = 'travel-planner-backup'
export const BACKUP_SCHEMA_VERSION = 1
export const BACKUP_DATABASE_VERSION = 1
export const BACKUP_APP_VERSION = packageJson.version

export const BACKUP_TABLE_NAMES = [
  'travelProfiles',
  'trips',
  'tripPreferences',
  'travelers',
  'tripDestinations',
  'tripDays',
  'places',
  'tripPlaces',
  'activities',
  'transportSegments',
  'travelLegs',
  'stays',
  'bookings',
  'packingLists',
  'packingCategories',
  'packingItems',
  'tripInfoSections',
  'tripInfoItems',
] as const

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number]
export type RestoreMode = 'replace' | 'merge'

type BackupRecord = { id: string; [key: string]: unknown }
type BackupTables = Record<BackupTableName, BackupRecord[]>

export interface TravelPlannerBackup {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  appVersion: string
  exportedAt: string
  database: {
    name: 'TravelPlannerDB'
    version: number
  }
  recordCounts: Record<BackupTableName, number>
  totalRecords: number
  tables: BackupTables
}

export interface BackupPreview {
  backup: TravelPlannerBackup
  totalRecords: number
  activeTrips: number
  tableCounts: Record<BackupTableName, number>
  warnings: string[]
}

export interface RestoreResult {
  mode: RestoreMode
  created: number
  updated: number
  skipped: number
  errors: number
  total: number
  perTable: Record<BackupTableName, { created: number; updated: number; skipped: number }>
}

export interface BackupOverview {
  appVersion: string
  totalRecords: number
  activeTrips: number
  tableCounts: Record<BackupTableName, number>
}

export interface StorageHealth {
  supported: boolean
  persisted: boolean | null
  usage: number | null
  quota: number | null
}

const emptyTables = (): BackupTables => Object.fromEntries(BACKUP_TABLE_NAMES.map((name) => [name, []])) as unknown as BackupTables
const emptyCounts = (): Record<BackupTableName, number> => Object.fromEntries(BACKUP_TABLE_NAMES.map((name) => [name, 0])) as Record<BackupTableName, number>

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const assertRecord = (value: unknown, tableName: BackupTableName, index: number): BackupRecord => {
  if (!isObject(value)) throw new Error(`Backup table “${tableName}” contains an invalid record at position ${index + 1}.`)
  if (typeof value.id !== 'string' || !value.id.trim()) throw new Error(`Backup table “${tableName}” contains a record without a valid id.`)
  return value as BackupRecord
}

const assertReferences = (tables: BackupTables) => {
  const ids: Record<string, Set<string>> = {}
  BACKUP_TABLE_NAMES.forEach((name) => { ids[name] = new Set(tables[name].map((record) => record.id)) })

  const ref = (record: BackupRecord, field: string, target: BackupTableName, source: BackupTableName) => {
    const value = record[field]
    if (value === null || value === undefined || value === '') return
    if (typeof value !== 'string' || !ids[target].has(value)) {
      throw new Error(`Backup relationship error: ${source}.${field} points to a missing ${target} record.`)
    }
  }

  tables.tripPreferences.forEach((record) => ref(record, 'trip_id', 'trips', 'tripPreferences'))
  tables.travelers.forEach((record) => ref(record, 'trip_id', 'trips', 'travelers'))
  tables.tripDestinations.forEach((record) => ref(record, 'trip_id', 'trips', 'tripDestinations'))
  tables.tripDays.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'tripDays')
    ref(record, 'destination_id', 'tripDestinations', 'tripDays')
  })
  tables.tripPlaces.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'tripPlaces')
    ref(record, 'place_id', 'places', 'tripPlaces')
  })
  tables.activities.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'activities')
    ref(record, 'trip_day_id', 'tripDays', 'activities')
    ref(record, 'trip_place_id', 'tripPlaces', 'activities')
  })
  tables.transportSegments.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'transportSegments')
    ref(record, 'trip_day_id', 'tripDays', 'transportSegments')
    ref(record, 'from_activity_id', 'activities', 'transportSegments')
    ref(record, 'to_activity_id', 'activities', 'transportSegments')
    ref(record, 'from_place_id', 'places', 'transportSegments')
    ref(record, 'to_place_id', 'places', 'transportSegments')
  })
  tables.travelLegs.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'travelLegs')
    ref(record, 'from_destination_id', 'tripDestinations', 'travelLegs')
    ref(record, 'to_destination_id', 'tripDestinations', 'travelLegs')
    ref(record, 'booking_id', 'bookings', 'travelLegs')
  })
  tables.stays.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'stays')
    ref(record, 'destination_id', 'tripDestinations', 'stays')
    ref(record, 'place_id', 'places', 'stays')
    ref(record, 'booking_id', 'bookings', 'stays')
  })
  tables.bookings.forEach((record) => {
    ref(record, 'trip_id', 'trips', 'bookings')
    ref(record, 'activity_id', 'activities', 'bookings')
    ref(record, 'stay_id', 'stays', 'bookings')
    ref(record, 'travel_leg_id', 'travelLegs', 'bookings')
  })
  tables.packingLists.forEach((record) => ref(record, 'trip_id', 'trips', 'packingLists'))
  tables.packingCategories.forEach((record) => ref(record, 'packing_list_id', 'packingLists', 'packingCategories'))
  tables.packingItems.forEach((record) => {
    ref(record, 'packing_list_id', 'packingLists', 'packingItems')
    ref(record, 'category_id', 'packingCategories', 'packingItems')
  })
  tables.tripInfoSections.forEach((record) => ref(record, 'trip_id', 'trips', 'tripInfoSections'))
  tables.tripInfoItems.forEach((record) => ref(record, 'section_id', 'tripInfoSections', 'tripInfoItems'))
}

const validateBackupObject = (value: unknown): TravelPlannerBackup => {
  if (!isObject(value)) throw new Error('This file is not a valid Travel Planner backup.')
  if (value.format !== BACKUP_FORMAT) throw new Error('This JSON file is not a Travel Planner backup.')
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schema version ${String(value.schemaVersion)}. This app supports schema version ${BACKUP_SCHEMA_VERSION}.`)
  }
  if (typeof value.appVersion !== 'string' || !value.appVersion) throw new Error('Backup metadata is missing the app version.')
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) throw new Error('Backup metadata contains an invalid export date.')
  if (!isObject(value.database) || value.database.name !== 'TravelPlannerDB' || value.database.version !== BACKUP_DATABASE_VERSION) {
    throw new Error('Backup database metadata is not compatible with this version of Travel Planner.')
  }
  if (!isObject(value.tables)) throw new Error('Backup data tables are missing.')

  const tables = emptyTables()
  for (const tableName of BACKUP_TABLE_NAMES) {
    const raw = value.tables[tableName]
    if (!Array.isArray(raw)) throw new Error(`Backup table “${tableName}” is missing or invalid.`)
    const seen = new Set<string>()
    tables[tableName] = raw.map((item, index) => {
      const record = assertRecord(item, tableName, index)
      if (seen.has(record.id)) throw new Error(`Backup table “${tableName}” contains duplicate id ${record.id}.`)
      seen.add(record.id)
      return record
    })
  }

  assertReferences(tables)
  const recordCounts = emptyCounts()
  BACKUP_TABLE_NAMES.forEach((name) => { recordCounts[name] = tables[name].length })
  const totalRecords = BACKUP_TABLE_NAMES.reduce((sum, name) => sum + recordCounts[name], 0)

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: value.appVersion,
    exportedAt: value.exportedAt,
    database: { name: 'TravelPlannerDB', version: BACKUP_DATABASE_VERSION },
    recordCounts,
    totalRecords,
    tables,
  }
}

const sameRecord = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

export const backupService = {
  async getOverview(): Promise<BackupOverview> {
    const tableCounts = emptyCounts()
    await Promise.all(BACKUP_TABLE_NAMES.map(async (name) => {
      tableCounts[name] = await db.table(name).count()
    }))
    const trips = await db.trips.toArray()
    return {
      appVersion: BACKUP_APP_VERSION,
      tableCounts,
      totalRecords: BACKUP_TABLE_NAMES.reduce((sum, name) => sum + tableCounts[name], 0),
      activeTrips: trips.filter((trip: { deleted_at: string | null }) => !trip.deleted_at).length,
    }
  },

  async createBackup(): Promise<TravelPlannerBackup> {
    const tables = emptyTables()
    await Promise.all(BACKUP_TABLE_NAMES.map(async (name) => {
      tables[name] = (await db.table(name).toArray()) as BackupRecord[]
    }))
    const recordCounts = emptyCounts()
    BACKUP_TABLE_NAMES.forEach((name) => { recordCounts[name] = tables[name].length })
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: BACKUP_APP_VERSION,
      exportedAt: new Date().toISOString(),
      database: { name: 'TravelPlannerDB', version: BACKUP_DATABASE_VERSION },
      recordCounts,
      totalRecords: BACKUP_TABLE_NAMES.reduce((sum, name) => sum + recordCounts[name], 0),
      tables,
    }
  },

  serializeBackup(backup: TravelPlannerBackup) {
    return JSON.stringify(backup, null, 2)
  },

  fileNameFor(backup: TravelPlannerBackup) {
    const date = backup.exportedAt.slice(0, 10)
    return `travel-planner-backup-${date}.json`
  },

  parseBackup(text: string): BackupPreview {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('The selected file is not valid JSON.')
    }
    const backup = validateBackupObject(parsed)
    const unknownTables = isObject(parsed) && isObject(parsed.tables)
      ? Object.keys(parsed.tables).filter((name) => !BACKUP_TABLE_NAMES.includes(name as BackupTableName))
      : []
    const warnings: string[] = []
    if (backup.appVersion !== BACKUP_APP_VERSION) warnings.push(`Backup was created by app version ${backup.appVersion}; current app version is ${BACKUP_APP_VERSION}.`)
    if (unknownTables.length) warnings.push(`Backup contains ${unknownTables.length} newer or unknown table${unknownTables.length === 1 ? '' : 's'} that this version will not restore.`)
    return {
      backup,
      totalRecords: backup.totalRecords,
      activeTrips: backup.tables.trips.filter((record) => record.deleted_at === null || record.deleted_at === undefined).length,
      tableCounts: backup.recordCounts,
      warnings,
    }
  },

  async restoreBackup(backupInput: TravelPlannerBackup, mode: RestoreMode): Promise<RestoreResult> {
    const backup = validateBackupObject(backupInput)
    const perTable = Object.fromEntries(BACKUP_TABLE_NAMES.map((name) => [name, { created: 0, updated: 0, skipped: 0 }])) as RestoreResult['perTable']

    await db.transaction('rw', db.tables, async () => {
      if (mode === 'replace') {
        for (const table of db.tables) await table.clear()
        for (const name of BACKUP_TABLE_NAMES) {
          const records = backup.tables[name]
          if (records.length) await db.table(name).bulkPut(records)
          perTable[name].created = records.length
        }
        return
      }

      for (const name of BACKUP_TABLE_NAMES) {
        const records = backup.tables[name]
        if (!records.length) continue
        const table = db.table(name)
        const existing = await table.bulkGet(records.map((record) => record.id))
        records.forEach((record, index) => {
          const current = existing[index]
          if (current === undefined) perTable[name].created += 1
          else if (sameRecord(current, record)) perTable[name].skipped += 1
          else perTable[name].updated += 1
        })
        await table.bulkPut(records)
      }
    })

    if (mode === 'replace') localStorage.removeItem('lastOpenedTripId')
    const created = BACKUP_TABLE_NAMES.reduce((sum, name) => sum + perTable[name].created, 0)
    const updated = BACKUP_TABLE_NAMES.reduce((sum, name) => sum + perTable[name].updated, 0)
    const skipped = BACKUP_TABLE_NAMES.reduce((sum, name) => sum + perTable[name].skipped, 0)
    return { mode, created, updated, skipped, errors: 0, total: created + updated + skipped, perTable }
  },

  async getStorageHealth(): Promise<StorageHealth> {
    if (!('storage' in navigator) || !navigator.storage) return { supported: false, persisted: null, usage: null, quota: null }
    const [persisted, estimate] = await Promise.all([
      navigator.storage.persisted ? navigator.storage.persisted().catch(() => null) : Promise.resolve(null),
      navigator.storage.estimate ? navigator.storage.estimate().catch(() => ({ usage: undefined, quota: undefined })) : Promise.resolve({ usage: undefined, quota: undefined }),
    ])
    return {
      supported: true,
      persisted,
      usage: typeof estimate.usage === 'number' ? estimate.usage : null,
      quota: typeof estimate.quota === 'number' ? estimate.quota : null,
    }
  },

  async requestPersistentStorage(): Promise<boolean | null> {
    if (!('storage' in navigator) || !navigator.storage?.persist) return null
    try {
      return await navigator.storage.persist()
    } catch {
      return false
    }
  },
}
