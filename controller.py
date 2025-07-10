
import os
from my_log import AppLogger
from datetime import datetime
from flask import Flask, send_from_directory, request, jsonify
from sql_functions import SQLFunction
from jwt_manager import JWTManager
from flask_socketio import SocketIO, emit
from flask import Response
from dotenv import load_dotenv
import error_codes as EC
import json
load_dotenv() 
log = AppLogger()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
sql = SQLFunction()
jwt_manager = JWTManager(secret_key=os.environ.get("JWT_SECRET_KEY"))


# <---------------------WebSocket----------------->
@socketio.on('receive_data')
def handle_receive_data(data):
    log.info("[WS-RECEIVE_DATA] " + json.dumps(data, ensure_ascii=False))
    emit('receive_data_response', {
        "status": "success",
        "message": "Cấu hình đã nhận.",
        "received": data
    })
connected_devices = {}
@socketio.on('connect')
def on_connect():
    log.info("[WS-CONNECT] New WebSocket connection established")


@socketio.on('disconnect')
def on_disconnect():
    disconnected_sid = request.sid
    for dev_id, sid in list(connected_devices.items()):
        if sid == disconnected_sid:
            log.info(f"[WS-DISCONNECT] Device {dev_id} disconnected")
            del connected_devices[dev_id]

@socketio.on("data_sensor")
def handle_sensor_data(data):
    print("Sensor data from RPi:", data)
    socketio.emit("data_sensor_web", {"received": data}, namespace="/")

@socketio.on('send_config')
def handle_send_config(config_data):
    device_id = config_data.get("device_id", "raspberry-01")
    log.info(f"[WS-SEND_CONFIG] Sent config to device_id: {device_id}")
    target_sid = connected_devices.get(device_id)
    socketio.emit('data_config', config_data, to=target_sid)
    emit('receive_data_response', {
        "status": "success",
        "message": f"Đã gửi cấu hình tới {device_id}"
    })


@socketio.on('sensor_data')
def handle_sensor_data(data):
    log.info("[WS-SENSOR_DATA] Dữ liệu từ Raspberry:")
    log.info(json.dumps(data, indent=2, ensure_ascii=False))

    emit('sensor_data_response', {
        "status": "success",
        "message": "Server đã nhận dữ liệu cảm biến.",
        "received": data
    })


@socketio.on('heartbeat')
def handle_heartbeat(data):
    device_id = data.get("device_id")
    if not device_id:
        log.warning("[WS-HEARTBEAT] Missing device_id")
        emit('heartbeat_response', {"code": EC.MISSING_DEVICE_ID, "message": "Missing device_id"})
        return

    log.info(f"[WS-HEARTBEAT] Received from device: {device_id}")
    now = datetime.utcnow().isoformat()
    sql.upsert_device(device_id, now)
    connected_devices[device_id] = request.sid
    emit('heartbeat_response', {"code": EC.SUCCESS, "message": "OK"})

# <--------------------REST-API------------------>
@app.route('/')
def serve_html():
    return send_from_directory('static', 'login.html')

@app.route('/log')
def view_log():
    log_path = "app.log"
    
    if not os.path.exists(log_path):
        return jsonify({"error": "Log file not found"}), 404
    
    with open(log_path, 'r', encoding='utf-8') as f:
        log_content = f.read()
    
    return Response(f"<pre>{log_content}</pre>", mimetype='text/html') 

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')

    result = sql.register_user(username, name, email, password)
    log.info(f"[REGISTER] Attempt: {username} - Result: {result}")

    if result == EC.SUCCESS:
        return jsonify({"code": EC.SUCCESS, "message": "User registered successfully"}), 200
    elif result == EC.USERNAME_EXISTS:
        return jsonify({"code": EC.USERNAME_EXISTS, "message": "Username already exists"}), 400
    elif result == EC.EMAIL_EXISTS:
        return jsonify({"code": EC.EMAIL_EXISTS, "message": "Email already exists"}), 400
    elif result == EC.INVALID_PASSWORD_FORMAT:
        return jsonify({"code": EC.INVALID_PASSWORD_FORMAT, "message": "Invalid password format"}), 400
    else:
        log.error(f"[REGISTER] Unknown error for {username}")
        return jsonify({"code": EC.INTERNAL_ERROR, "message": "Internal server error"}), 500


@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    result = sql.login_user(username, password)
    if result != EC.SUCCESS:
        log.warning(f"[LOGIN] Invalid credentials for {username}")
        return jsonify({"code": EC.INVALID_CREDENTIALS, "message": "Invalid credentials"}), 401
    sql.cleanup_stale_devices()
    device_id = sql.get_online_device()
    if not device_id:
        log.warning(f"[LOGIN] No device online for {username}")
        return jsonify({"code": EC.NO_DEVICE_ONLINE, "message": "No Raspberry Pi online"}), 503
    if sql.is_device_assigned_to_another_user(username, device_id):
        log.warning(f"[LOGIN] Device assigned to another user: {device_id}")
        return jsonify({"code": EC.DEVICE_ASSIGNED_TO_OTHER, "message": "Device assigned to another user"}), 403
    user_device_id = sql.get_user_device(username)
    if user_device_id is None:
        sql.set_user_device(username, device_id)
    elif user_device_id != device_id:
        log.warning(f"[LOGIN] Device mismatch for {username}")
        return jsonify({"code": EC.DEVICE_MISMATCH, "message": "Device mismatch"}), 403

    token = jwt_manager.create_token({"username": username, "device_id": device_id})
    log.info(f"[LOGIN] {username} logged in successfully.")
    return jsonify({"token": token, "code": EC.SUCCESS}), 200

@app.route('/user_info', methods=['GET'])
def user_info():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        log.error("user_info missed token")
        return jsonify({"code": EC.MISSING_TOKEN, "message": "Missing token"}), 401

    try:
        token = auth_header.split(" ")[1]
    except IndexError:
        log.error("user_info Invalid token format")
        return jsonify({"code": EC.INVALID_TOKEN_FORMAT, "message": "Invalid token format"}), 401

    payload = jwt_manager.verify_token(token)
    if payload == "TOKEN_EXPIRED":
        log.error("user_info Token expired")
        return jsonify({"code": EC.TOKEN_EXPIRED, "message": "Token expired"}), 401
    elif payload == "INVALID_TOKEN":
        log.error("user_info Invalid token")
        return jsonify({"code": EC.INVALID_TOKEN, "message": "Invalid token"}), 401

    username = payload.get("username")
    user_data = sql.get_user_info(username)
    if user_data and user_data != EC.USER_NOT_FOUND:
        return jsonify(user_data), 200
    elif user_data == EC.USER_NOT_FOUND:
        return jsonify({"code": EC.USER_NOT_FOUND, "message": "User not found"}), 404
    else:
        return jsonify({"code": EC.INTERNAL_ERROR, "message": "Error retrieving user info"}), 500

@app.route('/forget_password', methods=['POST'])
def forget_password():
    email = request.form.get('email')
    old_password = request.form.get('old_password')
    new_password = request.form.get('new_password')

    result = sql.forget_password(email, old_password, new_password)
    log.info(f"[FORGET_PASSWORD] Email: {email} - Result: {result}")

    if result == EC.SUCCESS:
        return jsonify({"code": EC.SUCCESS, "message": "Password changed successfully"}), 200
    elif result == EC.SAME_PASSWORD:
        return jsonify({"code": EC.SAME_PASSWORD, "message": "New password cannot be the same as old password"}), 400
    elif result == EC.INVALID_OLD_PASSWORD:
        return jsonify({"code": EC.INVALID_OLD_PASSWORD, "message": "Invalid old password"}), 401
    elif result == EC.INVALID_PASSWORD_FORMAT:
        return jsonify({"code": EC.INVALID_PASSWORD_FORMAT, "message": "Invalid password format"}), 400
    elif result == EC.INVALID_CREDENTIALS:
        return jsonify({"code": EC.INVALID_CREDENTIALS, "message": "Invalid credentials"}), 401
    else:
        return jsonify({"code": EC.INTERNAL_ERROR, "message": "Server error"}), 500

@app.route('/change_password', methods=['POST'])
def change_password():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"code": EC.MISSING_TOKEN, "message": "Missing token"}), 401

    try:
        token = auth_header.split(" ")[1]
    except IndexError:
        return jsonify({"code": EC.INVALID_TOKEN_FORMAT, "message": "Invalid token format"}), 401

    payload = jwt_manager.verify_token(token)
    if payload == "TOKEN_EXPIRED":
        return jsonify({"code": EC.TOKEN_EXPIRED, "message": "Token expired"}), 401
    elif payload == "INVALID_TOKEN":
        return jsonify({"code": EC.INVALID_TOKEN, "message": "Invalid token"}), 401
    username = payload.get("username")
    old_password = request.form.get('old_password')
    new_password = request.form.get('new_password')
    result = sql.change_password(username, old_password, new_password)
    if result == EC.SUCCESS:
        return jsonify({"code": EC.SUCCESS, "message": "Password changed successfully"}), 200
    elif result == EC.SAME_PASSWORD:
        return jsonify({"code": EC.SAME_PASSWORD, "message": "New password cannot be same as old"}), 400
    elif result == EC.INVALID_PASSWORD_FORMAT:
        return jsonify({"code": EC.INVALID_PASSWORD_FORMAT, "message": "Invalid password format"}), 400
    elif result == EC.INVALID_OLD_PASSWORD:
        return jsonify({"code": EC.INVALID_OLD_PASSWORD, "message": "Invalid old password"}), 401
    elif result == EC.INVALID_CREDENTIALS:
        return jsonify({"code": EC.INVALID_CREDENTIALS, "message": "Invalid credentials"}), 401
    else:
        return jsonify({"code": EC.INTERNAL_ERROR, "message": "Server error"}), 500

@app.route('/logout', methods=['POST'])
def logout():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"code": EC.MISSING_TOKEN, "message": "Missing token"}), 401

    try:
        token = auth_header.split(" ")[1]
    except IndexError:
        return jsonify({"code": EC.INVALID_TOKEN_FORMAT, "message": "Invalid token format"}), 401

    payload = jwt_manager.verify_token(token)
    if payload == "TOKEN_EXPIRED":
        return jsonify({"code": EC.TOKEN_EXPIRED, "message": "Token expired"}), 401
    elif payload == "INVALID_TOKEN":
        return jsonify({"code": EC.INVALID_TOKEN, "message": "Invalid token"}), 401

    username = payload.get("username")
    if not username:
        return jsonify({"code": EC.INVALID_TOKEN, "message": "Invalid token payload"}), 401
    # Xoá device_id khỏi user
    sql.clear_user_device(username)
    log.info(f"[LOGOUT] {username} logged out.")
    return jsonify({"code": EC.SUCCESS, "message": "Logged out"}), 200


@app.route('/check_device_status')
def check_device_status():
    device_id = request.args.get('device_id')
    if not device_id:
        log.warning("[DEVICE_STATUS] Missing device_id in request")
        return jsonify({"code": EC.MISSING_DEVICE_ID, "message": "Missing device_id"}), 400

    is_online = sql.is_device_online(device_id)
    log.info(f"[DEVICE_STATUS] Device {device_id} online: {is_online}")
    return jsonify({"online": is_online, "code": EC.SUCCESS}), 200

@app.route('/device_info_by_username', methods=['GET'])
def device_info_by_username():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return jsonify({"code": EC.MISSING_TOKEN, "message": "Missing token"}), 401

    try:
        token = auth_header.split(" ")[1]
    except IndexError:
        return jsonify({"code": EC.INVALID_TOKEN_FORMAT, "message": "Invalid token format"}), 401

    payload = jwt_manager.verify_token(token)
    if payload == "TOKEN_EXPIRED":
        return jsonify({"code": EC.TOKEN_EXPIRED, "message": "Token expired"}), 401
    elif payload == "INVALID_TOKEN":
        return jsonify({"code": EC.INVALID_TOKEN, "message": "Invalid token"}), 401

    username = payload.get("username")
    if not username:
        return jsonify({"code": EC.INVALID_TOKEN, "message": "Invalid token payload"}), 401

    device_info = sql.get_device_info_by_username(username)
    if device_info is None:
        log.warning(f"[DEVICE_INFO] No device info for username: {username}")
        return jsonify({"code": EC.DEVICE_NOT_FOUND, "message": "Device not found"}), 404
    elif device_info == EC.DB_ERROR:
        log.error(f"[DEVICE_INFO] DB error for username: {username}")
        return jsonify({"code": EC.INTERNAL_ERROR, "message": "Database error"}), 500

    return jsonify({"code": EC.SUCCESS, "data": device_info}), 200


@app.route('/index')
def index():
    return send_from_directory('static', 'index.html')


if __name__ == '__main__':
     socketio.run(app, host='0.0.0.0', port=5555, debug=True)
    
