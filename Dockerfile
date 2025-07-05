# 1. Dùng image Python 3.13 chính thức
FROM python:3.13.0-slim

# 2. Tạo thư mục làm việc trong container
WORKDIR /app

# 3. Copy toàn bộ project vào container
COPY . /app

# 4. Cài đặt pip và các thư viện cần thiết
RUN pip install --upgrade pip \
 && pip install -r requirements.txt

# 5. Mở cổng Flask (mặc định là 5000)
EXPOSE 5000

# 6. Chạy ứng dụng Flask
# Giả sử bạn chạy bằng `python app.py`, nếu khác thì mình sửa cho bạn
CMD ["python", "controller.py"]
