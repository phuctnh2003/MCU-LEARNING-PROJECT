import websocket
import json
import threading
import time
import subprocess
import logging

device_id = "raspberry-01"
log_file = "/home/admin/Data/main_ws.log"
server_url = "wss://mcu-learning.project.io.vn/ws"

# Cấu hình ghi log
logging.basicConfig(
    filename=log_file,
    filemode='a',
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

def send_event(ws, event, data):
    payload = {
        "event": event,
        "data": data
    }
    ws.send(json.dumps(payload))
    logging.info(f"Sent event: {event}")

def on_open(ws):
    logging.info("Connected to server")

    def heartbeat_loop():
        while True:
            send_event(ws, "heartbeat", {"device_id": device_id})
            time.sleep(15)

    threading.Thread(target=heartbeat_loop, daemon=True).start()

def on_message(ws, message):
    try:
        msg = json.loads(message)
        event = msg.get("event")
        data = msg.get("data")
    except Exception as e:
        logging.error(f"Invalid message: {e}")
        return

    logging.info(f"Event received: {event}")
 # Đảm bảo chỉ xử lý đúng device_id
    if msg.get("device_id") != device_id:
        return

    if event == "sensor_data_response":
        logging.info(f"Server response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")

    elif event == "data_config":
        logging.info("Received config from server")
        logging.info(json.dumps(data, indent=2, ensure_ascii=False))

        try:
            with open("sensor_config.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logging.info("Saved config to sensor_config.json")
        except Exception as e:
            logging.error(f"Failed to write config: {e}")
            return

        send_event(ws, "data_config_response", {
            "device_id": device_id,
            "status": "received"
        })
  # Xác định loại giao tiếp
        interface = data.get("interface")
        if interface == "i2c":
            handler = "i2c_handler.py"
        elif interface == "spi":
            handler = "spi_handler.py"
        elif interface == "uart":
            handler = "uart_handler.py"
        elif interface == "custom":
            handler = "code_handler.py"
        else:
            err = f"Unsupported interface: {interface}"
            logging.error(err)
            send_event(ws, "sensor_data", {
                "device_id": device_id,
                "error": err
            })
            return

        # Chạy script handler
        try:
            result = subprocess.check_output(["python3", handler], stderr=subprocess.STDOUT)
            payload = json.loads(result.decode())
            payload["device_id"] = device_id
            send_event(ws, "sensor_data", payload)
            logging.info("Sent sensor data to server")
        except subprocess.CalledProcessError as e:
            err = e.output.decode()
            logging.error(f"Handler Error: {err}")
            send_event(ws, "sensor_data", {
                "device_id": device_id,
                "error": err
            })
        except json.JSONDecodeError as e:
            err = f"Invalid JSON: {str(e)}"
            logging.error(err)
            send_event(ws, "sensor_data", {
                "device_id": device_id,
                "error": err
            })
def on_error(ws, error):
    logging.error(f"WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    logging.warning("Disconnected from server")

if __name__ == "__main__":
    while True:
        try:
            logging.info("Connecting to WebSocket server...")
            ws = websocket.WebSocketApp(
                server_url,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            ws.run_forever()
        except KeyboardInterrupt:
            logging.warning("Interrupted by user")
            break
        except Exception as e:
            logging.error(f"Unexpected error: {e}")

        logging.info("Reconnecting in 5 seconds...")
        time.sleep(5)
