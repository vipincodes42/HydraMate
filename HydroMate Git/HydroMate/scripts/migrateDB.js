const DB_URL = "https://hydramate-ca0c1-default-rtdb.firebaseio.com";

async function runMigration() {
    console.log("Starting Firebase RTDB Hydration Migration...");
    
    // 1. Read every user under `users`
    const res = await fetch(`${DB_URL}/users.json`);
    const users = await res.json();
    if (!users) {
        console.log("No users found in database.");
        return;
    }

    let migratedCount = 0;
    
    // 2. Iterate each user
    for (const uid of Object.keys(users)) {
        const user = users[uid];
        if (!user || !user.live) {
            console.log(`Skipping UID: ${uid} (No live hardware data found)`);
            continue;
        }
        
        const live = user.live;
        const legacyValue = live.totalDrunkML !== undefined ? live.totalDrunkML : live.totalDrunkMl;
        
        // If live.totalDrankML is missing AND a legacy totalDrunk value exists
        if (live.totalDrankML === undefined && legacyValue !== undefined) {
            console.log(`[MIGRATING] UID: ${uid} | Moving value: ${legacyValue} mL`);
            
            // 3. PATCH request to confidently copy to totalDrankML and nullify legacy keys
            const patchPayload = {
                totalDrankML: legacyValue,
                totalDrunkML: null,
                totalDrunkMl: null
            };
            
            const patchRes = await fetch(`${DB_URL}/users/${uid}/live.json`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patchPayload)
            });
            
            if (patchRes.ok) {
                console.log(`  -> Successfully migrated UID: ${uid}`);
                migratedCount++;
            } else {
                console.log(`  -> FAILED to migrate UID: ${uid}:`, await patchRes.text());
            }
        } else {
            console.log(`[SKIPPING] UID: ${uid} (Already migrated or no legacy data)`);
        }
    }
    
    console.log(`\nMigration Complete! Successfully migrated ${migratedCount} users.`);
}

runMigration().catch(console.error);
