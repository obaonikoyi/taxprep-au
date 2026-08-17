import './App.css'
import ApiStatus from './components/ApiStatus'

// These cards describe the foundation milestone.
// Keeping the content in one list lets React build each card using the same
// layout, instead of us copying the card markup three times.
const foundations = [
  { title: 'Frontend ready', detail: 'React, TypeScript and Vite are configured.' },
  { title: 'Backend ready', detail: 'ASP.NET Core provides a simple health endpoint.' },
  { title: 'Safe by default', detail: 'No AI, bank connection or real financial data.' },
]

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
        <span className="status">Foundation phase</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Australian tax preparation assistant</p>
        <h1 id="page-title">A clean foundation for a careful product.</h1>
        <p className="intro">
          TaxPrep AU will help individuals organise records and prepare a clear
          summary before using myTax or speaking with a registered tax agent.
        </p>
        <aside className="notice" aria-label="Project disclaimer">
          <strong>Preparation only.</strong> TaxPrep AU does not provide tax
          advice or lodge tax returns.
        </aside>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">Milestone 1</p>
          <h2 id="foundation-title">Project foundation</h2>
        </div>
        <div className="cards">
          {/* map visits each foundation item and turns it into a visible card. */}
          {foundations.map((item, index) => (
            <article className="card" key={item.title}>
              <span className="card-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {/* App supplies the endpoint through a prop. During local development,
          Vite forwards /api requests to the ASP.NET Core backend. */}
      <ApiStatus endpoint="/api/health" />
    </main>
  )
}

export default App
