import { useEffect, useState } from 'react'
import { encodeProgress, parseProgress, PROGRESS_KEY, readProgress, type PreparationData, type SavedCopy } from './progressStorage'

export function useSavedProgress(data: PreparationData, onResume: (data: PreparationData) => void) {
  const [copy, setCopy] = useState<SavedCopy>(readProgress)
  const [baseline, setBaseline] = useState<string | null | undefined>(() => copy.kind === 'empty' ? null : undefined)
  const [savedData, setSavedData] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isSaved = copy.kind === 'saved' && copy.raw === baseline && JSON.stringify(data) === savedData
  const canSave = (copy.kind === 'empty' || copy.kind === 'saved') && copy.raw === baseline

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== PROGRESS_KEY && event.key !== null) return
      setCopy(readProgress())
      setMessage('Saved progress changed in another tab. Your current work is still here. Check the saved copy before saving again.')
      setError('')
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])

  function check() {
    const next = readProgress(); setCopy(next); setError(''); setMessage('Saved progress checked. Your current work has not changed.')
    if (next.kind === 'empty') { setBaseline(null); setSavedData(null) }
  }
  function save() {
    const latest = readProgress()
    setCopy(latest); setError(''); setMessage('')
    if (latest.kind === 'unavailable' || latest.kind === 'invalid') return
    if (latest.raw !== baseline) {
      setError('The saved copy changed. Resume it or delete it before saving this version. Your current work is still here.')
      return
    }
    try {
      const raw = encodeProgress(data)
      window.localStorage.setItem(PROGRESS_KEY, raw)
      setCopy({ kind: 'saved', raw, snapshot: parseProgress(raw) }); setBaseline(raw); setSavedData(JSON.stringify(data))
      setMessage('Progress saved in this browser.')
    } catch {
      setError('Progress could not be saved. Browser storage may be blocked or full. Your current work is still here; free space or allow storage, then try again.')
    }
  }
  function resume() {
    const latest = readProgress(); setCopy(latest); setError(''); setMessage('')
    if (latest.kind !== 'saved') { setMessage('No readable saved progress is available. Your current work has not changed.'); return }
    // Require the displayed copy to match; a newer copy must be offered before replacing this tab.
    if (copy.kind !== 'saved' || latest.raw !== copy.raw) { setMessage('The saved copy changed. Check its timestamp, then resume again.'); return }
    setBaseline(latest.raw); setSavedData(JSON.stringify(latest.snapshot.data))
    onResume(latest.snapshot.data); setMessage('Progress restored. Summaries are reviewed again before export.')
  }
  function remove(restarting = false): boolean {
    const latest = readProgress(); setCopy(latest); setError(''); setMessage('')
    if (latest.kind === 'unavailable') return false
    if (latest.kind !== 'empty' && (copy.kind === 'unavailable' || latest.raw !== copy.raw)) {
      setError('The saved copy changed. Check its timestamp before deleting or restarting again. Your current work is still here.')
      return false
    }
    try {
      window.localStorage.removeItem(PROGRESS_KEY)
      setCopy({ kind: 'empty', raw: null }); setBaseline(null); setSavedData(null)
      setMessage(restarting ? 'Saved copy deleted and demo restarted.' : 'Saved copy deleted. Current entries remain in this tab until you restart or leave.')
      return true
    } catch { setError('The saved copy could not be deleted. Your current work is still here. Allow browser storage and try again.'); return false }
  }
  return { copy, isSaved, canSave, message, error, check, save, resume, remove }
}
