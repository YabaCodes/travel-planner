import { db } from '../db'
import type { BaseRecord } from '../types/common'
import type { PackingCategory, PackingItem, PackingList, Trip } from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'

export const DEFAULT_PACKING_CATEGORIES = [
  'Documents',
  'Clothing',
  'Electronics',
  'Toiletries',
  'Health',
  'Day Bag',
  'Travel Gear',
  'Other',
] as const

export interface PackingCategoryView {
  category: PackingCategory
  items: PackingItem[]
}

export interface PackingOverview {
  trip: Trip
  list: PackingList
  categories: PackingCategoryView[]
  counts: {
    items: number
    totalQuantity: number
    packedQuantity: number
    unpackedQuantity: number
    requiredItems: number
    requiredPackedItems: number
    requiredRemaining: number
    percentage: number
  }
}

export interface PackingItemDraft {
  categoryId: string
  name: string
  quantity: number
  packedQuantity: number
  required: boolean
  notes: string | null
}

export interface PackingItemEditorData {
  trip: Trip
  list: PackingList
  categories: PackingCategory[]
  item: PackingItem | null
}

const active = <T extends BaseRecord>(records: T[]) => records.filter((record) => record.deleted_at === null)

const normalizeQuantity = (value: number) => {
  if (!Number.isFinite(value)) return 1
  return Math.min(999, Math.max(1, Math.round(value)))
}

const normalizePackedQuantity = (value: number, quantity: number) => {
  if (!Number.isFinite(value)) return 0
  return Math.min(quantity, Math.max(0, Math.round(value)))
}

const createDefaultCategories = (listId: string): PackingCategory[] =>
  DEFAULT_PACKING_CATEGORIES.map((name, index) => ({
    ...createRecordMetadata(),
    packing_list_id: listId,
    name,
    position: (index + 1) * 100,
  }))

const ensurePackingList = async (tripId: string): Promise<PackingList> => {
  const existing = active(await db.packingLists.where('trip_id').equals(tripId).toArray())
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]

  if (existing) {
    const categories = active(await db.packingCategories.where('packing_list_id').equals(existing.id).toArray())
    if (categories.length === 0) await db.packingCategories.bulkAdd(createDefaultCategories(existing.id))
    return existing
  }

  return db.transaction('rw', [db.packingLists, db.packingCategories], async () => {
    const concurrent = active(await db.packingLists.where('trip_id').equals(tripId).toArray())
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    if (concurrent) return concurrent

    const list: PackingList = {
      ...createRecordMetadata(),
      trip_id: tripId,
      title: 'Packing List',
    }
    await db.packingLists.add(list)
    await db.packingCategories.bulkAdd(createDefaultCategories(list.id))
    return list
  })
}

const getTrip = async (tripId: string) => {
  const trip = await db.trips.get(tripId)
  return trip && !trip.deleted_at ? trip : null
}

const validateDraft = async (list: PackingList, draft: PackingItemDraft) => {
  const category = await db.packingCategories.get(draft.categoryId)
  if (!category || category.deleted_at || category.packing_list_id !== list.id) throw new Error('Choose a valid packing category.')
  if (!draft.name.trim()) throw new Error('Item name is required.')

  const quantity = normalizeQuantity(draft.quantity)
  return {
    category,
    quantity,
    packedQuantity: normalizePackedQuantity(draft.packedQuantity, quantity),
    name: draft.name.trim(),
    notes: draft.notes?.trim() || null,
  }
}

export const packingService = {
  async getOverview(tripId: string): Promise<PackingOverview | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null

    const list = await ensurePackingList(tripId)
    const [categoryRecords, itemRecords] = await Promise.all([
      db.packingCategories.where('packing_list_id').equals(list.id).toArray(),
      db.packingItems.where('packing_list_id').equals(list.id).toArray(),
    ])

    const categories = active(categoryRecords).sort((a, b) => a.position - b.position)
    const items = active(itemRecords)
    const categoryViews = categories.map((category) => ({
      category,
      items: items.filter((item) => item.category_id === category.id).sort((a, b) => a.position - b.position),
    }))

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    const packedQuantity = items.reduce((sum, item) => sum + Math.min(item.quantity, item.packed_quantity), 0)
    const required = items.filter((item) => item.required)
    const requiredPackedItems = required.filter((item) => item.packed_quantity >= item.quantity).length

    return {
      trip,
      list,
      categories: categoryViews,
      counts: {
        items: items.length,
        totalQuantity,
        packedQuantity,
        unpackedQuantity: Math.max(0, totalQuantity - packedQuantity),
        requiredItems: required.length,
        requiredPackedItems,
        requiredRemaining: Math.max(0, required.length - requiredPackedItems),
        percentage: totalQuantity ? Math.round((packedQuantity / totalQuantity) * 100) : 0,
      },
    }
  },

  async getItemEditorData(tripId: string, itemId?: string): Promise<PackingItemEditorData | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null
    const list = await ensurePackingList(tripId)
    const categories = active(await db.packingCategories.where('packing_list_id').equals(list.id).toArray()).sort((a, b) => a.position - b.position)

    if (!itemId) return { trip, list, categories, item: null }
    const item = await db.packingItems.get(itemId)
    if (!item || item.deleted_at || item.packing_list_id !== list.id) return { trip, list, categories, item: null }
    return { trip, list, categories, item }
  },

  async createItem(tripId: string, draft: PackingItemDraft): Promise<string> {
    const trip = await getTrip(tripId)
    if (!trip) throw new Error('Trip not found.')
    const list = await ensurePackingList(tripId)
    const validated = await validateDraft(list, draft)
    const siblings = active(await db.packingItems.where('category_id').equals(validated.category.id).toArray())
    const maxPosition = siblings.reduce((max, item) => Math.max(max, item.position), 0)

    const item: PackingItem = {
      ...createRecordMetadata(),
      packing_list_id: list.id,
      category_id: validated.category.id,
      name: validated.name,
      quantity: validated.quantity,
      packed_quantity: validated.packedQuantity,
      required: draft.required,
      position: maxPosition + 100,
      notes: validated.notes,
    }
    await db.packingItems.add(item)
    return item.id
  },

  async updateItem(tripId: string, itemId: string, draft: PackingItemDraft) {
    const trip = await getTrip(tripId)
    if (!trip) throw new Error('Trip not found.')
    const list = await ensurePackingList(tripId)
    const item = await db.packingItems.get(itemId)
    if (!item || item.deleted_at || item.packing_list_id !== list.id) throw new Error('Packing item not found.')

    const validated = await validateDraft(list, draft)
    let position = item.position
    if (item.category_id !== validated.category.id) {
      const siblings = active(await db.packingItems.where('category_id').equals(validated.category.id).toArray())
      position = siblings.reduce((max, sibling) => Math.max(max, sibling.position), 0) + 100
    }

    await db.packingItems.put(touchRecord({
      ...item,
      category_id: validated.category.id,
      name: validated.name,
      quantity: validated.quantity,
      packed_quantity: validated.packedQuantity,
      required: draft.required,
      position,
      notes: validated.notes,
    }))
  },

  async setPackedQuantity(itemId: string, packedQuantity: number) {
    const item = await db.packingItems.get(itemId)
    if (!item || item.deleted_at) return
    await db.packingItems.put(touchRecord({
      ...item,
      packed_quantity: normalizePackedQuantity(packedQuantity, item.quantity),
    }))
  },

  async togglePacked(itemId: string) {
    const item = await db.packingItems.get(itemId)
    if (!item || item.deleted_at) return
    const fullyPacked = item.packed_quantity >= item.quantity
    await db.packingItems.put(touchRecord({ ...item, packed_quantity: fullyPacked ? 0 : item.quantity }))
  },

  async resetPacked(tripId: string) {
    const list = active(await db.packingLists.where('trip_id').equals(tripId).toArray())[0]
    if (!list) return
    const items = active(await db.packingItems.where('packing_list_id').equals(list.id).toArray())
    const changed = items.filter((item) => item.packed_quantity !== 0).map((item) => touchRecord({ ...item, packed_quantity: 0 }))
    if (changed.length) await db.packingItems.bulkPut(changed)
  },

  async softDeleteItem(itemId: string) {
    const item = await db.packingItems.get(itemId)
    if (!item || item.deleted_at) return
    await db.packingItems.put(softDeleteRecord(item))
  },
}
