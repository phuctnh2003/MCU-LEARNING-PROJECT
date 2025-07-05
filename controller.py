from datetime import datetime, timedelta
from anyio import sleep
from flask import Flask, send_from_directory, request, jsonify
from sql_functions import SQLFunction
from jwt_manager import JWTManager

app = Flask(__name__)
sql = SQLFunction()
jwt_manager = JWTManager(secret_key="phuctnh") 

@app.route('/')
def serve_html():
    return send_from_directory('static', 'login.html')

@app.route('/heartbeat', methods=['POST'])
def heartbeat():
    print("Heartbeat received")
    device_id = request.json.get("device_id")
    if not device_id:
        return "Missing device_id", 400
    print(f"Heartbeat received from device: {device_id}")
    now = datetime.utcnow().isoformat()
    sql.upsert_device(device_id, now)
    return "OK", 200

@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')

    result = sql.register_user(username, name, email, password)

    if result == "SUCCESS":
        return "200"
    elif result == "USERNAME_EXISTS":
        return "Username already exists", "400"
    elif result == "INVALID_PASSWORD":
        return "Password must contain uppercase, lowercase, number, special character, min 4 characters", "400"
    else:
        return "Error", "500"

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    result = sql.login_user(username, password)
    if result != "SUCCESS":
        return "Invalid credentials", 401

    # Xoá các device không online khỏi user
    sql.cleanup_stale_devices()
    # Tìm device online trong 30s gần nhất
    device_id = sql.get_online_device()
    if not device_id:
        return "No Raspberry Pi online", 503

    # Kiểm tra nếu device_id đang được dùng bởi user khác
    if sql.is_device_assigned_to_another_user(username, device_id):
        return "This Raspberry Pi is already assigned to another user.", 403

    # Gán device_id nếu user chưa có
    user_device_id = sql.get_user_device(username)
    if user_device_id is None:
        sql.set_user_device(username, device_id)
    elif user_device_id != device_id:
        return "Device mismatch. This account is bound to another Raspberry Pi.", 403

    # Tạo JWT
    token = jwt_manager.create_token({
        "username": username,
        "device_id": device_id
    })
    return jsonify({"token": token}), 200


@app.route('/user_info', methods=['GET'])
def user_info():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return "Missing token", 401

    try:
        token = auth_header.split(" ")[1]  # Bearer <token>
    except IndexError:
        return "Invalid token format", 401

    payload = jwt_manager.verify_token(token)
    print(f"Payload: {payload}")  # Debugging line  
    if payload == "TOKEN_EXPIRED":
        return "Token expired", 401
    elif payload == "INVALID_TOKEN":
        return "Invalid token", 401

    username = payload.get("username")
    user_data = sql.get_user_info(username)
    if user_data and user_data != "USER_NOT_FOUND":
        return jsonify(user_data), 200
    elif user_data == "USER_NOT_FOUND":
        return "User not found", 404
    else:
        return "Error retrieving user info", 500

@app.route('/forget_password', methods=['POST'])
def forget_password():
    email = request.form.get('email')
    old_password = request.form.get('old_password')
    new_password = request.form.get('new_password')

    result = sql.forget_password(email, old_password, new_password)

    if result == "SUCCESS":
        return "200"
    elif result == "INVALID_PASSWORD":
        return "Invalid password format", "400"
    elif result == "USER_NOT_FOUND":
        return "User not found", "404"
    else:
        return "Error", "500"
@app.route('/logout', methods=['POST'])
def logout():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return "Missing token", 401

    try:
        token = auth_header.split(" ")[1]
    except IndexError:
        return "Invalid token format", 401

    payload = jwt_manager.verify_token(token)
    if payload == "TOKEN_EXPIRED":
        return "Token expired", 401
    elif payload == "INVALID_TOKEN":
        return "Invalid token", 401

    username = payload.get("username")
    if not username:
        return "Invalid token payload", 401

    # Xoá device_id khỏi user
    sql.clear_user_device(username)
    users = sql.show_all_users()
    for user in users:
        print(user)
    return "Logged out", 200

@app.route('/check_device_status')
def check_device_status():
    device_id = request.args.get('device_id')
    if not device_id:
        return "Missing device_id", 400

    is_online = sql.is_device_online(device_id)
    return jsonify({"online": is_online})

@app.route('/index')
def index():
    users = sql.show_all_users()
    for user in users:
        print(user)
    return send_from_directory('static', 'index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
    
