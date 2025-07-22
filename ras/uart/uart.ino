void setup() {
  Serial.begin(9600);
}

void loop() {
  float temp = random(250, 270) / 10.0;   // 25.0 - 27.0
  float hum = random(550, 600) / 10.0;    // 55.0 - 60.0
  Serial.print("Temp:");
  Serial.print(temp);
  Serial.print(" Hum:");
  Serial.println(hum);
  delay(1000);
}