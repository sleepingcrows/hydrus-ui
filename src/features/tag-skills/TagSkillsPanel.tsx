import { useEffect, useRef, useState } from 'react'
import { getThumbnailUrl, getFileUrl } from '../../api/search'
import { computeTagElos, findCandidateFiles, applyCandidateRatingsBatch, type TagElo, type CandidateFile } from './tag-skills'
import { useSettingsStore } from '../../stores/settings-store'
import { useRatingServicesStore } from '../../stores/rating-services-store'
import { SERVICE_TYPE } from '../../api/types'
import { TagSearch } from '../search/TagSearch'

function CandidateThumbnail({ hash, alt, onClick }: { hash: string; alt: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const loadedRef = useRef(false)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    getThumbnailUrl(hash).then((u) => { urlRef.current = u; setUrl(u) }).catch(() => setFailed(true))
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [hash])

  if (failed) return <div className="w-16 h-16 bg-gray-700 rounded flex items-center justify-center text-[10px] text-gray-500">N/A</div>
  if (!url) return <div className="w-16 h-16 bg-gray-700 rounded animate-pulse" />
  return <img src={url} alt={alt} className="w-16 h-16 object-cover rounded cursor-pointer" onClick={onClick} />
}

export function TagSkillsPanel() {
  const [tagElos, setTagElos] = useState<TagElo[]>([])
  const [candidates, setCandidates] = useState<CandidateFile[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [phase, setPhase] = useState<'idle' | 'computed' | 'candidates'>('idle')
  const [minConfidence, setMinConfidence] = useState(0)
  const [sortBy, setSortBy] = useState<'confidence' | 'elo' | 'tags'>('confidence')
  const [statusMsg, setStatusMsg] = useState('')
  const [previewFile, setPreviewFile] = useState<CandidateFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const configuredKey = useSettingsStore((s) => s.ratingServiceKey)
  const services = useRatingServicesStore((s) => s.services)
  const ratingServiceKey = (configuredKey || services.find((rs) => rs.type === SERVICE_TYPE.INC_DEC_RATING)?.service_key) ?? null

  const tagEloMapRef = useRef<Map<string, TagElo>>(new Map())

  async function handleCompute() {
    if (!ratingServiceKey) return
    setLoading(true)
    setProgress(null)
    setStatusMsg('Computing tag ELOs from leaderboard...')
    try {
      const elos = await computeTagElos(ratingServiceKey, (cur, total) => {
        setProgress({ current: cur, total })
      })
      setTagElos(elos)
      tagEloMapRef.current = new Map(elos.map((e) => [e.tag, e]))
      setPhase('computed')
      setStatusMsg(`Computed ${elos.length} tag ELOs from leaderboard data`)
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  async function handleFindCandidates() {
    if (!ratingServiceKey || tagEloMapRef.current.size === 0) return
    setLoading(true)
    setProgress(null)
    setStatusMsg('Searching for candidate files...')
    try {
      const results = await findCandidateFiles(tagFilter, tagEloMapRef.current, ratingServiceKey, (cur, total) => {
        setProgress({ current: cur, total })
      })
      setCandidates(results)
      setSelected(new Set())
      setPhase('candidates')
      setStatusMsg(`Found ${results.length} candidate files with predicted ELO ratings`)
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  function toggleSelect(fileId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filteredCandidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredCandidates.map((c) => c.fileId)))
    }
  }

  async function handleApply() {
    if (!ratingServiceKey || selected.size === 0) return
    setApplying(true)
    setProgress(null)
    const toApply = filteredCandidates
      .filter((c) => selected.has(c.fileId))
      .map((c) => ({ fileId: c.fileId, predictedElo: c.predictedElo }))
    setStatusMsg(`Applying ratings to ${toApply.length} files...`)
    try {
      const confirmed = await applyCandidateRatingsBatch(toApply, ratingServiceKey, (cur, total) => {
        setProgress({ current: cur, total })
      })
      setCandidates((prev) => prev.filter((c) => !confirmed.includes(c.fileId)))
      setStatusMsg(`Applied & verified ${confirmed.length} files, removed from list`)
      setSelected(new Set())
    } catch (e) {
      setStatusMsg(`Error applying: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setApplying(false)
      setProgress(null)
    }
  }

  async function handleOpenPreview(file: CandidateFile) {
    setPreviewFile(file)
    try {
      const url = await getFileUrl(file.hash)
      previewUrlRef.current = url
      setPreviewUrl(url)
    } catch {
      setPreviewUrl(null)
    }
  }

  function handleClosePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setPreviewFile(null)
  }

  useEffect(() => {
    if (!previewFile) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClosePreview()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewFile])

  const filteredCandidates = candidates
    .filter((c) => c.confidenceScore >= minConfidence)
    .sort((a, b) => {
      if (sortBy === 'elo') return b.predictedElo - a.predictedElo
      if (sortBy === 'tags') return b.tagCount - a.tagCount
      return b.confidenceScore - a.confidenceScore
    })

  const totalSelected = selected.size
  const allSelected = filteredCandidates.length > 0 && selected.size === filteredCandidates.length

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Tag Skills</h2>
        <span className="text-xs text-gray-500">{statusMsg}</span>
      </div>

      {/* Compute section */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="min-h-[44px] px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
          onClick={handleCompute}
          disabled={loading || !ratingServiceKey}
        >
          {loading && phase === 'idle' ? 'Computing...' : 'Compute Tag ELOs'}
        </button>
        {!ratingServiceKey && (
          <span className="text-xs text-amber-500">No inc/dec rating service configured</span>
        )}
        {phase === 'computed' && (
          <span className="text-xs text-gray-400">
            {tagElos.length} tags from leaderboard
          </span>
        )}
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-2">
          <div
            className="bg-blue-500 h-2 rounded transition-all"
            style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Tag ELO stats */}
      {phase === 'computed' && tagElos.length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-300">
            Top tag ELOs ({tagElos.length} total)
          </summary>
          <div className="max-h-40 overflow-y-auto mt-1 grid grid-cols-2 sm:grid-cols-3 gap-1">
            {tagElos.slice(0, 60).map((t) => (
              <span key={t.tag} className="truncate" title={`${t.tag} - ELO: ${t.avgElo} (${t.fileCount} files)`}>
                {t.tag}: <b>{t.avgElo}</b> <span className="text-gray-600">({t.fileCount}x)</span>
              </span>
            ))}
          </div>
        </details>
      )}

      {/* Filter section */}
      {phase !== 'idle' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Tag filter:</span>
            <TagSearch
              disableHistory
              tags={tagFilter}
              onTagsChange={setTagFilter}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              className="min-h-[44px] px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
              onClick={handleFindCandidates}
              disabled={loading || tagElos.length === 0}
            >
              {loading && phase === 'computed' ? 'Searching...' : 'Find Candidates'}
            </button>
            {phase === 'candidates' && (
              <span className="text-xs text-gray-400">
                {candidates.length} potential files
              </span>
            )}
          </div>
        </div>
      )}

      {/* Candidates table */}
      {phase === 'candidates' && filteredCandidates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5"
                />
                Select all ({filteredCandidates.length})
              </label>
              <span className="text-xs text-gray-500">
                {totalSelected > 0 && `${totalSelected} selected`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Sort:</span>
              <select
                className="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-600"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="confidence">Confidence</option>
                <option value="elo">Predicted ELO</option>
                <option value="tags">Tag Count</option>
              </select>
              <span className="text-xs text-gray-500">Min confidence:</span>
              <input
                type="number"
                className="text-xs border rounded px-2 py-1 w-16 bg-white dark:bg-gray-800 dark:border-gray-600"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Math.max(0, Number(e.target.value)))}
                min={0}
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto border dark:border-gray-700 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-2 py-1.5 text-left w-20">File</th>
                  <th className="px-2 py-1.5 text-left">Predicted ELO</th>
                  <th className="px-2 py-1.5 text-left">Confidence</th>
                  <th className="px-2 py-1.5 text-left">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((c) => (
                  <tr
                    key={c.fileId}
                    className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.has(c.fileId)}
                        onChange={() => toggleSelect(c.fileId)}
                        className="w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CandidateThumbnail hash={c.hash} alt={`file ${c.fileId}`} onClick={() => handleOpenPreview(c)} />
                    </td>
                    <td className="px-2 py-1.5 font-mono font-bold">
                      {c.predictedElo}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded"
                            style={{ width: `${Math.min(100, (c.confidenceScore / 500) * 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-400">{c.confidenceScore}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 truncate max-w-xs" title={c.tags?.join(', ') ?? ''}>
                      {c.tags?.slice(0, 5).map((t) => (
                        <span key={t} className="inline-block bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded mr-1 mb-0.5 text-[10px]">
                          {t}
                        </span>
                      ))}
                      {(c.tags?.length ?? 0) > 5 && (
                        <span className="text-gray-500 text-[10px]">+{c.tags!.length - 5} more</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="min-h-[44px] px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50"
              onClick={handleApply}
              disabled={applying || totalSelected === 0}
            >
              {applying ? 'Applying...' : `Apply Selected (${totalSelected})`}
            </button>
            {progress && applying && (
              <span className="text-xs text-gray-400">
                {progress.current} / {progress.total}
              </span>
            )}
          </div>
        </div>
      )}

      {phase === 'candidates' && filteredCandidates.length === 0 && (
        <div className="text-gray-400 text-sm text-center py-8">
          {candidates.length > 0
            ? 'All candidates filtered out. Adjust min confidence or tag filter.'
            : 'No candidates found matching your filter.'}
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={handleClosePreview}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`Preview ${previewFile.fileId}`}
              className="max-w-[95vw] max-h-[95vh] object-contain cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="text-gray-400 text-lg">Loading preview...</div>
          )}
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white bg-black/50 rounded-full hover:bg-black/70 text-xl cursor-pointer z-10"
            onClick={handleClosePreview}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default TagSkillsPanel
