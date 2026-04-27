// ─── 4. db.js — database helper layer ──────────────────────────
import { get, onValue, push, ref, set } from 'firebase/database';
import { db } from './firebase';
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
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const readRef = ref(db, `users/${uid}/history/${today}/readings`);
    await push(readRef, { ts: Date.now(), ml: Math.round(ml) });

    // Update daily total
    const totRef = ref(db, `users/${uid}/history/${today}/totalMl`);
    const snap = await get(totRef);
    const current = snap.val() ?? 0;
    await set(totRef, current + ml);
}

/**
 * Get history for the last N days.
 */
export async function getHistory(uid, days = 7) {
    const results = [];
    for (let i = 0; i < days; i++) {
        const d = new Date();
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
    const friendUids = Object.keys(friendsSnap.val() ?? {});
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
    const stRef = ref(db, `waterStations/${stationId}`);
    const snap = await get(stRef);
    const station = snap.val();
    const newVotes = (station.votes ?? 0) + 1;
    const newRating = ((station.rating ?? rating) * (newVotes - 1) + rating) / newVotes;
    await set(stRef, { ...station, rating: newRating, votes: newVotes });
}

/**
 * Get all reviews for a specific station.
 */
export async function getReviewsForStation(stationId) {
    const snap = await get(ref(db, `reviews/${stationId}`));
    if (!snap.exists()) return [];
    
    // Convert object of objects into an array
    const data = snap.val();
    return Object.keys(data).map(key => ({
        id: key,
        ...data[key]
    })).sort((a, b) => b.createdAt - a.createdAt); // newest first
}

/**
 * Add a new review to a station.
 */
export async function addReviewForStation(stationId, rating, comment, userId) {
    const reviewRef = ref(db, `reviews/${stationId}`);
    await push(reviewRef, {
        userId: userId || null,
        rating: Number(rating),
        comment: comment || "",
        createdAt: Date.now()
    });
}

/**
 * Search users by exact email across the system.
 */
export async function searchUsersByEmail(emailStr) {
    if (!emailStr) return [];
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) return [];
    
    const usersObj = usersSnap.val();
    const matches = [];
    Object.keys(usersObj).forEach(uid => {
        const profile = usersObj[uid].profile || {};
        const userEmail = profile.email || usersObj[uid].email || ""; // accommodate loose structuring
        if (userEmail.toLowerCase() === emailStr.toLowerCase()) {
            matches.push({ uid, displayName: profile.displayName || "Unknown", email: userEmail });
        }
    });
    return matches;
}

/**
 * Dispatch an outbound Friend Request.
 */
export async function sendFriendRequest(senderId, receiverId) {
    if (!senderId || !receiverId) throw new Error("Missing IDs");
    if (senderId === receiverId) throw new Error("Cannot add yourself");
    
    // Safety check if already friends
    const checkSnap = await get(ref(db, `users/${senderId}/friends/${receiverId}`));
    if (checkSnap.exists() && checkSnap.val() === true) {
        throw new Error("Already friends!");
    }

    const reqRef = ref(db, `friendRequests/${receiverId}/${senderId}`);
    await set(reqRef, {
        status: "pending",
        createdAt: Date.now()
    });
}

/**
 * Accept or reject an inbound Friend Request.
 */
export async function respondToFriendRequest(myId, senderId, accept) {
    const reqRef = ref(db, `friendRequests/${myId}/${senderId}`);
    if (accept) {
        // Create bilateral friend relationship
        await set(ref(db, `users/${myId}/friends/${senderId}`), true);
        await set(ref(db, `users/${senderId}/friends/${myId}`), true);
    }
    // Remove the request node outright
    await set(reqRef, null);
}

/**
 * Get array of Pending Request Profiles targeted at current user.
 */
export async function getPendingRequests(myId) {
    const reqSnap = await get(ref(db, `friendRequests/${myId}`));
    if (!reqSnap.exists()) return [];
    
    const data = reqSnap.val();
    const senders = Object.keys(data).filter(k => data[k].status === 'pending');
    
    const profiles = await Promise.all(
        senders.map(async (senderId) => {
            const pSnap = await get(ref(db, `users/${senderId}/profile`));
            const baseUser = await get(ref(db, `users/${senderId}`));
            const email = pSnap.val()?.email || baseUser.val()?.email || "No email";
            const name = pSnap.val()?.displayName || "Unknown";
            return { uid: senderId, displayName: name, email };
        })
    );
    return profiles;
}

/**
 * Get simple array of Friend UIDs for lightweight Maps array-matching logic.
 */
export async function getUserFriendsList(uid) {
    if (!uid) return [];
    const snap = await get(ref(db, `users/${uid}/friends`));
    if (!snap.exists()) return [];
    return Object.keys(snap.val());
}

/**
 * Safely scrape specific user's historical reviews. Note: Doing this unindexed is
 * standard for standard Firebase DB MVP states on a lightweight corpus.
 */
export async function getRecentUserReviews(uid) {
    const allRevsSnap = await get(ref(db, `reviews`));
    if (!allRevsSnap.exists()) return [];
    const revsData = allRevsSnap.val();
    
    const userReviews = [];
    Object.keys(revsData).forEach(stationId => {
        const stationReviews = revsData[stationId];
        Object.keys(stationReviews).forEach(reviewId => {
            const rev = stationReviews[reviewId];
            if (rev.userId === uid) {
                userReviews.push({ stationId, reviewId, ...rev });
            }
        });
    });
    
    // Sort descending by Time
    return userReviews.sort((a, b) => b.createdAt - a.createdAt);
}
