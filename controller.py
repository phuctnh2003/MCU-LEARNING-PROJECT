from my_log import AppLogger
from datetime import datetime
from flask import Flask, send_from_directory, request, jsonify
from sql_functions import SQLFunction
from jwt_manager import JWTManager
import error_codes as EC

log = AppLogger()

app = Flask(__name__)
sql = SQLFunction()
jwt_manager = JWTManager(secret_key="phuctnh")

@app.route('/')
def serve_html():
    return send_from_directory('static', 'login.html')

@app.route('/heartbeat', methods=['POST'])
def heartbeat():
    device_id = request.json.get("device_id")
    if not device_id:
        log.warning("[HEARTBEAT] Missing device_id")
        return jsonify({"code": EC.MISSING_DEVICE_ID, "message": "Missing device_id"}), 400

    log.info(f"[HEARTBEAT] Received from device: {device_id}")
    now = datetime.utcnow().isoformat()
    sql.upsert_device(device_id, now)
    return jsonify({"code": EC.SUCCESS, "message": "OK"}), 200


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
    # Xoá các device không online khỏi user
    sql.cleanup_stale_devices()
    # Tìm device online trong 30s gần nhất
    device_id = sql.get_online_device()
    if not device_id:
        log.warning(f"[LOGIN] No device online for {username}")
        return jsonify({"code": EC.NO_DEVICE_ONLINE, "message": "No Raspberry Pi online"}), 503
    # Kiểm tra nếu device_id đang được dùng bởi user khác
    if sql.is_device_assigned_to_another_user(username, device_id):
        log.warning(f"[LOGIN] Device assigned to another user: {device_id}")
        return jsonify({"code": EC.DEVICE_ASSIGNED_TO_OTHER, "message": "Device assigned to another user"}), 403
    # Gán device_id nếu user chưa có
    user_device_id = sql.get_user_device(username) # Thiết bị đã gán trước
    if user_device_id is None:
        sql.set_user_device(username, device_id)
    elif user_device_id != device_id:
         # Nếu đã gán rồi mà khác => mismatch
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

@app.route('/index')
def index():
    return send_from_directory('static', 'index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
    
