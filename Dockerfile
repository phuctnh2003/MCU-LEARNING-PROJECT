FROM python:3.13.0-slim

# Cài gói hệ thống cần cho MariaDB connector
RUN apt-get update && apt-get install -y \
    gcc libmariadb-dev && \
    apt-get clean

WORKDIR /app

COPY . /app

RUN pip install --upgrade pip && \
    pip install -r requirements.txt

EXPOSE 5000

CMD ["python", "controller.py"]
