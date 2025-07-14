#!/bin/sh

echo "Waiting for MySQL..."

until nc -z db 3306; do
  sleep 1
done

echo "MySQL is up. Starting app..."
exec python run_server.py
