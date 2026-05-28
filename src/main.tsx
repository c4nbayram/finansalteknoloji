import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const isAdmin = typeof window !== 'undefined' &&
  (window.location.hostname === 'admin.localhost' ||
    window.location.hostname.startsWith('admin.localhost'))

// Bridge mode: iframe runs on localhost origin and relays postMessages to localStorage.
// This solves cross-origin localStorage between admin.localhost and localhost.
const isBridge = !isAdmin &&
  new URLSearchParams(window.location.search).has('bridge')

if (isBridge) {
  window.addEventListener('message', (e: MessageEvent) => {
    // Only accept messages from the admin subdomain
    if (
      e.origin !== 'http://admin.localhost:5173' &&
      !e.origin.startsWith('http://admin.localhost:')
    ) return
    const msg = e.data as { type?: string; key?: string; value?: string }
    if (msg?.type === 'LS_SET' && typeof msg.key === 'string' && msg.value !== undefined) {
      try {
        localStorage.setItem(msg.key, msg.value)
      } catch {
        // quota exceeded — ignore
      }
    }
  })
  // No React rendering needed in bridge mode
} else {
  const root = createRoot(document.getElementById('root')!)

  async function mount() {
    if (isAdmin) {
      const { default: AdminApp } = await import('./AdminApp')
      root.render(
        <StrictMode>
          <BrowserRouter>
            <AdminApp />
          </BrowserRouter>
        </StrictMode>,
      )
    } else {
      const { default: App } = await import('./App')
      root.render(
        <StrictMode>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </StrictMode>,
      )
    }
  }

  void mount()
}
