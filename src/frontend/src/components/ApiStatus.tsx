import { useState } from 'react'

// An interface describes the exact data shape we expect from the backend.
// TypeScript can then warn us if our code tries to use a field that is absent.
interface HealthResponse {
  status: string
  service: string
}

// Props are values supplied by a parent component. ApiStatus does not decide
// the endpoint itself; App passes it in, which keeps this component reusable.
interface ApiStatusProps {
  endpoint: string
}

// A union type limits state to these four known values. A spelling mistake such
// as "succes" would become a TypeScript error instead of a hidden UI bug.
type ConnectionState = 'idle' | 'loading' | 'success' | 'error'

function ApiStatus({ endpoint }: ApiStatusProps) {
  // State is information that can change while the component is on screen.
  // Calling either setter asks React to render the component with new values.
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('idle')
  const [message, setMessage] = useState(
    'Start the backend, then check whether the two applications can communicate.',
  )

  // This event handler runs when the user clicks the button.
  // async lets us use await while the browser waits for the API response.
  async function checkBackend() {
    setConnectionState('loading')
    setMessage('Contacting the TaxPrep AU API…')

    try {
      const response = await fetch(endpoint)

      if (!response.ok) {
        throw new Error(`The API returned status ${response.status}.`)
      }

      const data: HealthResponse = await response.json()
      setConnectionState('success')
      setMessage(`${data.service} is ${data.status}.`)
    } catch {
      // We show a safe, useful message instead of exposing technical or private
      // information from an unexpected server error.
      setConnectionState('error')
      setMessage('The backend could not be reached. Confirm that it is running.')
    }
  }

  return (
    <section className="api-status" aria-labelledby="api-status-title">
      <div>
        <p className="eyebrow">Live practice</p>
        <h2 id="api-status-title">Frontend meets backend</h2>
        <p className="api-description">
          This button calls the safe health endpoint. It does not send financial
          information.
        </p>
      </div>

      <div className={`connection-panel connection-panel--${connectionState}`}>
        <p aria-live="polite">{message}</p>
        <button
          type="button"
          onClick={checkBackend}
          disabled={connectionState === 'loading'}
        >
          {connectionState === 'loading' ? 'Checking…' : 'Check backend'}
        </button>
      </div>
    </section>
  )
}

export default ApiStatus
