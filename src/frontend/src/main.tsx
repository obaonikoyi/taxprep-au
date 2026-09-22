// Before anything else, and before pdf.js in particular: it calls Map upsert
// methods that browsers only recently gained, and a missing method cannot be
// transpiled away. See src/lib/mapUpsert.ts.
import './lib/mapUpsert.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startTheme } from './lib/theme.ts'

// Light or dark goes on before the first paint, so the page never renders in
// one scheme and then flips to the other.
startTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
