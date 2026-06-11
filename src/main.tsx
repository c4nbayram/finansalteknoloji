import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const isAdmin = typeof window !== 'undefined' &&
  (window.location.hostname === 'admin.localhost' ||
    window.location.hostname.startsWith('admin.localhost') ||
    window.location.hostname.startsWith('admin-'))

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
