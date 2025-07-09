import sqlite3
from my_log import AppLogger
from datetime import datetime, timedelta
from function import md5_transmit, is_valid_password
from error_codes import *

log = AppLogger()
class SQLFunction:
    def __init__(self, db_path="users.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    name TEXT,
                    email TEXT UNIQUE,
                    password TEXT,
                    device_id TEXT 
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS devices (
                    device_id TEXT PRIMARY KEY,
                    last_seen DATETIME,
                    device_ip TEXT
                )
            """)
            conn.commit()

    def reset_database(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS users")
            cursor.execute("DROP TABLE IF EXISTS devices")
            conn.commit()
            log.info("Database reset: all tables dropped.")
            self._init_db()  # Tạo lại bảng
        finally:
            conn.close()   
    def register_user(self, username, name, email, password):
        if not is_valid_password(password):
            log.error("Register invalid password format")
            return INVALID_PASSWORD_FORMAT

        hashed_password = md5_transmit(password)

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Kiểm tra username
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                log("Register username already exists")
                return USERNAME_EXISTS

            # Kiểm tra email
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                log("Register email already exists")
                return EMAIL_EXISTS

            cursor.execute("""
                INSERT INTO users (username, name, email, password)
                VALUES (?, ?, ?, ?)
            """, (username, name, email, hashed_password))
            conn.commit()
            return SUCCESS
        except Exception as e:
            log(f"Register Error: {e}")
            return DB_ERROR
        finally:
            conn.close()

    def login_user(self, username, password):
        hashed_password = md5_transmit(password)
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT password FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if row and row[0] == hashed_password:
                return SUCCESS
            else:
                log.error("Login failed")
                return INVALID_CREDENTIALS
        except Exception as e:
            log(f"Login Error: {e}")
            return DB_ERROR
        finally:
            conn.close()

    def forget_password(self, email, old_password, new_password):
        if not is_valid_password(new_password):
            log.error("Forget Password invalid password format")
            return INVALID_PASSWORD_FORMAT

        hashed_old = md5_transmit(old_password)
        hashed_new = md5_transmit(new_password)

        if hashed_old == hashed_new:
            log.error("Forget Password same password")
            return SAME_PASSWORD

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Kiểm tra người dùng có tồn tại không
            cursor.execute("SELECT password FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            if not row:
                log.error("Forget Password user not found")
                return INVALID_CREDENTIALS

            stored_password = row[0]
            if stored_password != hashed_old:
                log.error("Forget Password invalid old password")
                return INVALID_OLD_PASSWORD

            cursor.execute("UPDATE users SET password = ? WHERE email = ?", (hashed_new, email))
            conn.commit()
            return SUCCESS

        except Exception as e:
            log(f"Forgot Password Error: {e}")
            return DB_ERROR

        finally:
            conn.close()

    def change_password(self, username, old_password, new_password):
        if not is_valid_password(new_password):
            log.error("Change Password invalid password format")
            return INVALID_PASSWORD_FORMAT

        hashed_old = md5_transmit(old_password)
        hashed_new = md5_transmit(new_password)

        if hashed_old == hashed_new:
            log.error("Change Password same password")
            return SAME_PASSWORD

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT password FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            
            if not row:
                log.error("Change Password user not found")
                log.error(row)
                return INVALID_CREDENTIALS

            stored_password = row[0]
            if stored_password != hashed_old:
                log.error("Change Password invalid old password")
                return INVALID_OLD_PASSWORD  

            cursor.execute("UPDATE users SET password = ? WHERE username  = ?", (hashed_new, username ))
            conn.commit()
            return SUCCESS

        except Exception as e:
            log(f"Change Password Error: {e}")
            return DB_ERROR

        finally:
            conn.close()
           
    def get_user_info(self, username):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT username, name, email, device_id FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            return {"username": row[0], "name": row[1], "email": row[2], "device_id": row[3]} if row else USER_NOT_FOUND
        except Exception as e:
            log(f"Get User Info Error: {e}")
            return DB_ERROR
        finally:
            conn.close()

    def show_all_users(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users")
            return cursor.fetchall()
        except Exception as e:
            log(f"Show All Users Error: {e}")
            return DB_ERROR
        finally:
            conn.close()

    # Các hàm quản lý thiết bị 
    def add_device(self, device_id, device_ip):
        try:
            now = datetime.utcnow().isoformat()
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT device_id FROM devices WHERE device_id = ?", (device_id,))
            if cursor.fetchone():
                cursor.execute("UPDATE devices SET last_seen = ?, device_ip = ? WHERE device_id = ?",
                            (now, device_ip, device_id))
            else:
                cursor.execute("INSERT INTO devices (device_id, last_seen, device_ip) VALUES (?, ?, ?)",
                            (device_id, now, device_ip))
            conn.commit()
            log.info(f"[ADD_DEVICE] Device {device_id} added/updated successfully.")
            return SUCCESS
        except Exception as e:
            log(f"[ADD_DEVICE] Error: {e}")
            return DB_ERROR
        finally:
            conn.close()

    def get_device_info_by_username(self, username):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Tìm device_id dựa theo username
            cursor.execute("SELECT device_id FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if not row or not row[0]:
                log.warning(f"[GET_DEVICE_INFO] No device assigned to username '{username}'")
                return None

            device_id = row[0]

            # Lấy thông tin thiết bị từ device_id
            cursor.execute("SELECT device_ip, last_seen FROM devices WHERE device_id = ?", (device_id,))
            device_info = cursor.fetchone()

            if device_info:
                return {
                    "device_id": device_id,
                    "device_ip": device_info[0],
                    "last_seen": device_info[1]
                }
            else:
                log.warning(f"[GET_DEVICE_INFO] Device {device_id} not found in devices table")
                return None
        except Exception as e:
            log(f"[GET_DEVICE_INFO] Error: {e}")
            return DB_ERROR
        finally:
            conn.close()

    def upsert_device(self, device_id, last_seen):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT device_id FROM devices WHERE device_id = ?", (device_id,))
            if cursor.fetchone():
                cursor.execute("UPDATE devices SET last_seen = ? WHERE device_id = ?", (last_seen, device_id))
            else:
                cursor.execute("INSERT INTO devices (device_id, last_seen) VALUES (?, ?, ?)", (device_id, last_seen))
            conn.commit()
        except Exception as e:
            log(f"Upsert Device Error: {e}")
        finally:
            conn.close()

    def get_online_device(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            threshold = datetime.utcnow() - timedelta(seconds=20)
            cursor.execute("SELECT device_id FROM devices WHERE last_seen >= ?", (threshold.isoformat(),))
            row = cursor.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def get_user_device(self, username):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT device_id FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def set_user_device(self, username, device_id):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET device_id = ? WHERE username = ?", (device_id, username))
            conn.commit()
        finally:
            conn.close()

    def clear_user_device(self, username):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET device_id = NULL WHERE username = ?", (username,))
            conn.commit()
        finally:
            conn.close()

    def cleanup_stale_devices(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            threshold = datetime.utcnow() - timedelta(seconds=30)
            cursor.execute("SELECT device_id FROM devices WHERE last_seen < ?", (threshold.isoformat(),))
            stale_devices = [row[0] for row in cursor.fetchall()]
            if stale_devices:
                cursor.executemany("UPDATE users SET device_id = NULL WHERE device_id = ?", [(d,) for d in stale_devices])
                conn.commit()
        finally:
            conn.close()

    def is_device_online(self, device_id):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            threshold = datetime.utcnow() - timedelta(seconds=30)
            cursor.execute("SELECT 1 FROM devices WHERE device_id = ? AND last_seen >= ?", (device_id, threshold.isoformat()))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    def is_device_assigned_to_another_user(self, username, device_id):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT username FROM users WHERE device_id = ? AND username != ?", (device_id, username))
            return cursor.fetchone() is not None
        finally:
            conn.close()

    
if __name__ == '__main__':

    sql = SQLFunction()
    # Example usage
    # sql.reset_database()
    # sql.add_device("raspberry-01","100.78.240.100")
   # print(sql.register_user("phongpt", "Phong", "phong@gmail.com", "Phong123@"))
    #print(sql.login_user("phongpt", "Phong123@"))
 
