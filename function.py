import re
import hashlib
import os
import json
from openai import OpenAI
from dotenv import load_dotenv


PASSWORD_PATTERN = (
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{4,}$"
)

load_dotenv()
client = OpenAI(
    base_url="https://openrouter.ai/api/v1", api_key=os.getenv("API_KEY_DEEPSEEK")
)


def extract_code(text):
    match = re.search(r"```(?:python)?\n(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text.strip()


def clean_markdown(md_text: str) -> str:
    """
    Loại bỏ các ký tự định dạng markdown như **, __, ***, ```, ###, - ...
    """
    text = md_text
    # ***bold+italic***
    text = re.sub(r"\*\*\*(.*?)\*\*\*", r"\1", text)
    # '''code'''
    text = re.sub(r"'''(.*?)'''", r"\1", text, flags=re.DOTALL)
    # **bold**
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    # __underline__
    text = re.sub(r"__([^_]+)__", r"\1", text)
    # `inline code`
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # ### Headers
    text = re.sub(r"#+\s*", "", text)
    # Normalize list dash
    text = re.sub(r"-\s+", "- ", text)
    return text.strip()


# Gọi chatbox
def explain_sensor_data(data: dict, clean_output=True) -> str:
    formatted_json = json.dumps(data, indent=2, ensure_ascii=False)

    prompt = (
        formatted_json + "\n\nHãy giải thích ngắn gọn. "
        "Nếu không đủ thông tin, hãy nói rõ không xác định được mục đích."
    )

    completion = client.chat.completions.create(
        model="deepseek/deepseek-r1-0528",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
    )
    raw_output = completion.choices[0].message.content
    return clean_markdown(raw_output) if clean_output else raw_output


# Function to compute MD5 hash and return it as a 32-character hexadecimal string
def md5_transmit(input_str):
    hash_object = hashlib.md5(input_str.encode())
    return hash_object.hexdigest().zfill(32)


# check password
def is_valid_password(password):
    return re.match(PASSWORD_PATTERN, password) is not None
