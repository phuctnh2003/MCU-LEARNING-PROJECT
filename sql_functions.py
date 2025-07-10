import mysql.connector
from my_log import AppLogger
from datetime import datetime, timedelta
from function import md5_transmit, is_valid_password
from error_codes import *

log = AppLogger()

class SQLFunction:
    def __init__(self, host="localhost", user="root", password="", database="iot_db"):
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self._init_db()

    def _get_connection(self):
        return mysql.connector.connect(
            host=self.host,
            user=self.user,
            password=self.password,
            database=self.database
        )

    def _init_db(self):
        try:
            conn = mysql.connector.connect(
                host=self.host,
                user=self.user,
                password=self.password
            )
            cursor = conn.cursor()
            
            # Create database if not exists
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {self.database}")
            conn.commit()
            cursor.close()
            conn.close()
            
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    password VARCHAR(255),
                    device_id VARCHAR(255)
                )
            """)
            
            # Create devices table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS devices (
                    device_id VARCHAR(255) PRIMARY KEY,
                    last_seen DATETIME,
                    device_ip VARCHAR(255)
                )
            """)
            
            cursor.execute("SELECT device_id FROM devices WHERE device_id = 'raspberry-01'")
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO devices (device_id, last_seen, device_ip)
                    VALUES (%s, %s, %s)
                """, ("raspberry-01", datetime.utcnow().isoformat(), "100.78.240.100"))
            
            conn.commit()
            log.info("Database initialized successfully")
        except Exception as e:
            log.error(f"Error initializing database: {e}")
            raise
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def reset_database(self):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("DROP TABLE IF EXISTS users")
            cursor.execute("DROP TABLE IF EXISTS devices")
            conn.commit()
            log.info("Database reset: all tables dropped.")
            self._init_db()  # Recreate tables
        except Exception as e:
            log.error(f"Error resetting database: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def register_user(self, username, name, email, password):
        if not is_valid_password(password):
            log.error("Register invalid password format")
            return INVALID_PASSWORD_FORMAT

        hashed_password = md5_transmit(password)

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Check username
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                log.error("Register username already exists")
                return USERNAME_EXISTS

            # Check email
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                log.error("Register email already exists")
                return EMAIL_EXISTS

            cursor.execute("""
                INSERT INTO users (username, name, email, password)
                VALUES (%s, %s, %s, %s)
            """, (username, name, email, hashed_password))
            conn.commit()
            return SUCCESS
        except Exception as e:
            log.error(f"Register Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def login_user(self, username, password):
        hashed_password = md5_transmit(password)
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT password FROM users WHERE username = %s", (username,))
            row = cursor.fetchone()
            if row and row[0] == hashed_password:
                return SUCCESS
            else:
                log.error("Login failed")
                return INVALID_CREDENTIALS
        except Exception as e:
            log.error(f"Login Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
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
            conn = self._get_connection()
            cursor = conn.cursor()

            # Check if user exists
            cursor.execute("SELECT password FROM users WHERE email = %s", (email,))
            row = cursor.fetchone()
            if not row:
                log.error("Forget Password user not found")
                return INVALID_CREDENTIALS

            stored_password = row[0]
            if stored_password != hashed_old:
                log.error("Forget Password invalid old password")
                return INVALID_OLD_PASSWORD

            cursor.execute("UPDATE users SET password = %s WHERE email = %s", (hashed_new, email))
            conn.commit()
            return SUCCESS

        except Exception as e:
            log.error(f"Forgot Password Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
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
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT password FROM users WHERE username = %s", (username,))
            row = cursor.fetchone()
            
            if not row:
                log.error("Change Password user not found")
                log.error(row)
                return INVALID_CREDENTIALS

            stored_password = row[0]
            if stored_password != hashed_old:
                log.error("Change Password invalid old password")
                return INVALID_OLD_PASSWORD  

            cursor.execute("UPDATE users SET password = %s WHERE username = %s", (hashed_new, username))
            conn.commit()
            return SUCCESS

        except Exception as e:
            log.error(f"Change Password Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()
           
    def get_user_info(self, username):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT username, name, email, device_id FROM users WHERE username = %s", (username,))
            row = cursor.fetchone()
            return {"username": row[0], "name": row[1], "email": row[2], "device_id": row[3]} if row else USER_NOT_FOUND
        except Exception as e:
            log.error(f"Get User Info Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def show_all_users(self):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users")
            return cursor.fetchall()
        except Exception as e:
            log.error(f"Show All Users Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    # Device management functions
    def add_device(self, device_id, device_ip):
        try:
            now = datetime.utcnow().isoformat()
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT device_id FROM devices WHERE device_id = %s", (device_id,))
            if cursor.fetchone():
                cursor.execute("UPDATE devices SET last_seen = %s, device_ip = %s WHERE device_id = %s",
                            (now, device_ip, device_id))
            else:
                cursor.execute("INSERT INTO devices (device_id, last_seen, device_ip) VALUES (%s, %s, %s)",
                            (device_id, now, device_ip))
            conn.commit()
            log.info(f"[ADD_DEVICE] Device {device_id} added/updated successfully.")
            return SUCCESS
        except Exception as e:
            log.error(f"[ADD_DEVICE] Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def get_device_info_by_username(self, username):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Find device_id based on username
            cursor.execute("SELECT device_id FROM users WHERE username = %s", (username,))
            row = cursor.fetchone()
            if not row or not row[0]:
                log.warning(f"[GET_DEVICE_INFO] No device assigned to username '{username}'")
                return None

            device_id = row[0]

            # Get device info from device_id
            cursor.execute("SELECT device_ip, last_seen FROM devices WHERE device_id = %s", (device_id,))
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
            log.error(f"[GET_DEVICE_INFO] Error: {e}")
            return DB_ERROR
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def upsert_device(self, device_id, last_seen):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("SELECT device_id FROM devices WHERE device_id = %s", (device_id,))
            if cursor.fetchone():
                cursor.execute("UPDATE devices SET last_seen = %s WHERE device_id = %s", (last_seen, device_id))
            else:
                cursor.execute("INSERT INTO devices (device_id, last_seen) VALUES (%s, %s)", (device_id, last_seen))
            conn.commit()
        except Exception as e:
            log.error(f"Upsert Device Error: {e}")
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def get_online_device(self):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            threshold = datetime.utcnow() - timedelta(seconds=20)
            cursor.execute("SELECT device_id FROM devices WHERE last_seen >= %s", (threshold.isoformat(),))
            row = cursor.fetchone()
            return row[0] if row else None
        except Exception as e:
            log.error(f"Get Online Device Error: {e}")
            return None
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def get_user_device(self, username):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT device_id FROM users WHERE username = %s", (username,))
            row = cursor.fetchone()
            return row[0] if row else None
        except Exception as e:
            log.error(f"Get User Device Error: {e}")
            return None
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def set_user_device(self, username, device_id):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET device_id = %s WHERE username = %s", (device_id, username))
            conn.commit()
        except Exception as e:
            log.error(f"Set User Device Error: {e}")
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def clear_user_device(self, username):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET device_id = NULL WHERE username = %s", (username,))
            conn.commit()
        except Exception as e:
            log.error(f"Clear User Device Error: {e}")
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def cleanup_stale_devices(self):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            threshold = datetime.utcnow() - timedelta(seconds=30)
            cursor.execute("SELECT device_id FROM devices WHERE last_seen < %s", (threshold.isoformat(),))
            stale_devices = [row[0] for row in cursor.fetchall()]
            if stale_devices:
                cursor.executemany("UPDATE users SET device_id = NULL WHERE device_id = %s", [(d,) for d in stale_devices])
                conn.commit()
        except Exception as e:
            log.error(f"Cleanup Stale Devices Error: {e}")
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def is_device_online(self, device_id):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            threshold = datetime.utcnow() - timedelta(seconds=30)
            cursor.execute("SELECT 1 FROM devices WHERE device_id = %s AND last_seen >= %s", 
                          (device_id, threshold.isoformat()))
            return cursor.fetchone() is not None
        except Exception as e:
            log.error(f"Is Device Online Error: {e}")
            return False
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    def is_device_assigned_to_another_user(self, username, device_id):
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT username FROM users WHERE device_id = %s AND username != %s", 
                         (device_id, username))
            return cursor.fetchone() is not None
        except Exception as e:
            log.error(f"Is Device Assigned Error: {e}")
            return False
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()