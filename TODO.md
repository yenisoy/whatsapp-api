# WhatsApp Bulk Messaging SaaS - Takip Dokümanı

Bu dosya, geliştirme sürecini adım adım takip etmek için tek kaynak olarak kullanılacaktır.

## Durum Anahtarı
- [ ] Başlanmadı
- [~] Devam ediyor
- [x] Tamamlandı

## 0) Hazırlık
- [x] Kapsam ve env değişkenlerini netleştir

## 1) Altyapı ve Kurulum
- [x] Docker compose altyapısını kur
- [x] Backend temel Express iskeleti
- [x] Mongo modellerini oluştur

## 2) Temel İşlevler (MVP)
- [x] Contact CRUD + CSV/Excel import + template
- [x] Template CRUD + variable parsing
- [x] WhatsApp servis entegrasyonu
- [x] Tekli ve bulk gönderim API
- [x] Message log ve filtreleme

## 3) Ölçekleme
- [x] BullMQ queue ve worker

## 4) Frontend
- [x] Frontend Vite temel kurulumu
- [x] Contacts ve Templates sayfaları
- [x] Send Message ve Logs sayfaları
- [x] Dashboard metrikleri ve oranlar

## 5) Doğrulama ve Sonraki Faz
- [x] Template'i Meta'ya publish etme (API + UI)
- [x] E2E test ve Docker doğrulama
- [x] Auth + rol bazlı kullanıcı yönetimi
- [x] Kişi/Template/Log verisini kullanıcı bazlı izole etme
- [x] Dashboard metriklerini gerçek kullanıcı loglarından hesaplama
- [ ] Phase 2+ backlog (webhook, billing)

## Çalışma Şekli
1. Her adım başlamadan önce ilgili maddeyi `[~]` yapacağız.
2. Adım tamamlanınca `[x]` olarak işaretleyeceğiz.
3. Bloke olan maddelerde altına kısa not düşeceğiz.
4. Bir sonraki adım her zaman bu dosyadan seçilecek.

## Bloke Notları
- Docker daemon bağlantı sorunu giderildi; servisler `docker compose up --build -d` ile çalışır durumda.
- Redis host port çakışması için compose içinde `6380:6379` kullanılıyor.
- Toplu gönderim akışı BullMQ ile kuyruk tabanlı çalışıyor; worker servisinin açık olması gerekiyor.
- Meta template publish çalışıyor; Meta tarafında değişken/sözcük oranı kuralı nedeniyle çok kısa gövdelerde `Invalid parameter` dönebilir.
- Kullanıcı bazlı `WHATSAPP_TOKEN/PHONE_ID/WABA_ID` ayarları profile ekranından güncelleniyor ve gönderim/publish bu ayarları kullanıyor.
