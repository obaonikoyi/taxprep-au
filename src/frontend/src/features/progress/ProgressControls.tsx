import type { useSavedProgress } from './useSavedProgress'

type Props = { progress: ReturnType<typeof useSavedProgress> }
export default function ProgressControls({ progress: p }: Props) {
  const copy = p.copy
  return <section className="saved-progress" aria-labelledby="saved-progress-title">
    <h3 id="saved-progress-title">Save and return later</h3>
    <p>Save a copy of your expenses, source references and unfinished form in this browser on this device. Use fictional data only. Unselected CSV previews are not saved.</p>
    <p className="progress-state" role="status">{p.isSaved ? 'This progress is saved.' : 'Changes in this tab are not saved. Use Save progress before leaving.'}</p>
    {copy.kind === 'saved' && <p>Saved copy: <time dateTime={copy.snapshot.savedAt}>{new Date(copy.snapshot.savedAt).toLocaleString('en-AU')}</time>. Resuming replaces the entries in this tab with that copy.</p>}
    {copy.kind === 'saved' && !p.canSave && <p>Resume the saved copy, or delete it before saving new work.</p>}
    {(copy.kind === 'invalid' || copy.kind === 'unavailable') && <p role="alert" className="field-error">{copy.message}</p>}
    {p.error && <p role="alert" className="field-error">{p.error}</p>}
    <div className="button-row">
      <button className="secondary-button" disabled={!p.canSave || p.isSaved} onClick={p.save}>Save progress</button>
      {copy.kind === 'saved' && !p.isSaved && <button className="primary-button" onClick={p.resume}>Resume saved progress</button>}
      {(copy.kind === 'saved' || copy.kind === 'invalid') && <button className="text-button remove-expense" onClick={() => p.remove()}>Delete saved progress</button>}
      <button className="text-button" onClick={p.check}>Check saved progress</button>
    </div>
    {p.message && <p className="progress-message" role="status">{p.message}</p>}
  </section>
}
