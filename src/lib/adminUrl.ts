/**
 * Admin panel URL'sini ortama göre oluştur
 * - Env'de VITE_ADMIN_URL varsa onu kullan
 * - Localhost: admin.localhost:5173
 * - Vercel: env'den oku (VITE_ADMIN_URL=https://admin-panel-url)
 */
export function getAdminUrl(): string {
  const envAdminUrl = import.meta.env.VITE_ADMIN_URL
  if (envAdminUrl) {
    return envAdminUrl
  }

  const hostname = window.location.hostname
  const protocol = window.location.protocol

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//admin.localhost:5173`
  }

  // Fallback: aynı domain'i kullan
  return `${protocol}//${hostname}/admin`
}
