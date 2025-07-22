import json
import smbus2 as smbus
import time

# ==== HÀM CHUYỂN GIÁ TRỊ ====
def parse_int(val):
    if isinstance(val, int):
        return val
    return int(val, 0)

# ==== LOAD CONFIG ====
with open("sensor_config.json") as f:
    config = json.load(f)

bus = smbus.SMBus(1)
address = parse_int(config["address"])

# ==== INIT SEQUENCE ====
for step in config.get("init_sequence", []):
    reg = parse_int(step["reg"])
    val = parse_int(step["value"])
    bus.write_byte_data(address, reg, val)
    time.sleep(0.01)

# ==== CẤU HÌNH ĐỌC ====
interval_ms = config.get("polling_interval_ms", 200)
sample_count = config.get("sample_count", 10)
read_reg = parse_int(config["read_register"])
read_len = parse_int(config["read_length"])
# ==== ĐỌC MỘT LẦN ====
def read_sensor_once():
    raw = bus.read_i2c_block_data(address, read_reg, read_len)
    if not config.get("fields"):
        return {"raw": raw}

    result = {}
    for field in config["fields"]:
        start = parse_int(field["start"])
        length = parse_int(field["length"])
        value = 0
        for i in range(length):
            value = (value << 8) | raw[start + i]
        if field.get("signed", False):
            sign_bit = 1 << (length * 8 - 1)
            value = (value ^ sign_bit) - sign_bit
        scale = field.get("scale", 1)
        result[field["name"]] = value * scale
    return result

# ==== ĐỌC NHIỀU MẪU ====
samples = []
error = None

for _ in range(sample_count):
    try:
        samples.append(read_sensor_once())
    except Exception as e:
        error = str(e)
        break  # Dừng luôn nếu lỗi

    time.sleep(interval_ms / 1000)

# ==== IN KẾT QUẢ ====
payload = {
    "timestamp": time.time(),
    "interface": "i2c",
}

if error:
    payload["error"] = error
else:
    payload["samples"] = samples

print(json.dumps(payload))
