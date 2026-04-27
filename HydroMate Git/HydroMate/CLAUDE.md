# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npx expo start       # Start dev server (scan QR with Expo Go or press i/a for simulator)
npx expo start --ios     # Open directly in iOS simulator
npx expo start --android # Open directly in Android emulator
expo lint            # Run ESLint
node scripts/migrateDB.js  # Run DB migration script (against live Firebase RTDB)
```

## Architecture

HydroMate is a React Native / Expo app (file-based routing via expo-router) that pairs with a physical ESP32 smart water coaster. The coaster writes live weight/hydration data directly to Firebase Realtime Database; the app reads and displays it.

**Key layers:**

- `firebase.js` — initializes Firebase app, exports `auth` (Firebase Auth) and `db` (Realtime Database). All screens import from here.
- `db.js` — the entire database helper layer. All Firebase RTDB reads/writes go through functions here. Never call Firebase SDK directly from screens.
- `app/_layout.tsx` — root layout; owns the auth state machine (Firebase `onAuthStateChanged`), route guard (redirects unauthenticated users to `/login`), and the legacy-user username intercept modal.
- `app/(tabs)/_layout.tsx` — tab bar shell with three tabs: Today, Friends, Stations.
- `app/(tabs)/*.tsx` — thin wrappers that re-export the actual screen components from `screens/`.
- `screens/` — all real screen logic lives here as `.js` files (not `.tsx`).

**Screens:**
- `HomeScreen.js` — subscribes to live coaster data (`subscribeToLive`), shows a plant-avatar hydration metaphor, animated water bottle fill, stat cards, and 7-day history bar chart.
- `FriendsScreen.js` — friend management: view friends ranked by hydration, search by username or email, send/accept/reject friend requests, view a friend's profile modal with their recent station reviews.
- `MapScreen.js` — shows UCSD water refill stations (hardcoded in `data/refillStations.js`) on a dark-styled MapView; supports per-station reviews with friends-only filtering.
- `LoginScreen.js` — handles sign-in and sign-up with email/password; new users pick a display name and username at registration.

**Firebase RTDB schema (key paths):**
- `users/{uid}/profile` — email, displayName, username, usernameLower, createdAt, updatedAt
- `users/{uid}/live` — real-time coaster data: `weightG`, `totalDrankML`, `alertActive`
- `users/{uid}/history/{YYYYMMDD}/totalMl` and `.../readings` — daily sip log
- `users/{uid}/friends/{friendUid}` — bilateral boolean friendship map
- `friendRequests/{receiverId}/{senderId}` — pending friend request nodes
- `usernames/{usernameLower}` — global uniqueness index mapping lowercase username → uid
- `waterStations/{stationId}` — refill station records
- `reviews/{stationId}/{reviewId}` — user reviews

**DB migration note:** The live data field was renamed from `totalDrunkMl`/`totalDrunkML` to `totalDrankML`. `db.js` includes a runtime migration guard in `subscribeToLive` that copies and nullifies legacy keys on first read. `scripts/migrateDB.js` is the one-off bulk migration script.

## Design system

Dark navy theme throughout. Core palette hardcoded inline in `StyleSheet.create` calls:
- Background: `#0A1628` (primary), `#0D2137` (cards)
- Accent/primary: `#4FC3F7` (sky blue)
- Borders: `#1E3A5F`
- Muted text: `#546E8A`

`constants/theme.ts` exports `Colors` and `Fonts` but most screens use the inline palette above rather than the theme constants.
