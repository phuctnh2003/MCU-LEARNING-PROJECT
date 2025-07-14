import threading
from controller import app as rest_app
from websocket_server import app_ws as ws_app


def run_rest():
    try:
        print("Starting REST API on port 5555...")
        rest_app.run(host="0.0.0.0", port=5555)
    except Exception as e:
        print(f"REST API error: {e}")


def run_ws():
    try:
        print("Starting WebSocket server on port 5050...")
        ws_app.run(host="0.0.0.0", port=5050)
    except Exception as e:
        print(f"WebSocket error: {e}")


if __name__ == "__main__":
    t1 = threading.Thread(target=run_rest)
    t2 = threading.Thread(target=run_ws)

    t1.start()
    t2.start()

    t1.join()
    t2.join()
