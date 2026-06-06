import { openDB, type IDBPDatabase } from 'idb'
import type { TagRatingRecord, TagStats, TagPreference, FileRatingRecord } from '../../api/types'

const DB_NAME = 'hydrus-ui-v2'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tag-ratings')) {
        const store = db.createObjectStore('tag-ratings', { keyPath: 'id' })
        store.createIndex('tag', 'tag')
        store.createIndex('file_hash', 'file_hash')
        store.createIndex('timestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('file-ratings')) {
        const store = db.createObjectStore('file-ratings', { keyPath: 'file_id' })
        store.createIndex('timestamp', 'timestamp')
      }
    },
  })
  dbPromise = dbPromise.then(
    (db) => db,
    (e) => { dbPromise = null; throw e },
  )
  return dbPromise
}

export async function insertTagRatingRecord(record: TagRatingRecord): Promise<void> {
  const db = await getDb()
  await db.add('tag-ratings', record)
}

export async function insertTagRatingRecords(records: TagRatingRecord[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('tag-ratings', 'readwrite')
  for (const r of records) {
    await tx.store.add(r)
  }
  await tx.done
}

export async function getTagStats(minAppearances = 3): Promise<TagStats[]> {
  const db = await getDb()
  const records = await db.getAll('tag-ratings')
  const tagMap = new Map<string, TagRatingRecord[]>()

  for (const r of records) {
    const existing = tagMap.get(r.tag) || []
    existing.push(r)
    tagMap.set(r.tag, existing)
  }

  const stats: TagStats[] = []
  for (const [tag, tagRecords] of tagMap) {
    if (tagRecords.length < minAppearances) continue
    const sorted = tagRecords.sort((a, b) => a.timestamp - b.timestamp)
    const latest = sorted[sorted.length - 1]
    const smashCount = sorted.filter((r) => r.action === 'smash').length
    const passCount = sorted.filter((r) => r.action === 'pass').length
    const total = smashCount + passCount
    if (total === 0) continue
    stats.push({
      tag,
      count: total,
      smash_count: smashCount,
      pass_count: passCount,
      ratio: smashCount / total,
      current_mu: latest.mu_after,
      current_sigma: latest.sigma_after,
      current_rating: latest.mu_after - 3 * latest.sigma_after,
      history: sorted.map((r) => ({
        mu: r.mu_after,
        sigma: r.sigma_after,
        timestamp: r.timestamp,
      })),
    })
  }

  return stats.sort((a, b) => b.count - a.count)
}

export async function getTagHistory(tag: string): Promise<TagRatingRecord[]> {
  const db = await getDb()
  const index = db.transaction('tag-ratings').store.index('tag')
  const records = await index.getAll(tag)
  return records.sort((a, b) => a.timestamp - b.timestamp)
}

export async function clearTagHistory(): Promise<void> {
  const db = await getDb()
  await db.clear('tag-ratings')
}

export async function clearAllRatings(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear('file-ratings'),
    db.clear('tag-ratings'),
  ])
}

export async function getTotalRatedCount(): Promise<number> {
  const db = await getDb()
  return db.count('tag-ratings')
}

export async function upsertFileRating(record: FileRatingRecord): Promise<void> {
  const db = await getDb()
  await db.put('file-ratings', record)
}

export async function getFileRating(fileId: number): Promise<FileRatingRecord | undefined> {
  const db = await getDb()
  return db.get('file-ratings', fileId)
}

export async function getAllFileRatings(): Promise<FileRatingRecord[]> {
  const db = await getDb()
  return db.getAll('file-ratings')
}

export async function getTagPreferences(): Promise<TagPreference[]> {
  const db = await getDb()
  const records = await db.getAll('tag-ratings')
  const tagMap = new Map<string, { weight: number; smash: number; pass: number }>()

  for (const r of records) {
    const delta = r.mu_after - r.mu_before
    const prev = tagMap.get(r.tag) || { weight: 0, smash: 0, pass: 0 }
    prev.weight += delta
    if (r.action === 'smash') prev.smash++
    else if (r.action === 'pass') prev.pass++
    tagMap.set(r.tag, prev)
  }

  const prefs: TagPreference[] = []
  for (const [tag, data] of tagMap) {
    const total = data.smash + data.pass
    prefs.push({
      tag,
      weight: data.weight,
      appearances: total,
      avg_mu_change: total > 0 ? data.weight / total : 0,
      smash_count: data.smash,
      pass_count: data.pass,
    })
  }

  return prefs.sort((a, b) => b.weight - a.weight)
}
