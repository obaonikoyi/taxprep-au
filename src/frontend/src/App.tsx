import './App.css'

const foundations = [
  { title: 'Frontend ready', detail: 'React, TypeScript and Vite are configured.' },
  { title: 'Backend ready', detail: 'ASP.NET Core provides a simple health endpoint.' },
  { title: 'Safe by default', detail: 'No AI, bank connection or real financial data.' },
]

function App() {
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
    </main>
  )
}

export default App
