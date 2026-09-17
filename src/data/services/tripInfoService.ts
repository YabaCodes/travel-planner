import { db } from '../db'
import type { BaseRecord } from '../types/common'
import type { Trip, TripInfoItem, TripInfoSection, TripInfoValueType } from '../types/entities'
import { createRecordMetadata, softDeleteRecord, touchRecord } from '../utils/record'

const active = <T extends BaseRecord>(records: T[]): T[] => records.filter((record) => record.deleted_at === null)

export interface TripInfoSectionView {
  section: TripInfoSection
  items: TripInfoItem[]
}

export interface TripInfoOverview {
  trip: Trip
  sections: TripInfoSectionView[]
  counts: {
    sections: number
    items: number
  }
}

export interface TripInfoSectionDraft {
  title: string
}

export interface TripInfoItemDraft {
  sectionId: string
  label: string
  value: string
  type: TripInfoValueType
}

export interface TripInfoSectionEditorData {
  trip: Trip
  section: TripInfoSection | null
}

export interface TripInfoItemEditorData {
  trip: Trip
  sections: TripInfoSection[]
  item: TripInfoItem | null
}

const getTrip = async (tripId: string) => {
  const trip = await db.trips.get(tripId)
  return trip && !trip.deleted_at ? trip : null
}

const normalizeValue = (value: string, type: TripInfoValueType) => {
  const clean = value.trim()
  if (!clean) throw new Error('Value is required.')

  if (type === 'url') {
    const withProtocol = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`
    try {
      const parsed = new URL(withProtocol)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      return parsed.toString()
    } catch {
      throw new Error('Enter a valid web address.')
    }
  }

  if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error('Date must use YYYY-MM-DD format.')
  if (type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) throw new Error('Time must use HH:MM format.')
  if (type === 'number' && !Number.isFinite(Number(clean))) throw new Error('Enter a valid number.')
  return clean
}

const requireSection = async (tripId: string, sectionId: string) => {
  const section = await db.tripInfoSections.get(sectionId)
  if (!section || section.deleted_at || section.trip_id !== tripId) throw new Error('Choose a valid Trip Info section.')
  return section
}

export const tripInfoService = {
  async getOverview(tripId: string): Promise<TripInfoOverview | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null
    const sections = active(await db.tripInfoSections.where('trip_id').equals(tripId).toArray()).sort((a, b) => a.position - b.position)
    const sectionIds = sections.map((section) => section.id)
    const items = sectionIds.length ? active(await db.tripInfoItems.where('section_id').anyOf(sectionIds).toArray()) : []

    return {
      trip,
      sections: sections.map((section) => ({
        section,
        items: items.filter((item) => item.section_id === section.id).sort((a, b) => a.position - b.position),
      })),
      counts: { sections: sections.length, items: items.length },
    }
  },

  async getSectionEditorData(tripId: string, sectionId?: string): Promise<TripInfoSectionEditorData | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null
    if (!sectionId) return { trip, section: null }
    const section = await db.tripInfoSections.get(sectionId)
    if (!section || section.deleted_at || section.trip_id !== tripId) return { trip, section: null }
    return { trip, section }
  },

  async getItemEditorData(tripId: string, itemId?: string): Promise<TripInfoItemEditorData | null> {
    const trip = await getTrip(tripId)
    if (!trip) return null
    const sections = active(await db.tripInfoSections.where('trip_id').equals(tripId).toArray()).sort((a, b) => a.position - b.position)
    if (!itemId) return { trip, sections, item: null }
    const item = await db.tripInfoItems.get(itemId)
    if (!item || item.deleted_at || !sections.some((section) => section.id === item.section_id)) return { trip, sections, item: null }
    return { trip, sections, item }
  },

  async createSection(tripId: string, draft: TripInfoSectionDraft): Promise<string> {
    const trip = await getTrip(tripId)
    if (!trip) throw new Error('Trip not found.')
    const title = draft.title.trim()
    if (!title) throw new Error('Section title is required.')
    const siblings = active(await db.tripInfoSections.where('trip_id').equals(tripId).toArray())
    const position = siblings.reduce((max, section) => Math.max(max, section.position), 0) + 100
    const section: TripInfoSection = { ...createRecordMetadata(), trip_id: tripId, title, position }
    await db.tripInfoSections.add(section)
    return section.id
  },

  async updateSection(tripId: string, sectionId: string, draft: TripInfoSectionDraft) {
    const section = await requireSection(tripId, sectionId)
    const title = draft.title.trim()
    if (!title) throw new Error('Section title is required.')
    await db.tripInfoSections.put(touchRecord({ ...section, title }))
  },

  async softDeleteSection(tripId: string, sectionId: string) {
    const section = await requireSection(tripId, sectionId)
    const items = active(await db.tripInfoItems.where('section_id').equals(sectionId).toArray())
    await db.transaction('rw', [db.tripInfoSections, db.tripInfoItems], async () => {
      await db.tripInfoSections.put(softDeleteRecord(section))
      if (items.length) await db.tripInfoItems.bulkPut(items.map(softDeleteRecord))
    })
  },

  async moveSectionByOffset(tripId: string, sectionId: string, offset: -1 | 1) {
    const sections = active(await db.tripInfoSections.where('trip_id').equals(tripId).toArray()).sort((a, b) => a.position - b.position)
    const index = sections.findIndex((section) => section.id === sectionId)
    const targetIndex = index + offset
    if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) return
    const current = sections[index]
    const other = sections[targetIndex]
    await db.transaction('rw', db.tripInfoSections, async () => {
      await db.tripInfoSections.put(touchRecord({ ...current, position: other.position }))
      await db.tripInfoSections.put(touchRecord({ ...other, position: current.position }))
    })
  },

  async createItem(tripId: string, draft: TripInfoItemDraft): Promise<string> {
    const section = await requireSection(tripId, draft.sectionId)
    const label = draft.label.trim()
    if (!label) throw new Error('Label is required.')
    const value = normalizeValue(draft.value, draft.type)
    const siblings = active(await db.tripInfoItems.where('section_id').equals(section.id).toArray())
    const position = siblings.reduce((max, item) => Math.max(max, item.position), 0) + 100
    const item: TripInfoItem = { ...createRecordMetadata(), section_id: section.id, label, value, type: draft.type, position }
    await db.tripInfoItems.add(item)
    return item.id
  },

  async updateItem(tripId: string, itemId: string, draft: TripInfoItemDraft) {
    const item = await db.tripInfoItems.get(itemId)
    if (!item || item.deleted_at) throw new Error('Trip Info item not found.')
    const currentSection = await requireSection(tripId, item.section_id)
    void currentSection
    const targetSection = await requireSection(tripId, draft.sectionId)
    const label = draft.label.trim()
    if (!label) throw new Error('Label is required.')
    const value = normalizeValue(draft.value, draft.type)
    let position = item.position
    if (targetSection.id !== item.section_id) {
      const siblings = active(await db.tripInfoItems.where('section_id').equals(targetSection.id).toArray())
      position = siblings.reduce((max, sibling) => Math.max(max, sibling.position), 0) + 100
    }
    await db.tripInfoItems.put(touchRecord({ ...item, section_id: targetSection.id, label, value, type: draft.type, position }))
  },

  async softDeleteItem(tripId: string, itemId: string) {
    const item = await db.tripInfoItems.get(itemId)
    if (!item || item.deleted_at) return
    await requireSection(tripId, item.section_id)
    await db.tripInfoItems.put(softDeleteRecord(item))
  },

  async moveItemByOffset(tripId: string, itemId: string, offset: -1 | 1) {
    const item = await db.tripInfoItems.get(itemId)
    if (!item || item.deleted_at) return
    await requireSection(tripId, item.section_id)
    const items = active(await db.tripInfoItems.where('section_id').equals(item.section_id).toArray()).sort((a, b) => a.position - b.position)
    const index = items.findIndex((candidate) => candidate.id === itemId)
    const targetIndex = index + offset
    if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return
    const other = items[targetIndex]
    await db.transaction('rw', db.tripInfoItems, async () => {
      await db.tripInfoItems.put(touchRecord({ ...item, position: other.position }))
      await db.tripInfoItems.put(touchRecord({ ...other, position: item.position }))
    })
  },
}
