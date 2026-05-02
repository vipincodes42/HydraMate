# ESP32 Firmware Setup — HydraMate

## What this does

The ESP32 reads weight from the HX711 load cell, filters noise with a rolling average, detects sips (weight drops >= 10 g held for 2 s), and pushes live data to Firebase at:

```
users/{uid}/live → { weightG, totalDrankML, alertActive }
```

The React Native app already listens to this path in real time.

---

## Step 1 — Install Arduino IDE

1. Go to https://www.arduino.cc/en/software
2. Download **Arduino IDE 2.x** (Windows)
3. Install with defaults — no admin required for most setups

---

## Step 2 — Add ESP32 Board Support

1. Open Arduino IDE → **File → Preferences**
2. In "Additional boards manager URLs" paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Click OK
4. Go to **Tools → Board → Boards Manager**
5. Search `esp32` → Install **"esp32 by Espressif Systems"** (takes ~2 minutes)

---

## Step 3 — Install Required Libraries

Go to **Tools → Manage Libraries** and install these one by one:

| Library | Author | Search term |
|---------|--------|-------------|
| HX711 Arduino Library | bogde | `HX711 bogde` |
| Firebase ESP Client | Mobizt | `Firebase ESP Client` |

---

## Step 4 — Wire the Hardware

### HX711 → ESP32

| HX711 Pin | ESP32 Pin |
|-----------|-----------|
| VCC       | 3.3V      |
| GND       | GND       |
| DT (DOUT) | GPIO 16   |
| SCK       | GPIO 17   |

### RGB LED → ESP32 (common-cathode)

| LED Pin | ESP32 Pin | Resistor |
|---------|-----------|----------|
| Red     | GPIO 25   | 220 Ω    |
| Green   | GPIO 26   | 220 Ω    |
| Blue    | GPIO 27   | 220 Ω    |
| Cathode | GND       | —        |

> If you used different GPIO pins, update the `#define` lines at the top of the .ino file.

---

## Step 5 — Calibrate the Load Cell

The `CALIBRATION_FACTOR` in the code is a placeholder. You need to measure it once:

1. Open `hydramate_esp32.ino`
2. Uncomment `#define CALIBRATION_MODE` (line ~28)
3. Flash to ESP32 (see Step 7 for how to select board/port)
4. Open **Tools → Serial Monitor** at 115200 baud
5. Place a known weight on the coaster (e.g., a 200 g object)
6. Note the "Raw:" value printed — divide it by the known weight in grams:
   ```
   CALIBRATION_FACTOR = raw_value / known_weight_grams
   ```
   Example: raw = -1,410,000 and weight = 200 g → factor = -7050
7. Re-comment `// #define CALIBRATION_MODE`
8. Update `#define CALIBRATION_FACTOR` with your measured value

---

## Step 6 — Fill in Your Config

At the top of `hydramate_esp32.ino`, fill in:

```cpp
#define WIFI_SSID      "your network name"
#define WIFI_PASSWORD  "your password"
#define USER_UID       "paste uid from Firebase here"
```

**How to get the UID:**
1. Log into the HydraMate app once (creates your account)
2. Go to [Firebase Console](https://console.firebase.google.com) → hydramate-ca0c1 → Authentication → Users
3. Copy the UID next to your email

---

## Step 7 — Flash to ESP32

1. Plug ESP32 into your computer via USB
2. In Arduino IDE:
   - **Tools → Board → esp32 → ESP32 Dev Module**
   - **Tools → Port** → select the COM port that appeared when you plugged in
     - If no port shows, install the CP2102 driver: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
3. Click **Upload** (→ arrow button)
4. Watch the Serial Monitor — you should see weight readings scrolling

---

## Step 8 — Verify End-to-End

1. Open the HydraMate app
2. The home screen reads from `users/{uid}/live` in real time
3. Pick up the bottle, take a drink, put it back
4. After ~2 seconds the app should update

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No module named..." compile error | Re-install the library; restart Arduino IDE |
| Port not showing | Install CP2102 USB driver |
| Weight reads negative | Flip the sign on `CALIBRATION_FACTOR` |
| Firebase write fails | Check WiFi credentials and UID; verify Firebase rules allow write |
| Weight drifts constantly | Increase `DEBOUNCE_MS` or check load cell mounting (no lateral force) |
| Alert fires immediately | Set `INACTIVITY_MS` higher for testing (e.g., 60000 = 1 min) |
