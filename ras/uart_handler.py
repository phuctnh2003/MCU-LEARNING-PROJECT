import json
import time
import serial
import re
import sys

# Load config
with open("sensor_config.json") as f:
    config = json.load(f)

# Thiết lập UART
ser = serial.Serial(
    port=config.get("port", "/dev/ttyS0"),
    baudrate=config.get("baudrate", 9600),
    timeout=config.get("timeout", 2),
    bytesize=serial.EIGHTBITS,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE,
    xonxoff=False,
    rtscts=False
)

time.sleep(0.2)
# Gửi lệnh khởi tạo (nếu có)
for cmd in config.get("init_command", []):
    ser.write(cmd.encode())
    time.sleep(0.1)
    ser.flush()

def read_sensor_once():
    if config.get("read_command"):
        ser.write(config["read_command"].encode())

    buffer = ""
    start_time = time.time()
    while True:
        byte = ser.read(1)
        if not byte:
            break
        buffer += byte.decode(errors="ignore")
        if buffer.endswith(config.get("response_terminator", "\n")):
            break
        if time.time() - start_time > 2:
            break

    result = {}
    # Luôn lưu raw_data
    result["raw_data"] = buffer.strip()

    # Nếu có fields thì phân tích như cũ
    if config.get("fields"):
        for field in config["fields"]:
            match = re.search(field["pattern"], buffer)
            if match:
                val = match.group(1)
                if field["type"] == "float":
                    result[field["name"]] = float(val)
                elif field["type"] == "int":
                    result[field["name"]] = int(val)
                else:
                    result[field["name"]] = val
            else:
                result[field["name"]] = None

    return result

# Lấy mẫu nhiều lần
samples = []
sample_count = config.get("sample_count", 5)
interval = config.get("polling_interval_ms", 1000)

for _ in range(sample_count):
    try:
        samples.append(read_sensor_once())
    except Exception as e:
        samples.append({"error": str(e)})
    time.sleep(interval / 1000)

# Kết quả trả về
payload = {
    "interface": "uart",
    "timestamp": time.time(),
    "samples": samples
}

print(json.dumps(payload))
