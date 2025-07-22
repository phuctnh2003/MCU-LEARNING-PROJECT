#include <avr/io.h>
#include <avr/interrupt.h>
#include <Arduino.h>

volatile uint16_t temperature = 250;  // 25.00°C, scaled x10
volatile uint16_t humidity = 500;     // 50.00%, scaled x10
volatile byte response[4];
volatile byte index = 1;
unsigned long lastUpdate = 0;

void updateSensorData() {
  // Sinh số ngẫu nhiên trong khoảng
  temperature = random(250, 300);  
  humidity = random(600, 650);      

  // Mã hóa kiểu Big-Endian (MSB trước)
  response[0] = highByte(temperature);
  response[1] = lowByte(temperature);
  response[2] = highByte(humidity);
  response[3] = lowByte(humidity);
}

void setup() {
  pinMode(MISO, OUTPUT);
  SPCR |= _BV(SPE);   // Enable SPI
  SPCR |= _BV(SPIE);  // Enable SPI interrupt
  sei();              // Enable global interrupts

  Serial.begin(9600);
  randomSeed(analogRead(A0));  // Seed ngẫu nhiên
  updateSensorData();
  SPDR = response[0];
}

ISR(SPI_STC_vect) {
  SPDR = response[index];
  index = (index + 1) % 4;
}

void loop() {
  // Cập nhật dữ liệu mỗi 1 giây
  if (millis() - lastUpdate > 1000) {
    updateSensorData();
    index = 1;
    SPDR = response[0];
    lastUpdate = millis();

  }
}
