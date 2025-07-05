import os
import re
import hashlib

PASSWORD_PATTERN = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$'

# Function to compute MD5 hash and return it as a 32-character hexadecimal string
def md5_transmit(input_str):
    hash_object = hashlib.md5(input_str.encode())
    return hash_object.hexdigest().zfill(32)

#check password
def is_valid_password(password):
    return re.match(PASSWORD_PATTERN, password) is not None