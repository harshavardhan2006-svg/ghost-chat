# Ghost Chat

An ultra-premium, real-time messaging application inspired by Instagram, built with React Native (Expo) and Fastify (Node.js).

---

## Technical Stack

- **Frontend**: React Native, Expo, FlashList, Zustand, Axios, Socket.IO Client.
- **Backend**: Fastify (Node.js), TypeScript, MongoDB (Mongoose), Redis (Socket.IO adapter/caching), Socket.IO.
- **Media Hosting**: Cloudinary.
- **Design System**: Vanilla CSS tokens, glassmorphism, dynamic spring micro-animations.

---

## Features

- **Authentication**: JWT-based access & refresh token rotation with secure storage.
- **Pairing Flow**: Pairing code handshake to connect two users.
- **Real-Time Messages**: Instant Socket.IO chat client.
- **Multimedia Messages**:
  - **Camera**: Custom viewport overlay, retake/confirm reviews, and compression.
  - **Gallery**: Photo selector, preview review modal, compression, and retry actions.
  - **Voice Notes**: Hold-to-record mic gestures, slide-to-cancel trigger, live looping wave visualizer animations, and play/pause/resume status events.
- **Message Reactions**: Double-tap bubble for `❤️` reactions or long press to pop up an emoji scale selector overlay.
- **Swipe to Reply**: Swipe a bubble right to load a slide-up reply preview drawer.
- **Real-Time Presence**: Online/offline indicators and last-seen dynamic relative format descriptions (e.g., `Active 5m ago`, `Active yesterday`).
- **Disappearing Messages**: Messages automatically expire and are purged from MongoDB, Cloudinary, and caches exactly 10 minutes after the recipient sees them. Shows a live-ticking countdown clock overlay (`⏱ 9:59`) and plays a smooth fade-out deletion animation.

---

## Setup & Local Development

### 1. Prerequisites
- **Node.js**: v18+ recommended.
- **MongoDB**: Active connection (local or Atlas cluster).
- **Redis**: Active instance (local or cloud).
- **Cloudinary**: Account credentials for media storage.

### 2. Environment Variables Configuration
Configure the server settings by creating a `.env` file inside the `server/` directory:
```bash
cp server/.env.example server/.env
```

Define the variables:
- `MONGO_URI`: MongoDB connection string.
- `REDIS_URL`: Redis connection URL.
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: Secure cryptographic secret strings (at least 32 characters).
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`: Cloudinary API credentials.

Configure the mobile API target:
Edit the target API gateway URL inside [app.json](file:///c:/Users/harsh/OneDrive/Desktop/Ghost-chat/mobile/app.json) under `expo.extra.apiUrl`:
```json
"extra": {
  "apiUrl": "http://<YOUR_LOCAL_IP>:5000/api/v1"
}
```

---

## Running the Application Locally

### 1. Start Backend API Server
```bash
cd server
npm install
npm run dev
```

### 2. Start Mobile Client (Metro Bundler)
```bash
cd mobile
npm install
npm run start
```
Use `a` for Android Emulator or `i` for iOS Simulator.

---

## Build Commands

### 1. Build Backend for Production
```bash
cd server
npm run build
# Starts the compiled server in dist/server.js
npm run start
```

### 2. Build Mobile Application APK (Android)
To build a standalone APK, ensure you have the `eas-cli` installed and run:
```bash
cd mobile
# Log in to Expo account
npx eas login
# Configure build credentials
npx eas build:configure
# Trigger local Android release build
npx eas build --platform android --profile preview --local
```
This compile check compiles all code cleanly and bundles the output directly into a local APK.
