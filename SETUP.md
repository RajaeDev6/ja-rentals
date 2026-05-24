# JA Rentals — Setup Guide

## Prerequisites
- Node 18+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (Blaze plan required for scheduled functions)

---

## 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project
2. Enable **Firestore** (production mode)
3. Enable **Cloud Functions**
4. Enable **Hosting**

---

## 2. Frontend Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your Firebase project config from the Firebase console (Project Settings → Your apps → Web app).

---

## 3. Firebase Project ID

Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your actual project ID.

---

## 4. Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore
```

---

## 5. Set Function Secrets (API keys)

```bash
# RapidAPI key (required for the API engine)
firebase functions:secrets:set RAPIDAPI_KEY

# RapidAPI host (the API endpoint host, e.g. real-estate15.p.rapidapi.com)
firebase functions:secrets:set RAPIDAPI_HOST

# Optional: health check protection
firebase functions:secrets:set HEALTH_CHECK_SECRET
```

To find a Jamaica real estate API on RapidAPI:
- Search for "real estate" at rapidapi.com
- Look for APIs that support country/location filtering with "JM" or "Jamaica"
- Popular options: "Realtor", "Zillow", or Caribbean-specific property APIs
- Copy the `X-RapidAPI-Host` value and update `rapidApi.ts` endpoint URL accordingly

---

## 6. Deploy Functions

```bash
cd functions && npm run build
cd ..
firebase deploy --only functions
```

---

## 7. Trigger First Data Pull

In the Firebase Console → Functions → `fetchAll` → **Test in Cloud Shell**,
or wait up to 6 hours for the first scheduled run.

---

## 8. Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

---

## Scraper Notes

The scrapers target:
- `realestatejamaica.com/for-rent/`
- `coldwellbankerjamaica.com/rentals`

CSS selectors are marked with `// VERIFY:` comments in the scraper files. If a site updates its layout, update the selectors in:
- `functions/src/scrapers/realEstateJamaica.ts`
- `functions/src/scrapers/coldwellBanker.ts`

The scrapers are polite: 2.5–3 second delays between pages, max 4–5 pages per run, User-Agent identifies as a bot.

---

## Local Development

```bash
# Frontend dev server
npm run dev

# Functions (requires Firebase emulator)
firebase emulators:start --only firestore,functions
```
