// HydraMate ESP32 Firmware
// Reads weight from HX711 load cell, filters it, and pushes events to Firebase Realtime Database.
// Firebase path written: users/{uid}/live  →  { weightG, totalDrankML, alertActive }

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <HX711.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ─── USER CONFIG ─────────────────────────────────────────────────────────────
// Fill these in before flashing. Get UID from Firebase Console → Auth → Users.
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define USER_UID        "YOUR_FIREBASE_USER_UID"   // copy from Firebase Auth tab

// Firebase project credentials (from firebase.js in the app)
#define FIREBASE_API_KEY    "AIzaSyBdIngmvvG0Tsr32qMKW5TLiozUWYbX8UI"
#define FIREBASE_DB_URL     "https://hydramate-ca0c1-default-rtdb.firebaseio.com"
// ─────────────────────────────────────────────────────────────────────────────

// HX711 wiring pins (adjust if you used different GPIO pins)
#define HX711_DOUT_PIN  16
#define HX711_SCK_PIN   17

// RGB LED pins (common-cathode; 0 = off, 255 = full brightness)
#define LED_RED_PIN     25
#define LED_GREEN_PIN   26
#define LED_BLUE_PIN    27

// Calibration: run CALIBRATION_MODE first to find your scale factor
// #define CALIBRATION_MODE   // uncomment → flash → serial monitor → note the raw value → comment out
#define CALIBRATION_FACTOR  -7050.0  // replace with your measured value

// Thresholds (match TDD spec)
#define MIN_DRINK_GRAMS     10      // minimum weight drop to count as a sip
#define DEBOUNCE_MS         2000    // sip must be sustained 2 s before recording
#define INACTIVITY_MS       1800000 // 30 minutes before LED alert
#define ROLLING_WINDOW      10      // samples for rolling average

HX711 scale;
FirebaseData fbdo;
FirebaseAuth firebaseAuth;
FirebaseConfig firebaseConfig;

float samples[ROLLING_WINDOW];
int sampleIndex = 0;
bool samplesReady = false;

float stableWeight = 0;
float totalDrankML = 0;
unsigned long lastDrinkTime = 0;
unsigned long drinkStartTime = 0;
bool trackingDrink = false;
float drinkStartWeight = 0;
bool alertActive = false;
bool firebaseReady = false;

// ─── LED helpers ─────────────────────────────────────────────────────────────

void setLED(int r, int g, int b) {
  analogWrite(LED_RED_PIN,   r);
  analogWrite(LED_GREEN_PIN, g);
  analogWrite(LED_BLUE_PIN,  b);
}

void pulseBlueLED() {
  // Single soft pulse: fade in then out
  for (int i = 0; i <= 200; i += 5) { setLED(0, 0, i); delay(15); }
  for (int i = 200; i >= 0; i -= 5) { setLED(0, 0, i); delay(15); }
}

// ─── Rolling average ──────────────────────────────────────────────────────────

void addSample(float val) {
  samples[sampleIndex] = val;
  sampleIndex = (sampleIndex + 1) % ROLLING_WINDOW;
  if (sampleIndex == 0) samplesReady = true;
}

float rollingAverage() {
  int count = samplesReady ? ROLLING_WINDOW : sampleIndex;
  if (count == 0) return 0;
  float sum = 0;
  for (int i = 0; i < count; i++) sum += samples[i];
  return sum / count;
}

// ─── Firebase push ───────────────────────────────────────────────────────────

void pushLiveData(float weightG, float drankML, bool alert) {
  if (!firebaseReady) return;

  String basePath = String("users/") + USER_UID + "/live";

  FirebaseJson json;
  json.set("weightG",      weightG);
  json.set("totalDrankML", drankML);
  json.set("alertActive",  alert);

  if (!Firebase.RTDB.setJSON(&fbdo, basePath.c_str(), &json)) {
    Serial.println("Firebase write failed: " + fbdo.errorReason());
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);

  // LED setup
  ledcAttachPin(LED_RED_PIN,   0); ledcSetup(0, 5000, 8);
  ledcAttachPin(LED_GREEN_PIN, 1); ledcSetup(1, 5000, 8);
  ledcAttachPin(LED_BLUE_PIN,  2); ledcSetup(2, 5000, 8);
  setLED(0, 0, 0);

  // HX711 setup
  scale.begin(HX711_DOUT_PIN, HX711_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  scale.tare();  // zero out with empty coaster
  Serial.println("Scale tared. Place empty bottle and wait 3 seconds...");
  delay(3000);
  scale.tare();  // tare again with bottle
  Serial.println("Bottle tared. Ready.");

#ifdef CALIBRATION_MODE
  Serial.println("=== CALIBRATION MODE ===");
  Serial.println("Place a known weight on the scale.");
  Serial.println("Raw values will print every second.");
  while (true) {
    if (scale.is_ready()) {
      long raw = scale.read_average(10);
      Serial.print("Raw: "); Serial.println(raw);
    }
    delay(1000);
  }
#endif

  // WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  // Firebase
  firebaseConfig.api_key = FIREBASE_API_KEY;
  firebaseConfig.database_url = FIREBASE_DB_URL;
  firebaseConfig.token_status_callback = tokenStatusCallback;

  // Sign in anonymously — matches app's anonymous auth flow
  Firebase.signUp(&firebaseConfig, &firebaseAuth, "", "");
  Firebase.begin(&firebaseConfig, &firebaseAuth);
  Firebase.reconnectWiFi(true);

  firebaseReady = true;
  lastDrinkTime = millis();
  Serial.println("Firebase ready. Monitoring weight...");
  setLED(0, 30, 0);  // dim green = system ready
}

// ─── Main loop ───────────────────────────────────────────────────────────────

void loop() {
  if (!scale.is_ready()) return;

  float raw = scale.get_units(1);
  addSample(raw);
  float current = rollingAverage();

  Serial.printf("Weight: %.1f g | Total: %.0f mL | Alert: %s\n",
                current, totalDrankML, alertActive ? "YES" : "no");

  float delta = stableWeight - current;  // positive = weight decreased = user drank

  // ── Sip detection (debounced) ──
  if (delta >= MIN_DRINK_GRAMS) {
    if (!trackingDrink) {
      trackingDrink   = true;
      drinkStartTime  = millis();
      drinkStartWeight = stableWeight;
    } else if (millis() - drinkStartTime >= DEBOUNCE_MS) {
      // Confirmed sip
      float ml = delta * 1.0;  // 1 g ≈ 1 mL for water
      totalDrankML += ml;
      stableWeight  = current;
      lastDrinkTime = millis();
      trackingDrink = false;

      if (alertActive) {
        alertActive = false;
        setLED(0, 30, 0);  // back to dim green
      }

      Serial.printf(">>> SIP DETECTED: +%.0f mL (total %.0f mL)\n", ml, totalDrankML);
      pushLiveData(current, totalDrankML, false);
    }
  } else {
    // Weight stable or increased (refill) — reset tracking
    if (delta < -MIN_DRINK_GRAMS) {
      // Significant increase = refill; update stable baseline
      stableWeight  = current;
      trackingDrink = false;
      Serial.println("Refill detected — baseline updated.");
      pushLiveData(current, totalDrankML, alertActive);
    } else if (!trackingDrink) {
      stableWeight = current;  // gentle drift correction
    }
    trackingDrink = false;
  }

  // ── Inactivity alert ──
  if (!alertActive && (millis() - lastDrinkTime >= INACTIVITY_MS)) {
    alertActive = true;
    Serial.println("!!! INACTIVITY ALERT — pulsing LED");
    pushLiveData(current, totalDrankML, true);
  }

  if (alertActive) pulseBlueLED();

  // Push a heartbeat every 10 seconds even without an event
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat >= 10000) {
    pushLiveData(current, totalDrankML, alertActive);
    lastHeartbeat = millis();
  }

  delay(100);  // ~10 Hz sampling
}
