#include <WiFi.h>
#include <FirebaseESP32.h>
#include "HX711.h"
#include <FastLED.h>

#define WIFI_SSID       "eninja"
#define WIFI_PASSWORD   "brjm0403"
#define DATABASE_URL    "https://hydramate-ca0c1-default-rtdb.firebaseio.com/"
#define DATABASE_SECRET "TjVfOJqayQzq5Q3G48R1J1eC9gVKogfbcjSATXu6"
#define USER_UID        "P7QmCRc3M7dthu114RbNRLQu2ZM2"

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
  // Brief blue flash on sip detected
  setAllLEDs(CRGB::Blue);
  delay(500);
  setAllLEDs(CRGB::Black);
}

void breatheGreen() {
  // Slow green pulse — hydrated, all good
  static int brightness = 0;
  static int direction = 1;
  brightness += direction * 3;
  if (brightness >= 80) direction = -1;
  if (brightness <= 0)  direction = 1;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(0, brightness, 0);
  FastLED.show();
}

void pulseRed() {
  // Fast red pulse — needs to drink
  static int brightness = 0;
  static int direction = 1;
  brightness += direction * 8;
  if (brightness >= 80) direction = -1;
  if (brightness <= 0)  direction = 1;
  for (int i = 0; i < NUM_LEDS; i++) leds[i] = CRGB(brightness, 0, 0);
  FastLED.show();
}

// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  // LED strip setup
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  setAllLEDs(CRGB::White);

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

  // Firebase
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Scale
  scale.begin(DOUT_PIN, SCK_PIN);
  scale.set_scale(2280.f);
  scale.tare();

  Serial.println("Scale ready");
  lastDrink = millis();
}

void loop() {
  float weightG = max(0.0f, (float)scale.get_units(5));

  // Sip detection
  if ((lastWeight - weightG) > 10 && millis() - lastDrink > 2000) {
    float mlDrunk = lastWeight - weightG;
    totalDrunkMl += mlDrunk;
    lastDrink = millis();
    alertActive = false;
    Serial.println("Drink detected: " + String(mlDrunk) + " ml");
    flashBlue();  // positive feedback flash
  }

  lastWeight = weightG;

  // Inactivity alert — 30 minutes no drink
  if (millis() - lastDrink > 1800000) {
    alertActive = true;
  }

  // LED state — solid white
  setAllLEDs(CRGB::White);

  // Firebase push every 5 seconds
  if (Firebase.ready() && millis() - lastSend > 5000) {
    lastSend = millis();
    String basePath = "/users/" + String(USER_UID) + "/live";

    if (Firebase.setFloat(fbdo, basePath + "/weightG", weightG)) {
      Serial.println("Sent — weight: " + String(weightG) + "g, total: " + String(totalDrunkMl) + "ml");
    } else {
      Serial.println("Firebase error: " + fbdo.errorReason());
    }

    Firebase.setFloat(fbdo, basePath + "/totalDrankML", round(totalDrunkMl * 100.0) / 100.0);
    Firebase.setBool(fbdo,  basePath + "/alertActive",  alertActive);
  }

  delay(20);  // fast loop for smooth LED animation
}
