#include <WiFi.h>
#include <FirebaseESP32.h>
#include "HX711.h"
#include <FastLED.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

// #define WIFI_SSID       "eninja"
// #define WIFI_PASSWORD   "brjm0403"
#define WIFI_SSID "garrison"
#define WIFI_PASSWORD "garrison"
#define DATABASE_URL    "https://hydramate-ca0c1-default-rtdb.firebaseio.com/"
#define DATABASE_SECRET "TjVfOJqayQzq5Q3G48R1J1eC9gVKogfbcjSATXu6"

// BLE service/characteristic UUIDs — the app uses these to find and write the UID
#define BLE_SERVICE_UUID    "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_CHAR_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Hardcoded UID for testing — remove once BLE pairing is working
#define HARDCODED_UID "QC5oLsI1MReID21ipSVc8QaXm6D2"

// Hold BOOT button (GPIO 0) on power-on for 3 seconds to clear UID and re-pair
#define RESET_PIN 0

// HX711 pins
#define DOUT_PIN 4
#define SCK_PIN  5

// LED strip
#define LED_PIN      18
#define NUM_LEDS     4
#define BRIGHTNESS   30    // low power mode: 30/255 (~12%)

CRGB leds[NUM_LEDS];

HX711 scale;
FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;
Preferences preferences;

String userUID = "";

float totalDrunkMl = 0;
float lastWeight   = 0;
unsigned long lastSend  = 0;
unsigned long lastDrink = 0;
bool alertActive = false;

// ── LED animations ────────────────────────────────────────────────────────────

void setAllLEDs(CRGB color) {
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = color;
  FastLED.show();
}
  
void flashBlue() {
  setAllLEDs(CRGB::Blue);
  delay(500);
  setAllLEDs(CRGB::Black);
}

void breatheGreen() {
  static int brightness = 0;
  static int direction = 1;
  brightness += direction * 3;
  if (brightness >= 80) direction = -1;
  if (brightness <= 0)  direction = 1;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, brightness, 0);
  FastLED.show();
}

void pulseRed() {
  static int brightness = 0;
  static int direction = 1;
  brightness += direction * 8;
  if (brightness >= 80) direction = -1;
  if (brightness <= 0)  direction = 1;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(brightness, 0, 0);
  FastLED.show();
}

void breatheCyan() {
  static int brightness = 0;
  static int direction = 1;
  brightness += direction * 3;
  if (brightness >= 80) direction = -1;
  if (brightness <= 0)  direction = 1;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, brightness, brightness);
  FastLED.show();
}

void pulsePurple() {
  static int brightness = 0;
  static int direction = 1;
  brightness += direction * 5;
  if (brightness >= 80) direction = -1;
  if (brightness <= 0)  direction = 1;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(brightness, 0, brightness);
  FastLED.show();
}


// ── BLE provisioning ─────────────────────────────────────────────────────────

class UIDWriteCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String uid = pChar->getValue().c_str();
    if (uid.length() > 0) {
      preferences.putString("uid", uid);
      Serial.println("UID saved: " + uid);
      setAllLEDs(CRGB::Green);
      delay(1000);
      ESP.restart();
    }
  }
};

void runBLEProvisioning() {
  Serial.println("No UID stored — waiting for BLE pairing...");

  BLEDevice::init("HydraMate");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(BLE_SERVICE_UUID);
  BLECharacteristic *pChar = pService->createCharacteristic(
    BLE_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE
  );
  pChar->setCallbacks(new UIDWriteCallback());
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->start();

  while (true) {
    pulsePurple();
    delay(20);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  // LED strip setup
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  setAllLEDs(CRGB::White);

  // Check if BOOT button held on startup — if so, clear UID and re-pair
  pinMode(RESET_PIN, INPUT_PULLUP);
  unsigned long holdStart = millis();
  while (digitalRead(RESET_PIN) == LOW && millis() - holdStart < 3000) {
    setAllLEDs(CRGB::Red);
    delay(20);
  }
  if (millis() - holdStart >= 3000) {
    preferences.begin("hydramate", false);
    preferences.clear();
    Serial.println("UID cleared — re-entering BLE pairing mode");
    preferences.end();
    ESP.restart();
  }

  // Load saved UID from flash — if none, enter BLE pairing mode
  preferences.begin("hydramate", false);
  userUID = preferences.getString("uid", "");
  if (userUID.length() == 0) {
    runBLEProvisioning();  // never returns — ESP.restart() exits it
  }

  Serial.println("Using UID: " + userUID);

  // WiFi — 15 second timeout, LEDs stay on regardless
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
  } else {
    Serial.println("\nWiFi failed — running without Firebase");
  }

  // Firebase — only init if WiFi connected
  if (WiFi.status() == WL_CONNECTED) {
    config.database_url = DATABASE_URL;
    config.signer.tokens.legacy_token = DATABASE_SECRET;
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
  }

  // Scale
  scale.begin(DOUT_PIN, SCK_PIN);
  scale.set_scale(2280.f);

  unsigned long tareStart = millis();
  while (!scale.is_ready() && millis() - tareStart < 3000);
  if (scale.is_ready()) {
    scale.tare();
    Serial.println("Scale ready");
  } else {
    Serial.println("Scale not found — check HX711 wiring");
  }
  lastDrink = millis();
}

void loop() {
  long adcRaw = scale.read_average(3);
  float weightG = max(0.0f, (float)scale.get_units(5));
  Serial.printf("ADC: %ld  weight: %.2fg\n", adcRaw, weightG);

  // Sip detection
  if ((lastWeight - weightG) > 10 && millis() - lastDrink > 2000) {
    float mlDrunk = lastWeight - weightG;
    totalDrunkMl += mlDrunk;
    lastDrink = millis();
    alertActive = false;
    Serial.println("Drink detected: " + String(mlDrunk) + " ml");
    flashBlue();
  }

  lastWeight = weightG;

  // Inactivity alert — 30 minutes no drink
  if (millis() - lastDrink > 1800000) {
    alertActive = true;
  }

  // LED state
  if (alertActive) {
    pulseRed();
  } else if (weightG > 50) {
    breatheCyan();   // something is on the coaster
  } else {
    breatheGreen();  // empty coaster
  }

  // Firebase push every 5 seconds
  if (Firebase.ready() && millis() - lastSend > 5000) {
    lastSend = millis();
    String basePath = "/users/" + userUID + "/live";

    if (Firebase.setFloat(fbdo, basePath + "/weightG", weightG)) {
      Serial.println("Sent — weight: " + String(weightG) + "g, total: " + String(totalDrunkMl) + "ml");
    } else {
      Serial.println("Firebase error: " + fbdo.errorReason());
    }

    Firebase.setFloat(fbdo, basePath + "/totalDrankML", round(totalDrunkMl * 100.0) / 100.0);
    Firebase.setBool(fbdo,  basePath + "/alertActive",  alertActive);
  }

  delay(20);
}
