import { lazy, Suspense, useState } from 'react'
import ApiStatus from './components/ApiStatus'
import GuidedDemo from './features/demo/GuidedDemo'

const StatementDashboard = lazy(() => import('./features/statements/StatementDashboard'))
const PayslipDashboard = lazy(() => import('./features/payslips/PayslipDashboard'))

const DocumentWorkspace = lazy(() => import('./features/documents/DocumentWorkspace'))

type Workspace = 'payslips' | 'statements' | 'documents' | 'expenses'

// Each workspace frames itself, so the shell only supplies the header, the
// tab bar and the footer. The guided example is the exception: it opens on a
// step inside a demo, so the shell introduces it.
const WORKSPACES: [Workspace, string, string][] = [
  ['payslips', 'My pay', 'Understand your payslips'],
  ['statements', 'Bank spending', 'Explore bank transactions'],
  ['documents', 'Tax documents', 'Review receipts and records'],
  ['expenses', 'Guided example', 'Try tax preparation'],
]

function App() {
  const [view, setView] = useState<Workspace>('payslips')
  // A React component is a function that returns the page structure it owns.
  // App is currently the top-level component, so it arranges the whole screen.
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="shell-width site-header-bar">
          <a className="brand" href="/" aria-label="TaxPrep AU home">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span className="brand-name">TaxPrep AU<small>Understand your pay. Prepare for tax time.</small></span>
          </a>
          <span className="status">Portfolio prototype</span>
        </div>

        <nav className="workspace-nav" aria-label="TaxPrep tools">
          <div className="shell-width workspace-nav-list">
            {WORKSPACES.map(([key, title, description]) => <button key={key} type="button" aria-label={title} aria-pressed={view === key} onClick={() => setView(key)}><strong>{title}</strong><small>{description}</small></button>)}
          </div>
        </nav>
      </header>

      <main className="shell-width">
        {view === 'expenses' && <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">Australian expense preparation demo</p>
          <h1 id="page-title">Organise expenses. See what needs checking.</h1>
          <p className="intro">
            Walk through a worked example: record expense amounts, work-use percentages and evidence,
            then review what is still missing. No account required.
          </p>
          <aside className="notice" aria-label="Project disclaimer">
            <strong>Try it with fictional data.</strong> This demo organises expenses;
            it does not approve deductions, estimate refunds or lodge tax returns.
          </aside>
          <details className="quick-start">
            <summary>Try one useful task: a phone expense</summary>
            <ol>
              <li>Scroll to <strong>Review your transactions</strong> and choose <strong>Try sample CSV</strong>.</li>
              <li>Select <strong>Sunrise Mobile Services</strong>, choose <strong>Phone service</strong> and click <strong>Review selected spending</strong>.</li>
              <li>Enter <strong>40%</strong> work use, choose <strong>Not reimbursed</strong> and <strong>Evidence missing</strong>, then save the expense.</li>
              <li>See the <strong>$18 work portion</strong> and evidence checklist. Download the report or save progress to return later.</li>
            </ol>
            <p>The $18 is an organising calculation, not an approved tax deduction.</p>
          </details>
        </section>}

        {view === 'payslips' ? <Suspense key="payslips" fallback={<p role="status" className="workspace-loading">Loading payslip dashboard…</p>}><PayslipDashboard /></Suspense> : view === 'statements' ? <Suspense key="statements" fallback={<p role="status" className="workspace-loading">Loading statement analyser…</p>}><StatementDashboard /></Suspense> : view === 'documents' ? <Suspense key="documents" fallback={<p role="status" className="workspace-loading">Loading document workspace…</p>}><DocumentWorkspace /></Suspense> : <GuidedDemo />}
      </main>

      <footer className="site-footer">
        <div className="shell-width">
          <p>
            TaxPrep AU is an independent prototype. It is not affiliated with the Australian Taxation Office,
            does not lodge returns and does not give personal tax advice.
          </p>
          <details className="developer-details">
            <summary>Developer connection check</summary>
            <ApiStatus endpoint="/api/health" />
          </details>
        </div>
      </footer>
    </div>
  )
}

export default App
