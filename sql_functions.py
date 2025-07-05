
from asyncio import sleep
import sqlite3
from datetime import datetime, timedelta
from function import md5_transmit, is_valid_password
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
                email TEXT,
                password TEXT,
                device_id TEXT 
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                last_seen DATETIME
            )
            """)
            
        conn.commit()


    def register_user(self, username, name, email, password):
        if not is_valid_password(password):
            return "INVALID_PASSWORD"

        hashed_password = md5_transmit(password)

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Kiểm tra username đã tồn tại chưa
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                return "USERNAME_EXISTS"

            # Thêm người dùng mới
            cursor.execute(
                "INSERT INTO users (username, name, email, password) VALUES (?, ?, ?, ?)",
                (username, name, email, hashed_password)
            )
            conn.commit()
            return "SUCCESS"
        except Exception as e:
            print(f"Error during register: {e}")
            return "ERROR"
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
                return "SUCCESS"
            else:
                return "INVALID_CREDENTIALS"
        except Exception as e:
            print(f"Error during login: {e}")
            return "ERROR"
        finally:
            conn.close()

    def get_user_info(self, username):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT username, name, email FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if row:
                return {
                    "username": row[0],
                    "name": row[1],
                    "email": row[2]
                }
            else:
                return "USER_NOT_FOUND"
        except Exception as e:
            print(f"Error during get_user_info: {e}")
            return "ERROR"
        finally:
            conn.close()

    def forget_password(self, email, old_password, new_password):
        if not is_valid_password(new_password):
            return "INVALID_PASSWORD"

        hashed_old_password = md5_transmit(old_password)
        hashed_new_password = md5_transmit(new_password)

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("SELECT id FROM users WHERE email = ? AND password = ?", (email, hashed_old_password))
            row = cursor.fetchone()
            if row:
                cursor.execute("UPDATE users SET password = ? WHERE email = ?", (hashed_new_password, email))
                conn.commit()
                return "SUCCESS"
            else:
                return "INVALID_CREDENTIALS"
        except Exception as e:
            print(f"Error during forget_password: {e}")
            return "ERROR"
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
                cursor.execute("INSERT INTO devices (device_id, last_seen) VALUES (?, ?)", (device_id, last_seen))

            conn.commit()
        except Exception as e:
            print(f"Error during heartbeat: {e}")
        finally:
            conn.close()

    def get_online_device(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            threshold = datetime.utcnow() - timedelta(seconds=30)
            cursor.execute("SELECT device_id FROM devices WHERE last_seen >= ?", (threshold.isoformat(),))
            row = cursor.fetchone()
            if row:
                return row[0]
            return None
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

                # Lấy các device_id đã ngắt kết nối
                cursor.execute("SELECT device_id FROM devices WHERE last_seen < ?", (threshold.isoformat(),))
                stale_devices = [row[0] for row in cursor.fetchall()]

                if stale_devices:
                    # Xoá device_id khỏi bảng user nếu nó là thiết bị đã ngắt kết nối
                    cursor.executemany("UPDATE users SET device_id = NULL WHERE device_id = ?", [(d,) for d in stale_devices])
                    conn.commit()
            finally:
                conn.close()
    def is_device_online(self, device_id):
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()

                threshold = datetime.utcnow() - timedelta(seconds=30)
                cursor.execute(
                    "SELECT 1 FROM devices WHERE device_id = ? AND last_seen >= ?",
                    (device_id, threshold.isoformat())
                )
                row = cursor.fetchone()
                return row is not None
            finally:
                conn.close()
    def is_device_assigned_to_another_user(self, username, device_id):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT username FROM users
                WHERE device_id = ? AND username != ?
            """, (device_id, username))
            row = cursor.fetchone()
            return row is not None  # Có người dùng khác đã dùng device_id này
        finally:
            conn.close()

    def show_all_users(self):
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM users")
                rows = cursor.fetchall()
                return rows
            except Exception as e:
                print(f"Error during show_all_users: {e}")
                return "ERROR"
            finally:
                conn.close()
    
if __name__ == '__main__':

    sql = SQLFunction()
    # Example usage
    sql.show_all_users()
    sql.clear_user_device("phucbm")
    for user in sql.show_all_users():
        print(user)


