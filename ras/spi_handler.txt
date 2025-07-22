import spidev
import time
import json
import struct

with open("sensor_config.json") as f:
    config = json.load(f)

spi = spidev.SpiDev()
spi.open(config["bus"], config["device"])
spi.max_speed_hz = config["speed"]
spi.mode = config.get("mode", 0)

def parse_fields(raw_bytes):
    result = {}
    for field in config.get("fields", []):
        start = field["start"]
        length = field["length"]
        chunk = raw_bytes[start:start+length]
        if len(chunk) != length:
            result[field["name"]] = None
            continue

        val = int.from_bytes(chunk, byteorder='big', signed=field.get("signed", False))
        scaled = val * field.get("scale", 1.0)
        result[field["name"]] = round(scaled, 2)
    return result

samples = []
sample_count = config.get("sample_count", 5)
interval = config.get("polling_interval_ms", 1000) / 1000

for _ in range(sample_count):
    read_cmd = [int(b, 16) for b in config.get("read_command", [])]
    raw = spi.xfer2(read_cmd)  # gửi và nhận đồng thời
    sample = {
        "raw_data": " ".join(f"{b:02X}" for b in raw)
    }
    sample.update(parse_fields(raw))
    samples.append(sample)
    time.sleep(interval)

payload = {
    "interface": "spi",
    "timestamp": time.time(),
    "samples": samples
}

print(json.dumps(payload, indent=2))
