import './App.css'
import ApiStatus from './components/ApiStatus'
import GuidedDemo from './features/demo/GuidedDemo'

function App() {
  // A React component is a function that returns the page structure it owns.
  // App is currently the top-level component, so it arranges the whole screen.
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="TaxPrep AU home">
          <span className="brand-mark" aria-hidden="true">T</span>
          <span>TaxPrep AU</span>
        </a>
        <span className="status">Guided demo</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Australian expense preparation demo</p>
        <h1 id="page-title">Organise expenses. See what needs checking.</h1>
        <p className="intro">
          Turn sample spending into an expense summary, record work-use details
          and download a checklist of evidence still needed. No account required.
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
      </section>

      <GuidedDemo />

      <details className="developer-details">
        <summary>Developer connection check</summary>
        <ApiStatus endpoint="/api/health" />
      </details>
    </main>
  )
}

export default App
