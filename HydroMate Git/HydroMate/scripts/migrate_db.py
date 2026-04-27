import urllib.request
import json

DB_URL = "https://hydramate-ca0c1-default-rtdb.firebaseio.com"

def run_migration():
    print("Starting Firebase RTDB Hydration Migration...")
    try:
        req = urllib.request.Request(f"{DB_URL}/users.json")
        with urllib.request.urlopen(req) as res:
            users = json.loads(res.read().decode())
    except Exception as e:
        print("Failed to fetch users:", e)
        return
        
    if not users:
        print("No users found.")
        return

    migrated_count = 0
    for uid, user in users.items():
        if not user or 'live' not in user:
            print(f"[SKIPPING] UID: {uid} (No live hardware data found)")
            continue
            
        live = user['live']
        # Extract potential legacy values
        legacy_val = live.get('totalDrunkML')
        if legacy_val is None:
            legacy_val = live.get('totalDrunkMl')
            
        has_drank = live.get('totalDrankML') is not None
        
        # If totalDrankML is missing AND a legacy totalDrunk value exists
        if not has_drank and legacy_val is not None:
            print(f"[MIGRATING] UID: {uid} | Moving value: {legacy_val} mL")
            
            patch_payload = {
                "totalDrankML": legacy_val,
                "totalDrunkML": None,
                "totalDrunkMl": None
            }
            
            patch_req = urllib.request.Request(
                f"{DB_URL}/users/{uid}/live.json",
                data=json.dumps(patch_payload).encode('utf-8'),
                method='PATCH'
            )
            patch_req.add_header('Content-Type', 'application/json')
            
            try:
                with urllib.request.urlopen(patch_req) as p_res:
                    if p_res.status == 200:
                        print(f"  -> Successfully migrated UID: {uid}")
                        migrated_count += 1
            except Exception as e:
                print(f"  -> FAILED to migrate UID: {uid}: {e}")
        else:
            print(f"[SKIPPING] UID: {uid} (Already migrated or no legacy data)")
            
    print(f"\nMigration Complete! Successfully migrated {migrated_count} users.")

run_migration()
