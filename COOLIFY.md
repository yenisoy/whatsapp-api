# Coolify Deployment

Bu proje Coolify üzerinde `Docker Compose` olarak deploy edilmeye hazırdır.

## 1) Kaynak dosya

Coolify'da compose dosyası olarak aşağıdaki dosyayı seçin:

- `docker-compose.coolify.yml`

## 2) Expose edilecek servisler

- `frontend` servisini public edin (port `80`)
- İsterseniz `backend` servisini de ayrı domain ile public edebilirsiniz (port `5000`)

## 3) Gerekli environment değişkenleri

Coolify'da aşağıdakileri tanımlayın:

- `JWT_SECRET`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `META_APP_ID`
- `VITE_API_BASE_URL` (örn: `https://api.senin-domainin.com`)

Opsiyonel:

- `ADMIN_USERNAME` (default: `admin`)
- `ADMIN_PASSWORD` (default: `admin123`)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

## 4) Önemli not

`VITE_API_BASE_URL` build-time değişkendir. Frontend build edilirken doğru API domainini verdiğinizden emin olun.

## 5) İlk deploy sonrası kontrol

- Frontend: `https://<frontend-domain>`
- Backend health: `https://<backend-domain>/health`
