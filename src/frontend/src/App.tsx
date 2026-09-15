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
        <p className="eyebrow">Australian tax preparation assistant</p>
        <h1 id="page-title">Tax preparation, explained simply.</h1>
        <p className="intro">
          Answer a short series of questions, identify preparation items and see
          what still needs attention before using myTax or speaking with an agent.
        </p>
        <aside className="notice" aria-label="Project disclaimer">
          <strong>Preparation only.</strong> TaxPrep AU does not provide tax
          advice or lodge tax returns.
        </aside>
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
