import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

const App = lazy(() => import('./App'))
const AdminApp = lazy(() => import('./AdminApp'))

// Admin panel: /admin yolu (vercel) veya admin.* subdomain'i (localhost) ile açılır
const isAdminSubdomain =
  window.location.hostname.startsWith('admin.localhost') ||
  window.location.hostname.startsWith('admin-')
const isAdminPath =
  window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const isAdmin = isAdminPath || isAdminSubdomain
// /admin yolu kullanılıyorsa basename'i ayarla, subdomain'de kök kalsın
const adminBasename = isAdminPath ? '/admin' : '/'

const fallback = (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    Yükleniyor...
  </div>
)

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    {isAdmin ? (
      <BrowserRouter basename={adminBasename}>
        <Suspense fallback={fallback}>
          <AdminApp />
        </Suspense>
      </BrowserRouter>
    ) : (
      <BrowserRouter>
        <Suspense fallback={fallback}>
          <App />
        </Suspense>
      </BrowserRouter>
    )}
  </StrictMode>,
)
