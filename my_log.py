import logging
import sys


class AppLogger:
    def __init__(
        self, name="AppLogger", log_file="/home/phuctnh/mcu-learning-v1.0-beta/app.log"
    ):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

        formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

        # File handler (đã đúng)
        file_handler = logging.FileHandler("log.txt", encoding="utf-8")
        file_handler.setFormatter(formatter)

        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        try:
            stream_handler.stream.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

        if not self.logger.hasHandlers():
            self.logger.addHandler(file_handler)
            self.logger.addHandler(stream_handler)

    def info(self, msg):
        self.logger.info(msg)

    def warning(self, msg):
        self.logger.warning(msg)

    def error(self, msg):
        self.logger.error(msg)

    def debug(self, msg):
        self.logger.debug(msg)


log = AppLogger()
