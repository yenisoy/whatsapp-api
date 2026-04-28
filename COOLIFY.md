# Coolify Deployment

Bu proje Coolify üzerinde `Docker Compose` olarak deploy edilmeye hazırdır.

## 1) Kaynak dosya

Coolify'da compose dosyası olarak aşağıdaki dosyayı seçin:

- `docker-compose.coolify.yml`

## 2) Expose edilecek servisler

- `frontend` servisini public edin (port `80`)
- Frontend, nginx reverse proxy ile backend'e API isteklerini yönlendirir
- Backend'i ayrı domain ile expose etmenize **gerek yoktur** (nginx proxy arkadan halleder)

## 3) Gerekli environment değişkenleri

Coolify'da aşağıdakileri tanımlayın:

- `JWT_SECRET`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `META_APP_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Opsiyonel:

- `ADMIN_USERNAME` (default: `admin`)
- `ADMIN_PASSWORD` (default: `admin123`)
- `VITE_API_BASE_URL` — **Genellikle boş bırakın**. Nginx reverse proxy sayesinde frontend ve backend aynı domain'den hizmet verir. Sadece backend'i ayrı bir domain'e koyduysanız belirtin (örn: `https://api.senin-domainin.com`).

## 4) Önemli notlar

- Frontend nginx üzerinden çalışır ve tüm API isteklerini (`/auth`, `/contacts`, `/templates`, `/send`, `/logs`, `/users`, `/webhooks`, `/health`) otomatik olarak backend container'a yönlendirir.
- `VITE_API_BASE_URL` build-time değişkendir. Boş bırakıldığında relative URL kullanılır (nginx proxy ile çalışır).
- Webhook URL'si olarak frontend domain'inizi kullanabilirsiniz: `https://<frontend-domain>/webhooks/whatsapp`
- Kullanıcı bazlı webhook kullanıyorsanız tam yol şu olmalı: `https://<frontend-domain>/webhooks/whatsapp/<webhookPath>`

## 5) İlk deploy sonrası kontrol

- Frontend: `https://<frontend-domain>`
- Backend health (nginx proxy üzerinden): `https://<frontend-domain>/health`
- Varsayılan giriş: `admin` / `admin123`
