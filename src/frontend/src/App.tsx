import { lazy, Suspense, useState } from 'react'
import './App.css'
import ApiStatus from './components/ApiStatus'
import GuidedDemo from './features/demo/GuidedDemo'

const StatementDashboard = lazy(() => import('./features/statements/StatementDashboard'))
const PayslipDashboard = lazy(() => import('./features/payslips/PayslipDashboard'))

const DocumentWorkspace = lazy(() => import('./features/documents/DocumentWorkspace'))

function App() {
  const [view, setView] = useState<'payslips' | 'statements' | 'documents' | 'expenses'>('payslips')
  // A React component is a function that returns the page structure it owns.
  // App is currently the top-level component, so it arranges the whole screen.
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="TaxPrep AU home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>TaxPrep AU</span>
        </a>
        <span className="status">Portfolio prototype</span>
      </header>

      <nav className="workspace-nav" aria-label="TaxPrep workspaces"><button aria-pressed={view==='payslips'} onClick={()=>setView('payslips')}>Payslip dashboard</button><button aria-pressed={view==='statements'} onClick={()=>setView('statements')}>Statement analysis</button><button aria-pressed={view==='documents'} onClick={()=>setView('documents')}>Try document intake</button><button aria-pressed={view==='expenses'} onClick={()=>setView('expenses')}>Expense demo</button></nav>
      {(view === 'expenses' || view === 'documents') && <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Australian expense preparation demo</p>
        <h1 id="page-title">Organise expenses. See what needs checking.</h1>
        <p className="intro">
          Read sample receipts and bank transactions, review their facts, and bring income and expenses into one preparation handover.
          You can also explore the guided expense demo. No account required.
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

      {view === 'payslips' ? <Suspense key="payslips" fallback={<p role="status">Loading payslip dashboard…</p>}><PayslipDashboard /></Suspense> : view === 'statements' ? <Suspense key="statements" fallback={<p role="status">Loading statement analyser…</p>}><StatementDashboard /></Suspense> : view === 'documents' ? <Suspense key="documents" fallback={<p role="status">Loading document workspace…</p>}><DocumentWorkspace /></Suspense> : <GuidedDemo />}

      <details className="developer-details">
        <summary>Developer connection check</summary>
        <ApiStatus endpoint="/api/health" />
      </details>
    </main>
  )
}

export default App
