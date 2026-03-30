📄 SYSTEM.md
WhatsApp Bulk Messaging SaaS (Meta Uyumlu)
🚀 1. AMAÇ

Bu sistem, kullanıcıların:

Kişi listesi yönetmesini
Template oluşturmasını
WhatsApp üzerinden tekli ve toplu mesaj göndermesini
Mesaj geçmişini takip etmesini
Basit otomasyonlar kurmasını

sağlayan bir SaaS platformudur.

🧱 2. SİSTEM MODÜLLERİ
🧍‍♂️ 2.1 Contact (Kişi Yönetimi)
Alanlar:
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "tag": "string",
  "createdAt": "date"
}
Özellikler:
➕ Manuel kişi ekleme
📂 CSV ile toplu import
📋 Listeleme
🗑️ Silme
🏷️ Tag ile filtreleme
👥 Gruplama
💬 2.2 Template Yönetimi
Alanlar:
{
  "id": "uuid",
  "name": "string",
  "language": "tr | en",
  "content": "string",
  "variables": ["name", "order_id"],
  "status": "approved | pending"
}
Örnek:
Merhaba {{name}}, siparişiniz hazır.
Özellikler:
✍️ Template oluştur
📋 Listele
✏️ Düzenle
❌ Sil
🔁 Variable parsing
📤 2.3 Mesaj Gönderme
🔹 Tekli Gönderim
POST /send
{
  "phone": "905xxxxxxxxx",
  "templateId": "uuid",
  "variables": {
    "name": "Ahmet"
  }
}
🔹 Toplu Gönderim
POST /send/bulk
{
  "contactIds": ["id1", "id2"],
  "templateId": "uuid"
}
Özellikler:
Template + variable mapping
Queue destekli gönderim
Retry mekanizması
📜 2.4 Message Logs
Alanlar:
{
  "id": "uuid",
  "phone": "string",
  "templateId": "uuid",
  "status": "sent | failed",
  "error": "string",
  "createdAt": "date"
}
Özellikler:
📊 Gönderim geçmişi
❌ Hata logları
🔍 Filtreleme
⚙️ 2.5 Otomasyon (Opsiyonel)
Use-case’ler:
Yeni kişi → otomatik mesaj
Günlük hatırlatma
Event-based trigger
🖥️ 3. FRONTEND (React)
Sayfalar
🏠 Dashboard
Toplam kişi sayısı
Toplam mesaj sayısı
Başarı oranı
👥 Contacts
Listeleme
CSV upload
Add / Delete
Tag filtreleme
🧾 Templates
Template listesi
Create / Edit
Variable preview
📨 Send Message
Kişi veya liste seçimi
Template seçimi
Preview
Gönder
📊 Logs
Mesaj geçmişi
Status filtreleme
Ana Component Yapısı
/components
  ContactList.jsx
  TemplateList.jsx
  SendForm.jsx
  Logs.jsx
  Dashboard.jsx
🧠 4. BACKEND (Node.js + Express)
📁 Klasör Yapısı
/src
  /controllers
  /services
  /routes
  /models
  /queue
  /utils
API ENDPOINTS
👥 Contacts
POST   /contacts
GET    /contacts
DELETE /contacts/:id
POST   /contacts/import (CSV)
🧾 Templates
POST /templates
GET  /templates
PUT  /templates/:id
DELETE /templates/:id
📤 Send
POST /send
POST /send/bulk
📜 Logs
GET /logs
🔌 5. WHATSAPP ENTEGRASYON
✅ ÖNERİLEN: WhatsApp Cloud API
Avantajlar:
Meta onaylı
Güvenli
App Review geçer
Gerekli:
Meta App
WhatsApp Business hesabı
Access Token
⚠️ Alternatif: Baileys
Kurulumu kolay
Ama:
Ban riski ⚠️
Meta review’da fail ❌
🎥 6. APP REVIEW AKIŞI
VIDEO 1
Contact ekle
Template seç
Mesaj gönder
Telefonda göster
VIDEO 2
Template oluştur
Kaydet
🧩 7. DATABASE ŞEMASI (PostgreSQL)
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  name TEXT,
  phone TEXT,
  tag TEXT
);

CREATE TABLE templates (
  id UUID PRIMARY KEY,
  name TEXT,
  content TEXT,
  language TEXT
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  phone TEXT,
  template_id UUID,
  status TEXT,
  error TEXT
);
⚡ 8. QUEUE SYSTEM (ÖNERİLEN)
BullMQ + Redis
Amaç:
Rate limit
Spam önleme
Retry
Akış:
API → Queue → Worker → WhatsApp API
🔥 9. PRO LEVEL ÖZELLİKLER
⏱️ Rate limiting
📬 Webhook listener (delivery status)
🧠 Smart retry logic
📊 Analytics dashboard
👤 Multi-user (SaaS için)
🚀 10. GELİŞTİRME ROADMAP
🥇 PHASE 1 (MVP)
Contacts CRUD
Template CRUD
Tekli mesaj gönderme
🥈 PHASE 2
Bulk messaging
Logs
Dashboard
🥉 PHASE 3
Queue system
Automation
Webhooks
🏁 PHASE 4 (SaaS)
Auth sistemi
Multi-tenant
Billing
🎯 SONUÇ

Bu sistem:

✔ Meta App Review’dan geçebilir
✔ Gerçek kullanım sunar
✔ Ölçeklenebilir
✔ SaaS’a dönüşebilir

İstersen bir sonraki adımda sana:
👉 Backend’i 0’dan çalışan kod olarak (Express + DB + Queue)
👉 ya da direkt React + Node full starter repo

hazırlayabilirim.

mongo db kullanan ve docker ile uyumlu bir sistem olmasını istiyprum

Güzel—o zaman sistemi MongoDB + Docker-first (container-ready) olacak şekilde netleştirelim. Aşağıya sana direkt kullanabileceğin geliştirilebilir SYSTEM.md (Mongo + Docker versiyonu) bırakıyorum.

📄 SYSTEM.md
WhatsApp Bulk Messaging SaaS (MongoDB + Docker)
🚀 1. AMAÇ

Bu sistem:

Kişi yönetimi
Template yönetimi
WhatsApp mesaj gönderimi (tekli + bulk)
Mesaj loglama
Basit otomasyon

sağlayan Docker ile çalıştırılabilir bir SaaS backend + frontend sistemidir.

🧱 2. TEKNOLOJİ STACK
Backend
Node.js (Express)
MongoDB (Mongoose)
Redis (BullMQ queue için)
Frontend
React (Vite önerilir)
DevOps
Docker
Docker Compose
🗂️ 3. PROJE YAPISI
project-root/
│
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── queue/
│   │   └── app.js
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── .env
🍃 4. MONGODB SCHEMA (Mongoose)
👥 Contact Model
const ContactSchema = new mongoose.Schema({
  name: String,
  phone: { type: String, required: true },
  tag: String
}, { timestamps: true });
💬 Template Model
const TemplateSchema = new mongoose.Schema({
  name: String,
  language: String,
  content: String,
  variables: [String],
  status: { type: String, default: "pending" }
}, { timestamps: true });
📜 Message Model
const MessageSchema = new mongoose.Schema({
  phone: String,
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" },
  status: String,
  error: String
}, { timestamps: true });
🧠 5. BACKEND (Express)
app.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo connected"))
  .catch(err => console.error(err));

app.get("/", (req, res) => {
  res.send("API running");
});

app.listen(5000, () => console.log("Server started"));
🔌 6. API ENDPOINTS
👥 Contacts
POST   /contacts
GET    /contacts
DELETE /contacts/:id
POST   /contacts/import
💬 Templates
POST   /templates
GET    /templates
PUT    /templates/:id
DELETE /templates/:id
📤 Send
POST /send
POST /send/bulk
📜 Logs
GET /logs
⚙️ 7. QUEUE (BullMQ + Redis)
queue.js
import { Queue } from "bullmq";

export const messageQueue = new Queue("messages", {
  connection: {
    host: "redis",
    port: 6379
  }
});
worker.js
import { Worker } from "bullmq";

new Worker("messages", async job => {
  const { phone, template } = job.data;

  // WhatsApp API call burada yapılır

  console.log("Sending to:", phone);
}, {
  connection: { host: "redis", port: 6379 }
});
🐳 8. DOCKER SETUP
backend/Dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "src/app.js"]
frontend/Dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]
docker-compose.yml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/whatsapp
    depends_on:
      - mongo
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  mongo:
    image: mongo
    ports:
      - "27017:27017"

  redis:
    image: redis
    ports:
      - "6379:6379"
🔌 9. WHATSAPP CLOUD API ENTEGRASYON
Service örneği
import axios from "axios";

export const sendWhatsAppMessage = async (phone, message) => {
  await axios.post(
    `https://graph.facebook.com/v18.0/YOUR_PHONE_ID/messages`,
    {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    }
  );
};
🧪 10. ÇALIŞTIRMA
docker-compose up --build
🔥 11. PRO LEVEL EKLEMELER
Rate limit middleware
Retry strategy (failed jobs)
Webhook listener (delivery status)
Multi-tenant yapı
Auth (JWT)
🚀 12. ROADMAP
PHASE 1
Mongo + Express setup
Contact & Template CRUD
PHASE 2
WhatsApp gönderim
Logs
PHASE 3
Queue system
Bulk send
PHASE 4
Automation
SaaS dönüşüm
🎯 SONUÇ

Bu yapı:

✔ Docker ile tek komut çalışır
✔ Mongo ile esnek veri modeli sağlar
✔ Queue ile scalable olur
✔ Meta Cloud API ile uyumlu