from function import explain_sensor_data
from my_log import log
from datetime import datetime, timezone
from flask import Flask
from sql_functions import SQLFunction
from flask_sock import Sock
from dotenv import load_dotenv
import error_codes as EC
import json
import threading
import time

load_dotenv()
app_ws = Flask(__name__)
sock = Sock(app_ws)
sql = SQLFunction()
connected_devices = {}
active_connections = {}
web_clients = set()


# KEEP-ALIVE THREAD: Chỉ cho web client
def keep_alive_web(ws):
    try:
        while True:
            if ws not in web_clients:
                break
            ws.send(
                json.dumps(
                    {
                        "event": "noop",
                        "data": {
                            "message": "keep-alive",
                            "time": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                )
            )
            time.sleep(5)
    except Exception as e:
        log.warning(f"[KEEP-ALIVE] Kết nối bị ngắt: {e}")
        web_clients.discard(ws)


@sock.route("/ws")
def websocket_route(ws):
    log.info("[WS-CONNECT] New WebSocket connection")
    device_id = None

    if not device_id:
        web_clients.add(ws)
        threading.Thread(target=keep_alive_web, args=(ws,), daemon=True).start()

    while True:
        try:
            data = ws.receive()
            if not data:
                break

            msg = json.loads(data)
            event = msg.get("event")
            payload = msg.get("data")
            # Server ghi nhận kết nối của Raspberry
            if event == "heartbeat":
                device_id = payload.get("device_id")
                if not device_id:
                    ws.send(
                        json.dumps(
                            {
                                "event": "heartbeat_response",
                                "data": {
                                    "code": EC.MISSING_DEVICE_ID,
                                    "message": "Missing device_id",
                                },
                            }
                        )
                    )
                    continue
                log.info(f"[WS-HEARTBEAT] Received from device: {device_id}")
                now = datetime.now(timezone.utc).isoformat()
                sql.upsert_device(device_id, now)
                connected_devices[device_id] = ws
                # Trả về "heartbeat_response" đã nhận
                ws.send(
                    json.dumps(
                        {
                            "event": "heartbeat_response",
                            "device_id": device_id,
                            "data": {"code": EC.SUCCESS, "message": "OK"},
                        }
                    )
                )
            # Server xác nhận đã nhận được sensor_data( dữ liệu mô phỏng).
            # Dữ liệu được gửi broadcast đến tất cả WebSocket client đang mở (trang web).
            elif event == "sensor_data":
                log.info("[WS-SENSOR_DATA] Dữ liệu từ Raspberry:")
                log.info(json.dumps(payload, indent=2, ensure_ascii=False))
                ws.send(
                    json.dumps(
                        {
                            "event": "sensor_data_response",
                            "device_id": device_id,
                            "data": {
                                "status": "success",
                                "message": "Server đã nhận dữ liệu cảm biến.",
                            },
                        }
                    )
                )
                # Gửi broadcast cho web client
                for client in list(web_clients):
                    try:
                        client.send(
                            json.dumps(
                                {
                                    "event": "data_sensor_web",
                                    "device_id": device_id,
                                    "data": {"status": "success", "received": payload},
                                }
                            )
                        )
                    except Exception as e:
                        log.warning(f"[WS] Lỗi gửi cho web client: {e}")
                        web_clients.remove(client)
            # Web gửi cấu hình qua event: "send_config" đến server.
            # Server sẽ tìm connected_devices[device_id] và gửi tiếp event data_config đến Raspberry.
            elif event == "send_config":
                # device_id gửi từ phía web client trong root-level
                target_device_id = msg.get("device_id")

                if not target_device_id:
                    log.warning("[SEND_CONFIG] Thiếu device_id từ client")
                    continue

                target_ws = connected_devices.get(target_device_id)

                if target_ws:
                    log.info(f"[SEND_CONFIG] Gửi cấu hình tới {target_device_id}")
                    target_ws.send(
                        json.dumps(
                            {
                                "event": "data_config",
                                "device_id": target_device_id,
                                "data": payload,
                            }
                        )
                    )
                else:
                    log.warning(
                        f"[SEND_CONFIG] Không tìm thấy thiết bị: {target_device_id}"
                    )
            elif event == "explain_sensor_data":
                log.info("[WS] Received explain_sensor_data request")
                try:
                    parsed_data = (
                        json.loads(payload) if isinstance(payload, str) else payload
                    )
                    explanation = explain_sensor_data(parsed_data)
                    log.info("[WS] Received format explain_sensor_data: " + explanation)
                except Exception as e:
                    explanation = f"Lỗi khi xử lý dữ liệu: {str(e)}"
                for client in list(web_clients):
                    try:
                        client.send(
                            json.dumps(
                                {
                                    "event": "gpt_explanation_result",
                                    "device_id": device_id,
                                    "data": {"content": explanation},
                                }
                            )
                        )
                    except Exception as e:
                        log.warning(f"[WS] Lỗi gửi cho web client: {e}")
                        web_clients.remove(client)
        except Exception as e:
            log.warning(f"[WS-ERROR] {e}")
            break

    # Ngắt kết nối
    if device_id and device_id in connected_devices:
        del connected_devices[device_id]
        log.info(f"[WS-DISCONNECT] Device {device_id} disconnected")

    if ws in web_clients:
        web_clients.remove(ws)
        log.info("[WS-DISCONNECT] Web client disconnected")
