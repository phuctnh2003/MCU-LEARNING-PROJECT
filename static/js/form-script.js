let socket;
let lastSensorOutput = null;

function initWebSocket() {
    console.log("[Đang khởi tạo kết nối WebSocket...]");

    socket = new WebSocket("wss://mcu-learning.project.io.vn/ws");

    socket.onopen = () => {
        console.log("WebSocket đã kết nối thành công");
        showToast("success", "Thông báo", "Đã kết nối WebSocket thành công");
    };

    socket.onclose = () => {
        console.log("WebSocket đã mất kết nối");
        showToast("error", "Mất kết nối", "WebSocket bị ngắt, đang thử lại sau 3 giây...");
        setTimeout(initWebSocket, 3000);
    };

    socket.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error("Không thể parse JSON:", e);
            showToast("error", "Lỗi", "Dữ liệu không hợp lệ từ máy chủ");
            setProcessingState(false);
            return;
        }

        const { event: evt, data } = msg;

        if (evt === "data_sensor_web") {
            const output = document.getElementById("output");
            if (!output) {
                showToast("error", "Lỗi", "Không tìm thấy vùng hiển thị dữ liệu");
                setProcessingState(false);
                return;
            }

            output.style.whiteSpace = "pre-wrap";

            const payload = data.received || data;

            if (payload.error) {
                output.innerHTML = escapeHTML(payload.error).replace(/\n/g, "<br>");
                output.style.color = "red";
            } else if (payload.output) {
                output.innerHTML = escapeHTML(payload.output).replace(/\n/g, "<br>");
                output.style.color = "black";
            }
            else {
                output.textContent = JSON.stringify(payload, null, 2);
                output.style.color = "black";
            }

            lastSensorOutput = output.textContent;
            setProcessingState(false);
        }


        else if (evt === "gpt_explanation_result") {
            const explainOutput = document.getElementById("output_ex");
            const explainField = document.getElementById("explanationField");

            if (explainOutput) {
                explainOutput.style.whiteSpace = "pre-wrap";
                if (data.error) {
                    explainOutput.textContent = "Lỗi: " + data.error;
                    explainOutput.style.color = "red";
                } else {
                    explainOutput.textContent = data.content;
                    explainOutput.style.color = "black";
                }
                explainField.classList.remove("hidden");
            } else {
                showToast("error", "Lỗi", "Không tìm thấy vùng hiển thị giải thích");
            }
            setProcessingState(false);
        }
    };
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function extractDeviceIdFromJwt() {
    const token = localStorage.getItem("jwt_token");
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.device_id || null;
    } catch (e) {
        console.error("Lỗi giải mã JWT:", e);
        return null;
    }
}

function showInterfaceForm(type) {
    document.getElementById("customCodeBlock").classList.add("hidden");
    const pollingInput = document.querySelector('input[name="polling_interval_ms"]');
    document.getElementById("i2cFields").classList.add("hidden");
    document.getElementById("uartFields").classList.add("hidden");
    document.getElementById("spiFields").classList.add("hidden");
    document.getElementById("initSequenceFields").classList.add("hidden");
    document.getElementById("binaryFieldTable").classList.add("hidden");
    document.getElementById("uartFieldPatternTable").classList.add("hidden");
    document.getElementById("uartInitCommandSection").classList.add("hidden");
    const scaleColumns = document.querySelectorAll(".scale-column");
    scaleColumns.forEach(col => {
        col.style.display = type === "spi" ? "" : "none";
    });
    document.querySelectorAll("#fieldTable tbody tr").forEach(tr => {
        const scaleCol = tr.querySelector(".scale-column");
        if (scaleCol) {
            scaleCol.style.display = type === "spi" ? "" : "none";
        }
    });
    if (type === "spi") {
        document.getElementById("spiFields").classList.remove("hidden");
        document.getElementById("binaryFieldTable").classList.remove("hidden");
        document.getElementById("commonFields").style.display = "none";
        if (pollingInput) pollingInput.removeAttribute("required");
    } else {
        document.getElementById("commonFields").style.display = "block";
        if (pollingInput) pollingInput.setAttribute("required", "true");

        if (type === "i2c") {
            document.getElementById("i2cFields").classList.remove("hidden");
            document.getElementById("initSequenceFields").classList.remove("hidden");
            document.getElementById("binaryFieldTable").classList.remove("hidden");
        } else if (type === "uart") {
            document.getElementById("uartFields").classList.remove("hidden");
            document.getElementById("uartFieldPatternTable").classList.remove("hidden");
            document.getElementById("uartInitCommandSection").classList.remove("hidden");
        } else if (type === "custom") {
            const nameInput = document.querySelector("input[name='name']");
            if (nameInput) nameInput.removeAttribute("required");
            document.getElementById("commonFields").style.display = "none";
            if (pollingInput) pollingInput.removeAttribute("required");
            document.querySelector('fieldset').classList.add('hidden');
            document.getElementById("customCodeBlock").classList.remove("hidden");
            // Ẩn các phần khác
            [
                "i2cFields", "uartFields", "spiFields", "initSequenceFields",
                "binaryFieldTable", "uartFieldPatternTable", "uartInitCommandSection"
            ].forEach(id => document.getElementById(id).classList.add("hidden"));
        }

    }
}

function addUartInitRow() {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" class="uart-init-cmd" placeholder="VD: AT+INIT\\r\\n"></td>
    <td><button type="button" onclick="this.closest('tr').remove()">X</button></td>
  `;
    document.querySelector("#uartInitTable tbody").appendChild(row);
}

function addUartFieldRow() {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" class="uart-fname"></td>
    <td><input type="text" class="uart-pattern" placeholder="VD: Temp:(\\d+\\.\\d+)"></td>
    <td>
      <select class="uart-type">
        <option value="int">int</option>
        <option value="float">float</option>
        <option value="string">string</option>
      </select>
    </td>
    <td><button type="button" onclick="this.closest('tr').remove()">X</button></td>
  `;
    document.querySelector("#uartFieldTable tbody").appendChild(row);
}

function addInitRow() {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" class="reg" placeholder="0x09"></td>
    <td><input type="text" class="val" placeholder="0x03"></td>
    <td><button type="button" onclick="this.closest('tr').remove()">X</button></td>
  `;
    document.querySelector("#initTable tbody").appendChild(row);
}

function addFieldRow() {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" class="fname"></td>
    <td><input type="text" class="fstart" placeholder="0 hoặc 0x00"></td>
    <td><input type="number" class="flength"></td>
    <td><input type="checkbox" class="fsigned"></td>
    <td class="scale-column"><input type="number" class="fscale" step="0.01" value="1.0"></td>
    <td><button type="button" onclick="this.closest('tr').remove()">X</button></td>
    `;
    document.querySelector("#fieldTable tbody").appendChild(row);

    const iface = document.getElementById("interfaceInput")?.value;
    row.querySelector(".scale-column").style.display = iface === "spi" ? "" : "none";
}

function initFormEvents() {
    const form = document.getElementById("sensorForm");

    const iface = document.getElementById("interfaceInput")?.value;
    if (iface) {
        showInterfaceForm(iface);
    }

    document.getElementById("addInitRowBtn").addEventListener("click", addInitRow);
    document.getElementById("addFieldRowBtn").addEventListener("click", addFieldRow);
    document.getElementById("addUartFieldRowBtn").addEventListener("click", addUartFieldRow);
    document.getElementById("addUartInitRowBtn").addEventListener("click", addUartInitRow);


    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const iface = formData.get("interface");

            const json = {
                interface: iface,
            };
            if (iface !== "custom") {
                json.fields = [];
            }

            // Common fields
            if (iface !== "custom") {
                json.name = formData.get("name");
            }

            if (iface !== "spi" && iface !== "custom") {
                json.polling_interval_ms = parseInt(formData.get("polling_interval_ms")) || 1000;
            }

            if (formData.get("sample_count")) {
                json.sample_count = parseInt(formData.get("sample_count"));
            }

            // Build data by interface
            if (iface === "i2c") {
                json.address = formData.get("address").trim();
                json.read_register = formData.get("read_register").trim();
                json.read_length = parseInt(formData.get("read_length"));

                json.init_sequence = [];
                document.querySelectorAll("#initTable tbody tr").forEach(tr => {
                    const reg = tr.querySelector(".reg")?.value.trim();
                    const val = tr.querySelector(".val")?.value.trim();
                    if (reg && val) {
                        json.init_sequence.push({ reg, value: val });
                    }
                });

                document.querySelectorAll("#fieldTable tbody tr").forEach(tr => {
                    const name = tr.querySelector(".fname")?.value.trim();
                    const startStr = tr.querySelector(".fstart")?.value.trim();
                    const start = startStr.startsWith("0x") ? parseInt(startStr, 16) : parseInt(startStr);
                    const length = parseInt(tr.querySelector(".flength")?.value);
                    const signed = tr.querySelector(".fsigned")?.checked;
                    if (name && !isNaN(start) && length > 0) {
                        json.fields.push({ name, start, length, signed });
                    }
                });

            } else if (iface === "uart") {
                json.port = formData.get("port");
                json.baudrate = parseInt(formData.get("baudrate"));
                let readCmd = formData.get("read_command_uart");
                try {
                    readCmd = JSON.parse(`"${readCmd}"`);
                } catch (e) {
                    console.warn("Lỗi parse read_command:", readCmd);
                }
                json.read_command = readCmd;

                let terminator = formData.get("response_terminator");
                try {
                    terminator = JSON.parse(`"${terminator}"`);
                } catch (e) {
                    console.warn("Lỗi parse terminator:", terminator);
                }
                json.response_terminator = terminator;


                const initCmds = [];
                document.querySelectorAll("#uartInitTable tbody tr").forEach(tr => {
                    let cmd = tr.querySelector(".uart-init-cmd")?.value.trim();
                    if (cmd) {
                        try {
                            cmd = JSON.parse(`"${cmd}"`);
                        } catch (e) {
                            console.warn("Lỗi parse init_command:", cmd);
                        }
                        initCmds.push(cmd);
                    }
                });

                if (initCmds.length > 0) {
                    json.init_command = initCmds;
                }

                document.querySelectorAll("#uartFieldTable tbody tr").forEach(tr => {
                    const name = tr.querySelector(".uart-fname")?.value.trim();
                    let pattern = tr.querySelector(".uart-pattern")?.value.trim();
                    const type = tr.querySelector(".uart-type")?.value;

                    try {
                        pattern = JSON.parse(`"${pattern}"`);
                    } catch (e) {
                        console.warn("Không thể parse pattern:", pattern);
                    }

                    if (name && pattern) {
                        json.fields.push({ name, pattern, type });
                    }
                });


            } else if (iface === "spi") {
                json.bus = parseInt(formData.get("bus"));
                json.device = parseInt(formData.get("device"));
                json.read_command = formData.get("read_command")
                    .split(",")
                    .map(s => s.trim());

                json.speed = parseInt(formData.get("speed")) || 500000;
                json.mode = parseInt(formData.get("mode")) || 0;

                document.querySelectorAll("#fieldTable tbody tr").forEach(tr => {
                    const name = tr.querySelector(".fname")?.value.trim();
                    const startStr = tr.querySelector(".fstart")?.value.trim();
                    const start = startStr.startsWith("0x") ? parseInt(startStr, 16) : parseInt(startStr);
                    const length = parseInt(tr.querySelector(".flength")?.value);
                    const signed = tr.querySelector(".fsigned")?.checked;
                    const scaleValue = tr.querySelector(".fscale")?.value;
                    const scale = scaleValue ? parseFloat(scaleValue) : 1.0;
                    if (name && !isNaN(start) && length > 0) {
                        json.fields.push({ name, start, length, signed, scale });
                    }
                });

            } else if (iface === "custom") {
                const code = formData.get("custom_code")?.trim();
                if (!code) {
                    showToast("error", "Lỗi", "Vui lòng nhập mã code");
                    return;
                }
                json.code = code;
            }

            // Gửi dữ liệu WebSocket (chung cho mọi giao thức)
            if (socket && socket.readyState === WebSocket.OPEN) {
                const output = document.getElementById("output");
                if (output) {
                    output.textContent = "⏳ Đang đợi kết quả...";
                }
                setProcessingState(true);
                socket.send(JSON.stringify({
                    event: "send_config",
                    device_id: extractDeviceIdFromJwt() || "",
                    data: json
                }));

                showToast("success", "Thành công", "Đã gửi cấu hình");
            } else {
                showToast("error", "Lỗi", "WebSocket chưa sẵn sàng");
            }
        });
    }
}


document.getElementById("explainBtn").addEventListener("click", function () {
    if (!lastSensorOutput) {
        showToast("error", "Lỗi", "Không có dữ liệu để giải thích");
        return;
    }

    const explainOutput = document.getElementById("output_ex");
    const explainField = document.getElementById("explanationField");

    if (explainOutput) {
        explainOutput.textContent = "⏳ Đang đợi kết quả...";
        explainField.classList.remove("hidden");
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
        setProcessingState(true);
        socket.send(JSON.stringify({
            event: "explain_sensor_data",
            data: lastSensorOutput
        }));
    } else {
        showToast("error", "Lỗi", "WebSocket chưa sẵn sàng");
    }
});
function setProcessingState(isProcessing) {
    const runBtn = document.querySelector("button[type='submit']");
    const explainBtn = document.getElementById("explainBtn");

    if (runBtn) runBtn.disabled = isProcessing;
    if (explainBtn) explainBtn.disabled = isProcessing;
}
