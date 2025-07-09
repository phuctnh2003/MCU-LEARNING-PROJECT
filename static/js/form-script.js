function showInterfaceForm() {
    const type = document.getElementById("interfaceSelect").value;
    document.getElementById("i2cFields").classList.add("hidden");
    document.getElementById("uartFields").classList.add("hidden");
    document.getElementById("spiFields").classList.add("hidden");

    if (type === "i2c") document.getElementById("i2cFields").classList.remove("hidden");
    if (type === "uart") document.getElementById("uartFields").classList.remove("hidden");
    if (type === "spi") document.getElementById("spiFields").classList.remove("hidden");
}

function addInitRow() {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" class="reg" placeholder="0x09"></td>
    <td><input type="text" class="val" placeholder="0x03"></td>
    <td><button type="button" onclick="this.closest('tr').remove()">X</button></td>`;
    document.querySelector("#initTable tbody").appendChild(row);
}

function addFieldRow() {
    const row = document.createElement("tr");
    row.innerHTML = `
    <td><input type="text" class="fname"></td>
    <td><input type="text" class="fstart" placeholder="0 hoặc 0x00"></td>
    <td><input type="number" class="flength"></td>
    <td><input type="checkbox" class="fsigned"></td>
    <td><button type="button" onclick="this.closest('tr').remove()">X</button></td>`;
    document.querySelector("#fieldTable tbody").appendChild(row);
}

// ✅ HÀM MỚI: Tách phần gắn sự kiện để có thể gọi lại thủ công
function initFormEvents() {
    const select = document.getElementById("interfaceSelect");
    if (select) select.addEventListener("change", showInterfaceForm);

    const form = document.getElementById("sensorForm");
    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            const form = new FormData(this);
            const json = {
                name: form.get("name"),
                interface: form.get("interface"),
                sample_count: parseInt(form.get("sample_count")) || 10,
                polling_interval_ms: parseInt(form.get("polling_interval_ms")),
                init_sequence: [],
                fields: []
            };

            if (json.interface === "i2c") {
                json.address = form.get("address").trim();
                json.read_register = form.get("read_register").trim();
                json.read_length = parseInt(form.get("read_length"));
            } else if (json.interface === "uart") {
                json.port = form.get("port");
                json.baudrate = parseInt(form.get("baudrate"));
                json.parse = form.get("parse");
            } else if (json.interface === "spi") {
                json.bus = parseInt(form.get("bus"));
                json.device = parseInt(form.get("device"));
                json.read_command = form.get("read_command").split(",").map(s => s.trim());
                json.read_length = parseInt(form.get("read_length_spi"));
            }

            document.querySelectorAll("#initTable tbody tr").forEach(tr => {
                const reg = tr.querySelector(".reg").value.trim();
                const val = tr.querySelector(".val").value.trim();
                if (reg && val) json.init_sequence.push({ reg, value: val });
            });

            document.querySelectorAll("#fieldTable tbody tr").forEach(tr => {
                const name = tr.querySelector(".fname").value;
                const start = tr.querySelector(".fstart").value.trim();
                const length = tr.querySelector(".flength").value;
                const signed = tr.querySelector(".fsigned").checked;
                if (name) json.fields.push({ name, start, length: parseInt(length), signed });
            });

            const output = document.getElementById("output");
            output.textContent = JSON.stringify(json, null, 2); // hiển thị trước
            const raspIP = localStorage.getItem("raspberry_ip") || "127.0.0.1";
            console.log(raspIP)
            fetch(`http://${raspIP}:5000/config`, {

                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(json)
            })
                .then(response => {
                    if (!response.ok) throw new Error("Lỗi khi gửi dữ liệu!");
                    return response.json();
                })
                .then(data => {
                    output.textContent += "\n\n✅ Gửi thành công:\n" + JSON.stringify(data, null, 2);
                })
                .catch(error => {
                    output.textContent += "\n\n❌ Gửi thất bại:\n" + error.message;
                });

        });
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
        downloadBtn.addEventListener("click", downloadJson);
    }
}

function downloadJson() {
    const content = document.getElementById("output").textContent;
    if (!content) {
        alert("Chưa có dữ liệu JSON. Hãy điền form và nhấn 'Tạo JSON' trước.");
        return;
    }

    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = "sensor_config_" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 0);
}

// ✅ GỌI TỰ ĐỘNG LẦN ĐẦU (nếu script này được load cùng trang)
document.addEventListener("DOMContentLoaded", () => {
    initFormEvents();
});
