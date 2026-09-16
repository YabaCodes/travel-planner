import type { BaseRecord } from '../types/common'

export const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const nowIso = () => new Date().toISOString()

export const createRecordMetadata = (): BaseRecord => {
  const now = nowIso()
  return {
    id: createId(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    revision: 1,
  }
}

export const touchRecord = <T extends BaseRecord>(record: T): T => ({
  ...record,
  updated_at: nowIso(),
  revision: record.revision + 1,
})

export const softDeleteRecord = <T extends BaseRecord>(record: T): T => ({
  ...touchRecord(record),
  deleted_at: nowIso(),
})
