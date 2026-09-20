# Ufundi

Ufundi is a full-stack mobile prototype that connects customers with local artisans (Fundis) such as plumbers, electricians, carpenters, and masons.

## Tech Stack

- Mobile: React Native (Expo)
- Backend: Node.js + Express (MVC structure)
- Database: MongoDB
- Auth: JWT
- Maps/Geolocation: `react-native-maps` + Expo Location
- AI/NLP: Keyword + intent-based classifier

## Project Structure

```text
ufundi/
  backend/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
    sample-data/
  mobile/
    App.js
    services/
    utils/
```

## Backend Setup

1. Start MongoDB locally (Compass can be used to inspect data).
2. Configure environment:
   - Copy `backend/.env.example` to `backend/.env`
   - Add EgoSMS credentials (`COMMS_USERNAME`, `COMMS_API_KEY`, `COMMS_SENDER_ID`)
   - For local dev without SMS, set `COMMS_DEV_MODE=true` (OTP is printed in the server console)
   - To enable email OTP login, create a [Resend](https://resend.com) API key and add `RESEND_API_KEY` plus `EMAIL_OTP_FROM` (for example, `Ufundi <login@your-verified-domain.com>`). Resend requires the sending domain to be verified.
3. Install and run:

```bash
cd backend
npm install
npm run seed
npm run dev
```

Server runs at `http://localhost:5000`.

## Mobile Setup

```bash
cd mobile
npm install
npm start
```

If testing on a physical phone, replace `localhost` in `mobile/services/api.js` with your machine LAN IP.

Create `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

Enable **Maps SDK for Android/iOS** and **Geocoding API** in Google Cloud Console.

## Publish on Expo (app + backend)

`npx eas` only works inside **`mobile/`** (or use `npm run mobile:build` from the repo root). Running it from `~/Projects/ufundi` causes `could not determine executable to run`.

### 1. Backend must be reachable from phones

A built APK **cannot** call `localhost` or your LAN IP unless the phone is on the same Wi‑Fi. For real use:

1. Deploy `backend/` to a host with HTTPS (VPS, Railway, Render, etc.).
2. Set `MONGO_URI`, `JWT_SECRET`, and EgoSMS vars on that server.
3. Note the public API base, e.g. `https://ufundi-api.example.com/api`.

### 2. Point the mobile app at that API

Edit `mobile/eas.json` and replace `https://YOUR_PUBLIC_BACKEND_HOST/api` in the **preview** and **production** profiles with your real URL.

Or use EAS env (recommended):

```bash
cd mobile
npx eas-cli login
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value https://YOUR_HOST/api --environment preview
```

### 3. Build Android APK (first time / native changes)

```bash
cd mobile
npm install
npm run build:android
```

From repo root: `npm run mobile:build`

When the build finishes, open the link EAS prints and install the APK on your phone.

### 4. Push JS/UI updates (no new APK)

After the first build, ship code changes with:

```bash
cd mobile
npm run update:preview
```

### 5. Expo Go (dev only)

```bash
cd mobile
npx expo start
```

Use `mobile/.env` with your LAN IP for `EXPO_PUBLIC_API_URL` while the backend runs locally (`npm run dev` in `backend/`).

## Implemented REST APIs

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/otp/send` — send 6-digit OTP via EgoSMS (`phone`, `purpose`: `register` | `login`)
- `POST /api/auth/otp/verify-register` — complete signup after OTP (`phone`, `code`, `name`, `role`, …)
- `POST /api/auth/otp/verify-login` — login with OTP (`phone`, `code`)
- `POST /api/auth/email-otp/google/send` — verify the selected Google account, then send a six-digit login code to that Google email
- `POST /api/auth/email-otp/verify-login` — login with an email code (`email`, `code`)

### Maps & location
- `GET /api/maps/geocode?address=...` — address → coordinates (Google Geocoding)
- `GET /api/maps/reverse?lat=&lng=` — coordinates → address
- `GET /api/maps/nearby-fundis?lat=&lng=&category=&radiusKm=` — fundis in radius + recommendation scores
- `GET /api/maps/route?fromLat=&fromLng=&toLat=&toLng=` — distance km + ETA estimate
- `PUT /api/users/location` — save user location (auth required)

### Users
- `GET /api/users/profile`
- `PUT /api/users/update`

### Fundis
- `GET /api/fundis?category=plumbing&lat=-1.28&lng=36.81`
- `GET /api/fundis/:id`

### Jobs
- `POST /api/jobs`
- `GET /api/jobs/:userId`
- `GET /api/jobs/detail/:id`
- `PATCH /api/jobs/detail/:id/quote` — fundi submits quote
- `PATCH /api/jobs/detail/:id/status` — update job status

### AI
- `POST /api/ai/classify`

### Reviews
- `POST /api/reviews`
- `GET /api/reviews/:fundiId`

## Recommendation Engine

The backend ranks Fundis with:

`Score = (0.6 * Rating) + (0.4 * Proximity)`

Where:
- `Rating` is the average fundi rating (0 to 5)
- `Proximity` is normalized from distance (closer gives higher score)

Top 5 Fundis are returned.

## AI Classification

`POST /api/ai/classify`

Input:

```json
{
  "text": "My sink is leaking"
}
```

Output:

```json
{
  "category": "plumbing",
  "confidence": 0.83
}
```

## Mobile Screens Implemented

- Login/Register Screen
- Customer Dashboard
- AI Assistant Screen (chat-like problem input)
- Fundi List Screen (map + list)
- Fundi Profile Screen
- Job Request Screen
- Review Screen

## Default Seed Accounts

- Customer: `amina@example.com` / `password123`
- Fundi: `peter@fundi.com` / `password123`

## Notes

- Passwords are hashed with bcrypt.
- JWT is required for protected routes.
- All database operations use async/await.
- Problem images are compressed on mobile before upload submission.
