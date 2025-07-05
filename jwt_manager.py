# jwt_manager.py
import jwt
from datetime import datetime, timedelta

class JWTManager:
    def __init__(self, secret_key, algorithm="HS256", expire_minutes=30):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.expire_minutes = expire_minutes

    def create_token(self, payload):
        expire = datetime.utcnow() + timedelta(minutes=self.expire_minutes)
        payload['exp'] = expire
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return token

    def verify_token(self, token):
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            return "TOKEN_EXPIRED"
        except jwt.InvalidTokenError:
            return "INVALID_TOKEN"
