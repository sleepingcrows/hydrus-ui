import { useState, useEffect, useRef } from 'react'
import { searchFiles, fetchFileMetadataByIds, getFileUrl } from '../../api/search'
import { setRating } from '../../api/ratings'
import type { FileMetadata } from '../../api/types'
import { SERVICE_TYPE } from '../../api/types'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { useSettingsStore } from '../../stores/settings-store'
import { useMobile } from '../../hooks/use-mobile'
import { FileRenderer, isUnsupportedMime } from '../../components/FileRenderer'
import { TagSearch } from '../search/TagSearch'

const ELO_DIST_CACHE_KEY = 'hydrus-placement-elo-dist'
const ELO_DIST_TTL = 30 * 60 * 1000

type Phase = 'idle' | 'loading-queue' | 'loading-index' | 'voting' | 'result' | 'done'

interface RankedEntry {
  fileId: number
  hash: string
  mime: string
  elo: number
  tags: string[]
}

interface PlacementMatchup {
  opponentFile: FileMetadata
  opponentElo: number
  tagOverlap: number
  won: boolean | null
}

interface PlacementResult {
  fileId: number
  fileHash: string
  wins: number
  total: number
  placementElo: number
  percentile: number
  bracket: string
}

interface EloDistCache {
  elos: number[]
  timestamp: number
}

function getAllKnownTags(file: FileMetadata): string[] {
  if (!file.tags) return []
  for (const entry of Object.values(file.tags)) {
    if (entry.type === 10) return entry.display_tags?.['0'] ?? []
  }
  return []
}

function computeBracket(percentile: number): string {
  if (percentile >= 95) return 'S'
  if (percentile >= 80) return 'A'
  if (percentile >= 60) return 'B'
  if (percentile >= 40) return 'C'
  if (percentile >= 20) return 'D'
  return 'F'
}

function computePercentile(elo: number, distribution: number[]): number {
  if (distribution.length === 0) return 50
  const below = distribution.filter((e) => e <= elo).length
  return Math.round((below / distribution.length) * 100)
}

function computePlacementElo(matchups: PlacementMatchup[]): number {
  const valid = matchups.filter((m) => m.won !== null)
  if (valid.length === 0) return 0
  const totalOpponentElo = valid.reduce((sum, m) => sum + m.opponentElo, 0)
  const beaten = valid.filter((m) => m.won)
  if (beaten.length === 0) {
    const avg = totalOpponentElo / valid.length
    return Math.max(1, Math.round(avg * 0.25))
  }
  const avgBeatenElo = beaten.reduce((sum, m) => sum + m.opponentElo, 0) / beaten.length
  if (beaten.length === valid.length) {
    return Math.round(avgBeatenElo * 1.2)
  }
  return Math.max(1, Math.round(avgBeatenElo))
}

function loadDistFromCache(): number[] | null {
  try {
    const raw = localStorage.getItem(ELO_DIST_CACHE_KEY)
    if (!raw) return null
    const cached: EloDistCache = JSON.parse(raw)
    if (Date.now() - cached.timestamp > ELO_DIST_TTL) return null
    return cached.elos
  } catch {
    return null
  }
}

function saveDistToCache(elos: number[]) {
  try {
    const cached: EloDistCache = { elos, timestamp: Date.now() }
    localStorage.setItem(ELO_DIST_CACHE_KEY, JSON.stringify(cached))
  } catch {}
}

function buildDistFromRatingsCache(ratingServiceKey: string): number[] | null {
  const cache = useSettingsStore.getState().getRatingsCache()
  if (!cache || cache.size === 0) return null
  const elos: number[] = []
  for (const [, ratings] of cache) {
    const v = ratings[ratingServiceKey]
    if (typeof v === 'number' && v > 0) elos.push(v)
  }
  if (elos.length < 10) return null
  elos.sort((a, b) => a - b)
  return elos
}

function tagsFromMeta(file: FileMetadata): string[] {
  if (!file.tags) return []
  for (const entry of Object.values(file.tags)) {
    if (entry.type === 10) return entry.display_tags?.['0'] ?? []
  }
  return []
}

export function PlacementMatch() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [unrankedQueue, setUnrankedQueue] = useState<FileMetadata[]>([])
  const [currentFile, setCurrentFile] = useState<FileMetadata | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [matchups, setMatchups] = useState<PlacementMatchup[]>([])
  const [currentMatchupIdx, setCurrentMatchupIdx] = useState(0)
  const [opponentUrl, setOpponentUrl] = useState<string | null>(null)
  const [result, setResult] = useState<PlacementResult | null>(null)
  const [completedResults, setCompletedResults] = useState<PlacementResult[]>([])
  const [leaderboardElos, setLeaderboardElos] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)

  const placementTags = useSettingsStore((s) => s.placementTags)
  const setPlacementTags = useSettingsStore((s) => s.setPlacementTags)
  const opponentCount = useSettingsStore((s) => s.placementOpponentCount)
  const configuredKey = useSettingsStore((s) => s.ratingServiceKey)
  const services = useRatingServicesStore((s) => s.services)
  const ratingServiceKey = (configuredKey || services.find((rs) => rs.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key) ?? null
  const { isMobile, orientation } = useMobile()
  const [tagVersion, setTagVersion] = useState(0)

  const currentFileRef = useRef<FileMetadata | null>(null)
  const placementRoundRef = useRef(0)
  const rankedIndexRef = useRef<Map<number, RankedEntry> | null>(null)
  const distFetchedRef = useRef(false)

  async function ensureRankedIndex(): Promise<number[]> {
    const distCached = loadDistFromCache()
    if (distCached && rankedIndexRef.current) {
      setLeaderboardElos(distCached)
      return distCached
    }

    if (distCached && !rankedIndexRef.current) {
      setLeaderboardElos(distCached)
      distFetchedRef.current = true
      return distCached
    }

    const fromCache = ratingServiceKey ? buildDistFromRatingsCache(ratingServiceKey) : null
    if (fromCache && fromCache.length >= 10) {
      saveDistToCache(fromCache)
      setLeaderboardElos(fromCache)
      distFetchedRef.current = true
      return fromCache
    }

    if (!ratingServiceKey) return []

    setPhase('loading-index')
    setProgressMsg('Building ranked file index (one-time load)...')

    try {
      const result = await searchFiles({ tags: ['system:has count for skill'], file_limit: 3000 })
      const ids = result.file_ids ?? []
      if (ids.length === 0) return []

      const index = new Map<number, RankedEntry>()
      const elos: number[] = []

      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        setProgressMsg(`Loading ranked files (${Math.min(i + 500, ids.length)}/${ids.length})...`)
        const meta = await fetchFileMetadataByIds(chunk)
        for (const f of meta) {
          const v = f.ratings?.[ratingServiceKey]
          if (typeof v === 'number' && v > 0) {
            elos.push(v)
            index.set(f.file_id, {
              fileId: f.file_id,
              hash: f.hash,
              mime: f.mime,
              elo: v,
              tags: tagsFromMeta(f),
            })
          }
        }
      }

      if (index.size < 10) {
        setPhase('idle')
        setError('Not enough ranked files found in the database. Place some ratings first via Smash/Pass.')
        setProgressMsg(null)
        return []
      }

      elos.sort((a, b) => a - b)
      rankedIndexRef.current = index
      setLeaderboardElos(elos)
      saveDistToCache(elos)
      distFetchedRef.current = true
      setProgressMsg(null)
      return elos
    } catch (e) {
      setPhase('idle')
      setError(String(e))
      setProgressMsg(null)
      return []
    }
  }

  function findOpponentsLocally(fileTags: string[]): RankedEntry[] {
    const index = rankedIndexRef.current
    if (!index || index.size === 0) return []

    const selfId = currentFileRef.current?.file_id

    const scored: { entry: RankedEntry; overlap: number }[] = []
    for (const [, entry] of index) {
      if (entry.fileId === selfId) continue
      let overlap = 0
      for (const tag of fileTags) {
        if (entry.tags.includes(tag)) overlap++
      }
      if (overlap > 0) {
        scored.push({ entry, overlap })
      }
    }

    scored.sort((a, b) => b.overlap - a.overlap)
    return scored.slice(0, opponentCount).map((s) => s.entry)
  }

  async function loadUnrankedQueue() {
    if (!ratingServiceKey) return
    setPhase('loading-queue')
    setProgressMsg('Fetching unranked files...')
    setError(null)
    try {
      const tags = placementTags.length > 0 ? placementTags : ['system:everything']
      const result = await searchFiles({ tags, file_limit: 200, return_hashes: false })
      const ids = result.file_ids ?? []
      if (ids.length === 0) {
        setPhase('idle')
        setError('No files found. Try different tags.')
        setProgressMsg(null)
        return
      }
      const allMeta: FileMetadata[] = []
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100)
        const meta = await fetchFileMetadataByIds(chunk)
        allMeta.push(...meta)
      }
      const unranked = allMeta.filter((f) => {
        const r = f.ratings?.[ratingServiceKey!]
        return (typeof r !== 'number' || r === 0) && !isUnsupportedMime(f.mime)
      })
      if (unranked.length === 0) {
        setPhase('idle')
        setError('No unranked files found. All matching files already have ratings.')
        setProgressMsg(null)
        return
      }
      setUnrankedQueue(unranked)

      if (!rankedIndexRef.current || !distFetchedRef.current) {
        const elos = await ensureRankedIndex()
        if (elos.length === 0 && phase !== 'idle') return
      }

      startPlacement(unranked, 0)
    } catch (e) {
      setPhase('idle')
      setError(String(e))
      setProgressMsg(null)
    }
  }

  async function startPlacement(queue: FileMetadata[], idx: number) {
    if (idx >= queue.length) {
      setPhase('done')
      setProgressMsg(null)
      return
    }
    placementRoundRef.current++
    const thisRound = placementRoundRef.current
    setCurrentMatchupIdx(0)
    setMatchups([])
    setResult(null)
    setSaved(false)
    setProgressMsg(null)

    const file = queue[idx]
    currentFileRef.current = file
    setCurrentFile(file)

    const url = await getFileUrl(file.hash).catch(() => null)
    if (thisRound !== placementRoundRef.current) return
    if (url) setCurrentUrl(url)

    try {
      const fileTags = getAllKnownTags(file)
      if (fileTags.length === 0) {
        throw new Error('File has no tags — cannot find opponents')
      }

      const ranked = findOpponentsLocally(fileTags)
      if (ranked.length < 2) {
        throw new Error('Not enough ranked opponents with similar tags (need at least 2). Try a broader tag filter or rank more files via Smash/Pass first.')
      }

      if (thisRound !== placementRoundRef.current) return

      const matchups: PlacementMatchup[] = ranked.map((r) => {
        const overlap = fileTags.filter((t) => r.tags.includes(t)).length
        const stub: FileMetadata = {
          file_id: r.fileId,
          hash: r.hash,
          mime: r.mime,
          size: 0,
          width: 0,
          height: 0,
          duration: null,
          has_audio: false,
          is_inbox: false,
          is_local: false,
          is_trashed: false,
          is_deleted: false,
          has_exif: false,
          known_urls: [],
          blurhash: null,
          pixel_hash: '',
          num_frames: null,
          num_words: null,
          file_services: { current: {}, deleted: {} },
          ratings: { [ratingServiceKey!]: r.elo },
          tags: {},
          file_viewing_statistics: [],
          file_notes: {},
        }
        return {
          opponentFile: stub,
          opponentElo: r.elo,
          tagOverlap: overlap,
          won: null,
        }
      })
      setMatchups(matchups)
      setProgressMsg(null)

      const oppUrl = await getFileUrl(ranked[0].hash).catch(() => null)
      if (thisRound !== placementRoundRef.current) return
      if (oppUrl) setOpponentUrl(oppUrl)

      setPhase('voting')
    } catch (e) {
      if (thisRound !== placementRoundRef.current) return
      setError(String(e))
      setPhase('idle')
      setProgressMsg(null)
    }
  }

  function handleVote(leftWins: boolean) {
    const mIdx = currentMatchupIdx
    const updated = [...matchups]
    updated[mIdx] = { ...updated[mIdx], won: leftWins }
    setMatchups(updated)

    if (mIdx + 1 >= updated.length) {
      finishPlacement(updated)
      return
    }
    const next = mIdx + 1
    setCurrentMatchupIdx(next)
    getFileUrl(updated[next].opponentFile.hash).then((u) => {
      if (u) setOpponentUrl(u)
    }).catch(() => {})
  }

  async function finishPlacement(finalMatchups: PlacementMatchup[]) {
    const file = currentFileRef.current
    if (!file || !ratingServiceKey) return

    const wins = finalMatchups.filter((m) => m.won === true).length
    const total = finalMatchups.length
    const placementElo = computePlacementElo(finalMatchups)
    const percentile = computePercentile(placementElo, [placementElo, ...leaderboardElos])
    const bracket = computeBracket(percentile)

    const res: PlacementResult = {
      fileId: file.file_id,
      fileHash: file.hash,
      wins,
      total,
      placementElo,
      percentile,
      bracket,
    }
    setResult(res)
    setPhase('result')
  }

  async function saveRatingToHydrus() {
    if (!result || !ratingServiceKey) return
    setSaving(true)
    setError(null)
    try {
      await setRating({
        file_id: result.fileId,
        rating_service_key: ratingServiceKey,
        rating: result.placementElo,
      })
      setSaved(true)
      setCompletedResults((prev) => [...prev, result])
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  function nextFile() {
    const queue = unrankedQueue
    const currentIdx = queue.findIndex((f) => f.file_id === currentFileRef.current?.file_id)
    if (currentIdx >= 0) {
      startPlacement(queue, currentIdx + 1)
    }
  }

  function handleRequeue() {
    setUnrankedQueue([])
    setCurrentFile(null)
    setCurrentUrl(null)
    setMatchups([])
    setResult(null)
    setOpponentUrl(null)
    setError(null)
    setSaved(false)
    setCompletedResults([])
    setPhase('idle')
    setProgressMsg(null)
    rankedIndexRef.current = null
    distFetchedRef.current = false
    setLeaderboardElos([])
  }

  useEffect(() => {
    if (tagVersion > 0) {
      handleRequeue()
      loadUnrankedQueue()
    }
  }, [tagVersion])

  function handleKeyDown(e: globalThis.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
    if (phase === 'voting') {
      if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); handleVote(true) }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); handleVote(false) }
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const votingOpen = phase === 'voting' && currentFile && matchups.length > 0 && currentMatchupIdx < matchups.length && currentUrl && opponentUrl

  function phaseSpinner() {
    return <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
  }

  function phaseStatus() {
    const msg = progressMsg
    if (!msg && phase === 'loading-queue') return 'Finding unranked files...'
    if (!msg && phase === 'loading-index') return 'Building ranked file index...'
    if (msg) return msg
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 pt-1">
        <TagSearch
          disableHistory
          tags={placementTags}
          onTagsChange={(t) => { setPlacementTags(t); setTagVersion((v) => v + 1) }}
        />
      </div>

      <div className="flex justify-center gap-6 py-2 text-sm text-gray-500 flex-wrap">
        {phase !== 'idle' && (
          <>
            <span>Queue: <b className="text-blue-400">{unrankedQueue.length}</b> unranked</span>
            {completedResults.length > 0 && (
              <span>Placed: <b className="text-green-400">{completedResults.length}</b></span>
            )}
            {phase === 'result' && result && (
              <span>ELO: <b className="text-yellow-400">{result.placementElo}</b></span>
            )}
            {rankedIndexRef.current && (
              <span>Ranked pool: <b className="text-purple-400">{rankedIndexRef.current.size}</b> files</span>
            )}
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0 relative">
        {phase === 'idle' && !error && (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <p className="text-lg">Placement Match</p>
            <p className="text-sm text-center max-w-md">
              Enter tags above, then find unranked files and place them on the ELO leaderboard
              by comparing against {opponentCount} ranked opponents with similar tags.
            </p>
            {ratingServiceKey ? (
              <button
                className="px-6 py-3 min-h-[44px] bg-blue-600 text-white rounded text-sm hover:bg-blue-700 active:bg-blue-800"
                onClick={loadUnrankedQueue}
              >
                Find Unranked Files
              </button>
            ) : (
              <p className="text-sm text-red-400">Configure an inc/dec rating service in Settings first.</p>
            )}
          </div>
        )}

        {(phase === 'loading-queue' || phase === 'loading-index') && (
          <div className="flex items-center gap-2 text-gray-400">
            {phaseSpinner()}
            <span>{phaseStatus() || 'Working...'}</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              className="px-4 py-2 min-h-[44px] bg-gray-600 text-white rounded text-sm hover:bg-gray-700 active:bg-gray-800"
              onClick={() => { setError(null); loadUnrankedQueue() }}
            >
              Retry
            </button>
          </div>
        )}

        {votingOpen && (
          <div className={`flex-1 flex w-full ${isMobile && orientation === 'portrait' ? 'flex-col' : 'flex-row'} gap-2 min-h-0`}>
            <div className="flex-1 relative">
              <div
                className="absolute inset-0 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 active:opacity-70"
                onClick={() => handleVote(true)}
              >
                {currentUrl && currentFile && (
                  <FileRenderer url={currentUrl} mime={currentFile.mime} className="w-full h-full object-contain" />
                )}
                <div className="absolute top-2 left-2 bg-blue-700/80 text-white text-xs font-bold px-2 py-1 rounded">
                  NEW
                </div>
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {'\u2190'} / A
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-gray-500 text-lg font-bold px-1">
              VS
            </div>

            <div className="flex-1 relative">
              <div
                className="absolute inset-0 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 active:opacity-70"
                onClick={() => handleVote(false)}
              >
                {opponentUrl && currentMatchupIdx < matchups.length && (
                  <FileRenderer
                    url={opponentUrl}
                    mime={matchups[currentMatchupIdx].opponentFile.mime}
                    className="w-full h-full object-contain"
                  />
                )}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  <span className="bg-amber-700/80 text-yellow-200 text-[10px] px-1.5 py-0.5 rounded font-bold">
                    {currentMatchupIdx + 1}/{matchups.length}
                  </span>
                  <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    {matchups[currentMatchupIdx].opponentElo} ELO{'\u00a0'}({matchups[currentMatchupIdx].tagOverlap} tags match)
                  </span>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {'\u2192'} / D
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-2xl font-bold">
              Placement Complete
            </div>
            <div className="text-sm text-gray-400">
              Won {result.wins}/{result.total} comparisons
            </div>
            <div className="bg-gray-800 rounded-lg px-8 py-4 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">Placement ELO</span>
              <span className="text-4xl font-bold text-yellow-400">{result.placementElo}</span>
              {leaderboardElos.length > 0 && (
                <span className="text-sm text-gray-400">
                  Top {100 - result.percentile}% — Bracket: <span className="font-bold text-white">{result.bracket}-Tier</span>
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                className="px-6 py-2 min-h-[44px] bg-green-600 text-white rounded text-sm disabled:opacity-50 hover:bg-green-700 active:bg-green-800"
                disabled={saving || saved}
                onClick={saveRatingToHydrus}
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save to Hydrus'}
              </button>
              <button
                className="px-6 py-2 min-h-[44px] bg-blue-600 text-white rounded text-sm hover:bg-blue-700 active:bg-blue-800"
                onClick={nextFile}
              >
                Next File
              </button>
            </div>
            {saved && (
              <p className="text-xs text-green-500">Rating saved to hydrus.</p>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-2xl font-bold text-green-400">All Done</div>
            <p className="text-sm text-gray-400">
              Placed {completedResults.length} files on the leaderboard.
            </p>
            {completedResults.length > 0 && (
              <div className="text-xs text-gray-500 max-w-md">
                {completedResults.map((r) => (
                  <div key={r.fileId} className="flex justify-between gap-4">
                    <span>#{r.fileId}</span>
                    <span className="text-yellow-400">{r.placementElo} ELO</span>
                    <span>{r.bracket}-Tier</span>
                    <span>{r.wins}/{r.total}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="px-6 py-2 min-h-[44px] bg-blue-600 text-white rounded text-sm hover:bg-blue-700 active:bg-blue-800"
              onClick={handleRequeue}
            >
              Start Over
            </button>
          </div>
        )}
      </div>

      {votingOpen && (
        <div className={`flex justify-center ${isMobile && orientation === 'portrait' ? 'gap-2 text-[10px]' : 'gap-4'} py-2 text-xs text-gray-500 flex-wrap`}>
          <span className="text-green-400">{'\u2190'} / A</span> new file wins
          <span className="text-green-400">{'\u2192'} / D</span> opponent wins
          <span className="text-gray-400">
            Comparison {currentMatchupIdx + 1}/{matchups.length}
          </span>
        </div>
      )}
    </div>
  )
}
