# Kolkata Fatafat Live Results Portal & Admin Hub 🚀

A high-performance, mobile-first live results portal and PIN-protected management dashboard for daily round results (Bazis 1 to 8), charts, and timetables. Includes Progressive Web App (PWA) capabilities and Android APK distribution support.

---

## ✨ Features

- **⚡ Fast Live Results Board:** 8 round cards displaying Patti (3 digits) and Single (1 digit) numbers with status tags (*Waiting*, *Live Now*, *Declared*).
- **🔒 PIN-Protected Admin Hub:**
  - Secure login using a customizable **Secret Access PIN** (no public registration).
  - One-click publishing for each round with automatic single-digit calculation from Patti.
  - Live Ticker Announcement updater.
  - Reset board to "Waiting" for a fresh draw cycle.
  - In-dashboard option to update the Access PIN.
- **📅 Historical Chart & Archive:** Filter past winning numbers by date.
- **🕒 Timetable Schedule:** Live timetable of draw release times.
- **📱 Android APK & PWA Ready:**
  - One-click install prompt on mobile browsers ("Add to Home Screen" as a standalone app).
  - Offline caching via Service Worker.
  - Can be exported as a standalone Android `.apk` file.

---

## 🛠️ Project Structure

```text
kolkata-fatafat-portal/
├── data/
│   └── results.json          # Persistent JSON store for results & charts
├── public/
│   ├── index.html            # Public live results frontend
│   ├── admin.html            # PIN-protected Admin Dashboard
│   ├── app.js                # Public client script & live polling
│   ├── admin.js              # Admin logic & token management
│   ├── styles.css            # Responsive, mobile-first design
│   ├── manifest.json         # Android PWA web manifest
│   ├── service-worker.js     # Offline cache service worker
│   └── icons/                # App icons (192x192, 512x512)
├── src/
│   ├── server.js             # Express API server & routes
│   └── auth.js               # PIN authentication & JWT tokens
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── package.json
└── README.md
```

---

## 🚀 Quick Start (Running Locally)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment & Admin PIN
Edit `.env` (or copy from `.env.example`):
```env
PORT=3000
ADMIN_PIN=7788
JWT_SECRET=super_secret_jwt_key_kolkata_ff_2026
```
*(Default Admin PIN is set to `7788`. You can change it to any custom PIN you want).*

### 3. Start the Server
```bash
npm start
```
- **Public Results Board:** [http://localhost:3000](http://localhost:3000)
- **Admin Control Hub:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 📱 Converting into an Android APK

There are two primary ways to distribute this to Android users:

### Option A: Progressive Web App (Instant Mobile App)
1. Open the website on Google Chrome on any Android smartphone.
2. Tap the **"📱 Install App"** button at the top (or browser menu > **"Install App"** / **"Add to Home screen"**).
3. The app is installed directly onto the phone as a standalone app with its own icon and splash screen.

### Option B: Building a Standalone `.apk` File (Google Bubblewrap / PWABuilder)
1. Visit [PWABuilder.com](https://www.pwabuilder.com/) or use the Google CLI tool **Bubblewrap**:
   ```bash
   npx @bubblewrap/cli init --manifest=https://your-domain.com/manifest.json
   npx @bubblewrap/cli build
   ```
2. This generates a signed Android `.apk` file that users can download and install directly on their devices.

---

## 🌐 Deploying to GitHub & Cloud

### Push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit of Kolkata Fatafat Results Portal & Admin Hub"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kolkata-fatafat-portal.git
git push -u origin main
```

### Deploy to Render / Railway / VPS:
1. Connect your GitHub repository to Render or Railway.
2. Set Environment Variables:
   - `PORT=3000`
   - `ADMIN_PIN=YOUR_SECRET_PIN`
   - `JWT_SECRET=YOUR_RANDOM_SECRET`
3. Build Command: `npm install`
4. Start Command: `npm start`
