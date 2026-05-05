// ─── 4. db.js — database helper layer ──────────────────────────
import { get, onValue, push, ref, set, update } from 'firebase/database';
import { db } from './firebase';
/**
 * Synchronize User Auth object cleanly to Database
 */
export async function syncUserProfile(user) {
    if (!user) return;
    const profileRef = ref(db, `users/${user.uid}/profile`);
    console.log("Saving Auth Profile to path:", `users/${user.uid}/profile`);

    const snap = await get(profileRef);
    if (!snap.exists()) {
        await set(profileRef, {
            email: (user.email || "").toLowerCase().trim(),
            displayName: user.displayName || "",
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    } else {
        await update(profileRef, {
            email: (user.email || "").toLowerCase().trim(),
            updatedAt: Date.now()
        });
    }
}

/**
 * Queries the specific mapping index to prove ownership
 */
export async function checkUsernameExists(username) {
    const un = username.toLowerCase().trim();
    const snap = await get(ref(db, `usernames/${un}`));
    return snap.exists();
}

/**
 * Configure explicit Username bindings securely
 */
export async function setUsername(uid, username, displayName, email) {
    const unLower = username.toLowerCase().trim();
    const valid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!valid) throw new Error("Username must be between 3-20 characters and contain no spaces or special symbols.");
    
    // Check collision explicitly
    const taken = await checkUsernameExists(unLower);
    if (taken) throw new Error("Username is already taken.");

    // Format Data
    const updates = {
        username: username.trim(),
        usernameLower: unLower,
        updatedAt: Date.now()
    };
    if (displayName) updates.displayName = displayName;
    if (email) updates.email = email.toLowerCase().trim();
    
    await update(ref(db, `users/${uid}/profile`), updates);
    
    // Claim string uniquely across Global Index
    await set(ref(db, `usernames/${unLower}`), uid);
}

/**
 * Subscribe to live coaster data for a user.
 * Calls callback(data) whenever ESP32 writes a new reading.
 */
export function subscribeToLive(uid, callback) {
    const liveRef = ref(db, `users/${uid}/live`);
    return onValue(liveRef, async (snap) => {
        const val = snap.val();
        if (val) {
            // DB Migration Guard: Legacy keys
            if (val.totalDrunkMl !== undefined && val.totalDrankML === undefined) {
               console.log(`[MIGRATION INITIATED] Copying legacy totalDrunkMl (${val.totalDrunkMl}) to totalDrankML for user: ${uid}`);
               await update(liveRef, { 
                   totalDrankML: val.totalDrunkMl, 
                   totalDrunkMl: null 
               });
               return; // Next DB tick will parse the fresh node correctly
            }
            
            // Runtime dynamic fallback
            if (val.totalDrankML === undefined && val.totalDrunkMl !== undefined) {
               val.totalDrankML = val.totalDrunkMl;
            }
        }
        callback(val);
    });
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
    const friendsSnap = await get(ref(db, `friends/${uid}`));
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
 * Search users dynamically by username OR email.
 */
export async function searchUsers(queryStr, currentUid) {
    if (!queryStr) return [];
    const q = queryStr.toLowerCase().trim();
    console.log(`[SEARCH] Querying database: ${q}`);
    
    const matches = [];

    // A real email has text on both sides of @; a bare @username does not.
    const isEmail = /^[^\s@]+@[^\s@]+/.test(q);

    if (isEmail) {
        const usersSnap = await get(ref(db, 'users'));
        if (!usersSnap.exists()) return [];

        const usersObj = usersSnap.val();
        Object.keys(usersObj).forEach(uid => {
            if (uid === currentUid) return;

            const profile = usersObj[uid].profile || {};
            const userEmail = profile.email || usersObj[uid].email || "";
            if (userEmail.toLowerCase().trim() === q) {
                matches.push({
                    uid,
                    displayName: profile.displayName || "Unknown",
                    email: userEmail,
                    username: profile.username || ""
                });
            }
        });
    } else {
        // Strip a leading @ so "@johndoe" and "johndoe" both resolve correctly.
        const usernameQuery = q.startsWith('@') ? q.slice(1) : q;

        // Fast O(1) index lookup
        const indexSnap = await get(ref(db, `usernames/${usernameQuery}`));
        if (indexSnap.exists()) {
            const matchUid = indexSnap.val();
            if (matchUid !== currentUid) {
                const profileSnap = await get(ref(db, `users/${matchUid}/profile`));
                if (profileSnap.exists()) {
                    const profile = profileSnap.val();
                    matches.push({
                        uid: matchUid,
                        displayName: profile.displayName || "Unknown",
                        email: profile.email || "",
                        username: profile.username || usernameQuery
                    });
                }
            }
        }
    }

    console.log(`[SEARCH] Found matches:`, matches);
    return matches;
}

/**
 * Dispatch an outbound Friend Request.
 */
export async function sendFriendRequest(senderId, receiverId) {
    if (!senderId || !receiverId) throw new Error("Missing IDs");
    if (senderId === receiverId) throw new Error("Cannot add yourself");
    
    // Safety check if already friends
    const checkSnap = await get(ref(db, `friends/${senderId}/${receiverId}`));
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
export async function respondToFriendRequest(currentUserUid, senderUid, accept) {
    console.log("[FRIEND] respondToFriendRequest called");
    console.log("[FRIEND] currentUserUid (receiver):", currentUserUid);
    console.log("[FRIEND] senderUid (requester):", senderUid);
    console.log("[FRIEND] accept:", accept);

    try {
        if (accept) {
            const path1 = `friends/${currentUserUid}/${senderUid}`;
            const path2 = `friends/${senderUid}/${currentUserUid}`;
            const path3 = `friendRequests/${currentUserUid}/${senderUid}`;

            console.log("[FRIEND] Writing path:", path1, "→ true");
            console.log("[FRIEND] Writing path:", path2, "→ true");
            console.log("[FRIEND] Writing path:", path3, "→ null");

            await update(ref(db), {
                [path1]: true,
                [path2]: true,
                [path3]: null,
            });
        } else {
            const path3 = `friendRequests/${currentUserUid}/${senderUid}`;
            console.log("[FRIEND] Rejecting — removing path:", path3);
            await set(ref(db, path3), null);
        }

        console.log("[FRIEND] respondToFriendRequest succeeded");
    } catch (error) {
        console.error("Accept request failed:", error.code, error.message);
        throw error;
    }
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
    const snap = await get(ref(db, `friends/${uid}`));
    if (!snap.exists()) return [];
    return Object.keys(snap.val());
}

/**
 * Get individual sip readings for today's activity feed.
 */
export async function getTodayReadings(uid) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const snap = await get(ref(db, `users/${uid}/history/${today}/readings`));
    if (!snap.exists()) return [];
    return Object.values(snap.val()).sort((a, b) => a.ts - b.ts);
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
