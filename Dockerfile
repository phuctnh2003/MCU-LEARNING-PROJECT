FROM python:3.13.0-slim

WORKDIR /app

# Cài tiện ích netcat (nếu cần)
RUN apt-get update && apt-get install -y netcat-openbsd

# Copy script chờ MySQL
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Cài thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn
COPY . .

# Expose cả 2 cổng nếu bạn muốn truy cập từ ngoài
EXPOSE 5555
EXPOSE 5050

# Lệnh mặc định (sẽ chạy cả REST và WS từ main.py)
CMD ["python", "run_server.py"]
