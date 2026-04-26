import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, get } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
 
// Replace with your project's config from Firebase Console → Project settings
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
 
const app      = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);
 
// ─── 4. db.js — database helper layer ──────────────────────────
 
/**
 * Subscribe to live coaster data for a user.
 * Calls callback(data) whenever ESP32 writes a new reading.
 */
export function subscribeToLive(uid, callback) {
  const liveRef = ref(db, `users/${uid}/live`);
  return onValue(liveRef, (snap) => callback(snap.val()));
  // returns the unsubscribe function — call it in useEffect cleanup
}
 
/**
 * Log a sip event to today's history bucket.
 */
export async function logSip(uid, ml) {
  const today   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const readRef = ref(db, `users/${uid}/history/${today}/readings`);
  await push(readRef, { ts: Date.now(), ml: Math.round(ml) });
 
  // Update daily total
  const totRef  = ref(db, `users/${uid}/history/${today}/totalMl`);
  const snap    = await get(totRef);
  const current = snap.val() ?? 0;
  await set(totRef, current + ml);
}
 
/**
 * Get history for the last N days.
 */
export async function getHistory(uid, days = 7) {
  const results = [];
  for (let i = 0; i < days; i++) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10).replace(/-/g, '');
    const snap = await get(ref(db, `users/${uid}/history/${key}/totalMl`));
    results.unshift({ date: key, ml: snap.val() ?? 0 });
  }
  return results;
}
 
/**
 * Get friend live data (for friend-tracking screen).
 */
export async function getFriendsData(uid) {
  const friendsSnap = await get(ref(db, `users/${uid}/friends`));
  const friendUids  = Object.keys(friendsSnap.val() ?? {});
  const data = await Promise.all(
    friendUids.map(async (fuid) => {
      const [profile, live] = await Promise.all([
        get(ref(db, `users/${fuid}/profile`)),
        get(ref(db, `users/${fuid}/live`)),
      ]);
      return { uid: fuid, ...profile.val(), live: live.val() };
    })
  );
  return data;
}
 
/**
 * Fetch all water stations (for map screen).
 */
export async function getWaterStations() {
  const snap = await get(ref(db, 'waterStations'));
  return Object.entries(snap.val() ?? {}).map(([id, v]) => ({ id, ...v }));
}
 
/**
 * Submit a rating for a water station.
 */
export async function rateStation(stationId, rating) {
  const stRef   = ref(db, `waterStations/${stationId}`);
  const snap    = await get(stRef);
  const station = snap.val();
  const newVotes  = (station.votes ?? 0) + 1;
  const newRating = ((station.rating ?? rating) * (newVotes - 1) + rating) / newVotes;
  await set(stRef, { ...station, rating: newRating, votes: newVotes });
}
