# Finansal Teknoloji Simülasyon Platformu

Bu proje, Finansal Teknolojiler dersim için geliştirdiğim bir finansal simülasyon
uygulamasıdır. Kullanıcı tarafında canlı piyasa takibi, portföy yönetimi ve yapay
zeka destekli bir trade bot bulunur. Yönetici tarafında ise kullanıcıların,
işlemlerin, logların ve bot durumunun izlendiği ayrı bir admin paneli vardır.

Tüm veriler Supabase üzerinde saklanır ve gerçek zamanlı olarak güncellenir.

## Demo Giriş Bilgileri

Admin hesabı:

- Kullanıcı Adı: Admin
- Şifre: Admin.123

Kullanıcı hesabı:

- Kullanıcı Adı: Demo
- Şifre: Demo.123

## Özellikler

### Kullanıcı Tarafı

- Kullanıcı kaydı, girişi ve oturum yönetimi (Supabase Auth)
- Genel Bakış: piyasa özeti, portföy değeri ve canlı fiyat bandı
- Piyasalar: ABD hisseleri, kripto, emtia ve döviz için canlı veriler
- Watchlist: takip listesi oluşturma ve fiyat izleme
- Varlık Detayı: mum grafiği, teknik göstergeler, destek/direnç seviyeleri
- Portföy: pozisyon ekleme, ortalama maliyet, kar/zarar takibi
- Trade Bot: yapay zeka karar motoru ile otomatik alım/satım simülasyonu
- Bot Cüzdanı: portföy ile bot arasında para transferi ve transfer kayıtları
- Bildirimler: fiyat alarmları ve sistem bildirimleri
- Notlar: varlık bazlı not alma
- Eğitim: içerik/blog sayfaları
- Destek: iletişim formu (ticket) oluşturma
- Profil: ad, biyografi, profil fotoğrafı ve para birimi tercihi (TRY / USD / EUR)
- Para birimi dönüşümü canlı kurlar ile gerçek olarak hesaplanır

### Admin Tarafı

- Genel Bakış: özet istatistikler ve son hareketler
- İçerik Üretici: eğitim/blog yazısı oluşturma ve yayınlama
- Mesajlar: kullanıcı destek taleplerini görüntüleme ve yanıtlama
- Kullanıcılar: kullanıcı oluşturma, rol değiştirme, şifre sıfırlama, silme
- Kontrol Ünitesi: seçilen kullanıcının canlı denetimi
- Sistem Logları: uygulama loglarının izlenmesi
- Bot Monitörü: önce kullanıcı seçilir, ardından o kullanıcının bot durumu,
  nakit, pozisyon, net kar/zarar ve işlem geçmişi detaylı görüntülenir

## Teknolojiler

- React 19 + TypeScript
- Vite (derleme ve geliştirme sunucusu)
- React Router (sayfa yönlendirme)
- Supabase (veritabanı, kimlik doğrulama, gerçek zamanlı akış)
- GSAP (animasyonlar)
- lucide-react (ikonlar)

## Proje Yapısı

- `src/App.tsx` — Kullanıcı uygulaması ve tüm kullanıcı sayfaları
- `src/AdminApp.tsx` — Admin paneli ve alt sayfaları
- `src/main.tsx` — Giriş noktası; URL'ye göre kullanıcı veya admin uygulamasını yükler
- `src/components/` — Grafik ve görsel bileşenler (mum grafiği, sparkline vb.)
- `src/lib/` — Yardımcı modüller:
  - `supabase.ts` — Supabase istemcisi
  - `auth.ts` — Kimlik doğrulama ve rol yönetimi
  - `db.ts` — Veritabanı okuma/yazma işlemleri
  - `marketData.ts` — Piyasa verisi sağlayıcısı
  - `indicators.ts` — Teknik gösterge hesaplamaları
  - `tradeBot.ts` — Trade bot karar ve işlem mantığı
  - `adminUrl.ts` — Admin paneli adresinin ortama göre çözülmesi
  - `logger.ts`, `migration.ts`, `integrations.ts` — Log, veri taşıma ve entegrasyon

## Admin Paneline Erişim

Uygulama tek bir kod tabanından iki ayrı arayüz sunar. `src/main.tsx`, açılan adrese
bakarak ya kullanıcı uygulamasını ya da admin panelini yükler. Admin paneline iki
şekilde girilebilir:

1. Subdomain ile (genellikle yerel geliştirme için):
   `admin.localhost:5173` gibi `admin.` ile başlayan bir alan adı kullanılır.

2. `/admin` yolu ile (Vercel/production dağıtımı için):
   `https://finansalteknoloji.vercel.app/admin` adresi kullanılır.

Vercel üzerinde subdomain ayarlamak ek alan adı yapılandırması gerektirdiğinden,
yayınlanan sürümde admin paneline `/admin` yolu üzerinden erişiyoruz. Bu durumda
admin uygulaması kendi yönlendiricisinde `basename="/admin"` ile çalışır; böylece
panel içindeki tüm menü bağlantıları (`/admin/kullanicilar`, `/admin/mesajlar` gibi)
doğru şekilde panel içinde kalır. Yerelde subdomain kullanıldığında ise yönlendirici
kök dizinde (`/`) çalışmaya devam eder.

Kullanıcı uygulamasında, oturum açan hesabın rolü `admin` ise sol menüde
"Admin Panel" bağlantısı görünür. Bu bağlantının hedef adresi `VITE_ADMIN_URL`
ortam değişkeninden okunur; tanımlı değilse yerelde otomatik olarak çözülür.

Not: Admin paneline yalnızca `role = 'admin'` olan hesaplar girebilir. İlk admin
hesabı, Supabase üzerinde `profiles` tablosundaki ilgili satırın `role` alanı
`admin` yapılarak oluşturulur. Sonrasında admin panelindeki "Kullanıcılar"
bölümünden diğer hesapların rolleri değiştirilebilir.

## Ortam Değişkenleri

Proje kök dizininde bir `.env` dosyası oluşturun. Örnek için `.env.example`
dosyasına bakabilirsiniz.

```text
VITE_MARKET_DATA_PROVIDER=twelvedata
VITE_MARKET_DATA_API_KEY=YOUR_TWELVE_DATA_API_KEY
VITE_MARKET_DATA_BASE_URL=https://api.twelvedata.com

VITE_OPENAI_API_KEY=YOUR_OPENAI_API_KEY
VITE_OPENAI_MODEL=gpt-4o-mini

VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# Admin paneli adresi. Boş bırakılırsa yerelde otomatik çözülür.
# Yayın ortamında /admin yolunu gösterin, örnek:
VITE_ADMIN_URL=https://finansalteknoloji.vercel.app/admin
```

## Gereksinimler

- Node.js 18+ (öneri: 20+)
- npm 9+

## Kurulum ve Çalıştırma

1. Proje klasörüne gir:

```bash
cd finansalteknoloji
```

2. Paketleri yükle:

```bash
npm install
```

3. Ortam değişkenlerini ayarla (`.env` dosyasını oluştur).

4. Geliştirme sunucusunu başlat:

```bash
npm run dev
```

5. Tarayıcıdan aç:

```text
http://localhost:5173
```

Admin paneli için yerelde `admin.localhost:5173`, yayın ortamında `/admin`
yolunu kullan.

## Komutlar

- `npm run dev` — Geliştirme sunucusunu başlatır
- `npm run build` — TypeScript derlemesi yapar ve üretim çıktısını oluşturur
- `npm run preview` — Üretim çıktısını yerelde önizler
- `npm run lint` — ESLint ile kod kontrolü yapar

## Dağıtım (Vercel)

Proje Vercel üzerinde yayınlanmaktadır. `vercel.json` dosyası, tek sayfa
uygulaması olduğu için tüm yolları `index.html` dosyasına yönlendirir; böylece
`/admin` gibi derin bağlantılar doğrudan açıldığında da çalışır. Ortam
değişkenleri Vercel proje ayarlarından tanımlanmalıdır.
