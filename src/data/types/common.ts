export interface BaseRecord {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  revision: number
}

export type CurrencyCode = string
