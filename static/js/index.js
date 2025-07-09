let reconnectAttempts = 0;
let reconnectTimer = null;
let autoReconnectTimer = null;
let currentUser = {
  username: '',
  name: '',
  email: '',
  device_id: ''
};
const sidebar = document.getElementById('sidebar');
const openMenu = document.getElementById('openMenu');
const closeMenu = document.getElementById('closeMenu');
const buttonContainer = document.getElementById('buttonContainer');
const templates = [
  { name: 'i2c', description: 'Giao tiếp I2C cơ bản' },
  { name: 'LED Blink', description: 'Nhấp nháy LED' },
  { name: 'UART', description: 'Truyền thông UART' },
  { name: 'ADC Read', description: 'Đọc ADC' },
  { name: 'LCD Display', description: 'Hiển thị trên LCD' },
  { name: 'Button Control', description: 'Điều khiển nút nhấn' }
];
// Thêm các biến quản lý trạng thái thiết bị
const deviceToggle = document.getElementById('deviceToggle1');
const deviceStatus = document.getElementById('deviceStatus1');
const deviceName = document.querySelector('.device-name');
let deviceStatusInterval = null;

openMenu.addEventListener('click', () => {
  sidebar.classList.add('active');
  openMenu.style.display = 'none';
});

closeMenu.addEventListener('click', () => {
  sidebar.classList.remove('active');
  openMenu.style.display = 'block';
});

function showTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  sidebar.classList.remove('active');
  openMenu.style.display = 'block';

  // Quản lý interval kiểm tra trạng thái thiết bị
  if (id === 'connection') {
    updateConnectionTab();
    // Kiểm tra trạng thái mỗi 10 giây khi ở tab connection
    if (this.connectionInterval) clearInterval(this.connectionInterval);
    this.connectionInterval = setInterval(updateConnectionTab, 10000);
  } else {
    if (this.connectionInterval) {
      clearInterval(this.connectionInterval);
      this.connectionInterval = null;
    }
  }
}
// Hàm bắt đầu kiểm tra trạng thái thiết bị
function startDeviceStatusMonitoring() {
  if (deviceStatusInterval) clearInterval(deviceStatusInterval);
  checkDeviceStatus(); // Kiểm tra ngay lập tức
  deviceStatusInterval = setInterval(checkDeviceStatus, 3000); // Kiểm tra mỗi 3 giây
}
let isReconnecting = false;
// Hàm kiểm tra trạng thái thiết bị
async function checkDeviceStatus() {
  if (!deviceIdGlobal || isReconnecting) return;

  try {
    const res = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
    if (res.ok) {
      const data = await res.json();
      updateDeviceStatusUI(data.online);
      updateStatusDot(data.online);

      if (!data.online && !isReconnecting) {
        isReconnecting = true;
        await attemptReconnectWithRetry();
        isReconnecting = false;
      }
    }
  } catch (err) {
    console.error("Error checking device status:", err);
    updateDeviceStatusUI(false);
    updateStatusDot(false);

    if (!isReconnecting) {
      isReconnecting = true;
      await attemptReconnectWithRetry();
      isReconnecting = false;
    }
  }
}

async function updateConnectionTab() {
  try {
    // Gọi API lấy thông tin thiết bị bằng username
    const token = localStorage.getItem("jwt_token");
    const response = await fetch("/device_info_by_username", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.code === 0 && data.data) {
        const deviceInfo = data.data;
        if (deviceInfo.device_ip) {
          localStorage.setItem("raspberry_ip", deviceInfo.device_ip);
        }
        // Cập nhật thông tin thiết bị
        document.getElementById('deviceIdDisplay').textContent = deviceInfo.device_ip || 'N/A';
        document.getElementById('deviceName').textContent = currentUser.device_id || 'Raspberry Pi';

        // Thêm last seen nếu có
        if (deviceInfo.last_seen) {
          const lastSeenElement = document.createElement('div');
          lastSeenElement.className = 'device-last-seen';
          lastSeenElement.textContent = `Last seen: ${formatLastSeen(deviceInfo.last_seen)}`;

          // Kiểm tra nếu đã có last seen thì cập nhật, không thì thêm mới
          const existingLastSeen = document.querySelector('.device-last-seen');
          if (existingLastSeen) {
            existingLastSeen.textContent = lastSeenElement.textContent;
          } else {
            document.querySelector('.device-info').appendChild(lastSeenElement);
          }
        }

        // Kiểm tra trạng thái kết nối
        const statusRes = await fetch(`/check_device_status?device_id=${deviceInfo.device_id}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const isOnline = statusData.online;

          // Cập nhật giao diện
          const statusIndicator = document.querySelector('.status-indicator');
          const statusText = document.getElementById('deviceStatusText');
          const toggle = document.getElementById('deviceToggle');

          statusIndicator.className = 'status-indicator ' + (isOnline ? 'online' : 'offline');
          statusText.textContent = isOnline ? 'Connected' : 'Disconnected';
          statusText.style.color = isOnline ? '#2ecc71' : '#e74c3c';
          toggle.checked = isOnline;
        }
      }
    } else {
      const errorData = await response.json();
      handleApiError(errorData);
    }
  } catch (error) {
    console.error("Error updating connection tab:", error);
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.getElementById('deviceStatusText');

    statusIndicator.className = 'status-indicator offline';
    statusText.textContent = 'Mất kết nối';
    statusText.style.color = '#e74c3c';
  }
}

// Hàm định dạng last seen
function formatLastSeen(isoTimestamp) {
  const lastSeenDate = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now - lastSeenDate;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

  // Fallback to full date
  return lastSeenDate.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}


// Hàm cập nhật giao diện trạng thái thiết bị
function updateDeviceStatusUI(isOnline) {
  if (deviceToggle && deviceStatus) {
    // Chỉ cập nhật trạng thái, không cho phép tương tác
    deviceToggle.checked = isOnline;
    deviceStatus.textContent = isOnline ? 'Đang kết nối' : 'Mất kết nối';
    deviceStatus.style.color = isOnline ? '#4CAF50' : '#f44336';

    // Thêm style để làm rõ toggle không thể tương tác
    const slider = document.querySelector('.slider');
    if (slider) {
      slider.style.cursor = 'not-allowed';
      slider.style.opacity = '0.7';
    }
  }
}
const homeView = document.getElementById('home');
const templateDetailView = document.getElementById('template-detail');
const detailContent = document.getElementById('template-detail-content');

function renderButtons(filterText = '') {
  buttonContainer.innerHTML = '';

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(filterText.toLowerCase())
  );

  if (filtered.length === 0) {
    buttonContainer.innerHTML = '<p>No templates found.</p>';
    return;
  }

  filtered.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'template-button';
    btn.innerHTML = `
      <div>${t.name}</div>
      <div class="description">${t.description}</div>
    `;

    btn.onclick = async () => {
      homeView.style.display = 'none';
      templateDetailView.style.display = 'block';
      document.getElementById('sidebar').classList.add('disabled-tabs');
      // Hiện loading trong khi chờ tải form
      detailContent.innerHTML = `<p>Đang tải...</p>`;

      try {
        const response = await fetch('/static/form.html');
        if (response.ok) {
          const html = await response.text();
          detailContent.innerHTML = `
        <div class="form-header">
    <div class="left-header">
      <img src="/static/images/Logo-TA.png" alt="Logo" class="logo">
    </div>
    <div class="right-header">
      <button id="back-to-home" class="back-button">← Quay lại</button>
    </div>
  </div>

        <div class="form-container">${html}</div>
      `;
          document.getElementById('interfaceInput').value = t.name;
          document.getElementById('interfaceDisplay').textContent = t.name;
          console.log(t.name.toLowerCase)
          const script = document.createElement('script');
          script.src = '/static/js/form-script.js';
          script.onload = () => {
            // Sau khi script load, gắn sự kiện
            const addInitBtn = document.getElementById('addInitRowBtn');
            if (addInitBtn) addInitBtn.addEventListener('click', addInitRow);

            const addFieldBtn = document.getElementById('addFieldRowBtn');
            if (addFieldBtn) addFieldBtn.addEventListener('click', addFieldRow);
            if (typeof initFormEvents === 'function') initFormEvents();
          };
          document.body.appendChild(script);
        } else {
          detailContent.innerHTML = `
        <div class="form-header">
    <div class="left-header">
      <img src="/static/images/Logo-TA.png" alt="Logo" class="logo">
    </div>
    <div class="right-header">
      <button id="back-to-home" class="back-button">← Quay lại</button>
    </div>
  </div>

        <p>Lỗi khi tải nội dung form. Vui lòng thử lại.</p>
      `;
        }
      } catch (err) {
        console.error("Lỗi khi tải form-content.html:", err);
        detailContent.innerHTML = `
     <div class="form-header">
    <div class="left-header">
      <img src="/static/images/Logo-TA.png" alt="Logo" class="logo">
    </div>
    <div class="right-header">
      <button id="back-to-home" class="back-button">← Quay lại</button>
    </div>
  </div>
      <p>Không thể tải nội dung form.</p>
    `;
      }

      // Gắn sự kiện quay lại sau khi nội dung được render
      const backBtn = document.getElementById('back-to-home');
      if (backBtn) {
        backBtn.onclick = () => {
          location.reload();

        };
      }
    };

    buttonContainer.appendChild(btn);
  });
}

function filterButtons() {
  const keyword = document.getElementById('searchInput').value;
  renderButtons(keyword);
}

function showToast(type, title, text) {
  Swal.fire({
    icon: type,
    title: title,
    text: text,
    timer: 1000,
    timerProgressBar: true,
    showConfirmButton: false
  });
}

function showLoading(show) {
  document.getElementById("loading-overlay").style.display = show ? "flex" : "none";
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
}

function updateUserInfoDisplays() {
  document.getElementById("username-display").textContent = currentUser.username;
  document.getElementById("profile-username-display").textContent = currentUser.username;
  document.getElementById("account-username-display").textContent = currentUser.username;
  document.getElementById("profile-name-display").textContent = currentUser.name;
  document.getElementById("account-name-display").textContent = currentUser.name;
  document.getElementById("profile-email-display").textContent = currentUser.email;
  document.getElementById("account-email-display").textContent = currentUser.email;
  document.getElementById("account-device-display").textContent = currentUser.device_id;

  // Cập nhật tên thiết bị trong tab connection
  if (deviceName && currentUser.device_id) {
    deviceName.textContent = `Device: ${currentUser.device_id}`;
  }
}
async function fetchUserInfo() {
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    showToast("error", "Missing Token", "Please log in again.");
    window.location.href = "/";
    return;
  }

  const payload = parseJwt(token);

  if (!payload || !payload.device_id) {
    showToast("error", "Invalid Token", "Token format is invalid. Please log in again.");
    localStorage.removeItem("jwt_token");
    updateStatusDot(false);
    window.location.href = "/";
    return;
  }

  deviceIdGlobal = payload.device_id;
  console.log("Parsed payload:", payload);
  console.log("deviceIdGlobal:", deviceIdGlobal);

  try {
    const initialStatusRes = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
    if (initialStatusRes.ok) {
      const initialStatusData = await initialStatusRes.json();
      updateStatusDot(initialStatusData.online);
      updateDeviceStatusUI(initialStatusData.online);
    }
  } catch (err) {
    console.error("Initial status check failed:", err);
    updateStatusDot(false);
    updateConnectionTab();
  }

  try {
    const response = await fetch("/user_info", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await response.json();

    if (response.status === 200) {
      currentUser = {
        username: data.username || 'N/A',
        name: data.name || 'N/A',
        email: data.email || 'N/A',
        device_id: data.device_id || 'N/A'
      };

      updateUserInfoDisplays();
      await updateConnectionTab();
      startDeviceStatusMonitoring(); // Bắt đầu kiểm tra trạng thái sau khi có thông tin user

    } else {
      handleApiError(data);
      localStorage.removeItem("jwt_token");
      updateStatusDot(false);
      window.location.href = "/";
    }
  } catch (err) {
    console.error("Error fetching user info:", err);
    updateStatusDot(false);
    showToast("error", "Network Error", "Unable to fetch user info.");
  }
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    window.location.href = "/";
    return;
  }

  try {
    const response = await fetch("/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.removeItem("jwt_token");
      window.location.href = "/";
    } else {
      handleApiError(data);
    }
  } catch (error) {
    console.error("Logout error:", error);
    showToast("error", "Logout Failed", "An error occurred during logout.");
  }
});

function updateStatusDot(isOnline) {
  const statusDots = document.querySelectorAll('.status-dot');

  statusDots.forEach(dot => {
    dot.classList.remove('online', 'offline');
    dot.classList.add(isOnline ? 'online' : 'offline');
  });
}
async function attemptReconnectWithRetry() {
  reconnectAttempts = 0;
  updateStatusDot(false);
  updateDeviceStatusUI(false);
  clearTimers();

  let resolveChoice;
  const choicePromise = new Promise(resolve => (resolveChoice = resolve));

  const popup = Swal.fire({
    icon: "warning",
    title: "Mất kết nối thiết bị",
    text: "Thiết bị Raspberry Pi đang ngoại tuyến. Bạn muốn làm gì?",
    showCancelButton: true,
    confirmButtonText: "Reconnect",
    cancelButtonText: "Logout",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      reconnectTimer = setTimeout(() => {
        Swal.close(); // Tự đóng sau 20s
        resolveChoice('timeout');
      }, 20000);
    },
    preConfirm: () => {
      clearTimeout(reconnectTimer);
      resolveChoice('reconnect');
    },
    preDeny: () => {
      clearTimeout(reconnectTimer);
      resolveChoice('logout');
    }
  });

  const choice = await choicePromise;

  if (choice === 'timeout' || choice === 'reconnect') {
    handleRetryOrFail();
  } else if (choice === 'logout') {
    await logoutUser();
  }
}


function resetDeviceMonitor() {
  reconnectAttempts = 0;
  isReconnecting = false; // reset flag
  clearTimers();
  startDeviceStatusMonitoring();
}

async function handleRetryOrFail() {
  reconnectAttempts++;
  showLoading(true);

  await new Promise(res => setTimeout(res, 5000)); // loading xoay 5s

  try {
    const res = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
    const data = await res.json();
    showLoading(false);

    if (res.ok && data.online) {
      updateStatusDot(true);
      updateDeviceStatusUI(true);

      await Swal.fire({
        icon: 'success',
        title: 'Kết nối lại thành công',
        text: 'Thiết bị đã được kết nối lại.'
      });

      resetDeviceMonitor(); // Reset lại trạng thái
      return;
    } else {
      // Retry tiếp nếu chưa đủ số lần
      if (reconnectAttempts < 5) {
        setTimeout(() => attemptReconnectWithRetry(), 100);
      } else {
        showSystemErrorAndLogout();
      }
    }
  } catch (e) {
    showLoading(false);
    if (reconnectAttempts < 5) {
      setTimeout(() => attemptReconnectWithRetry(), 100);
    } else {
      showSystemErrorAndLogout();
    }
  }
}

function showSystemErrorAndLogout() {
  Swal.fire({
    icon: 'error',
    title: 'Lỗi hệ thống',
    text: 'Không thể kết nối lại sau 5 lần thử. Hệ thống sẽ đăng xuất.',
    confirmButtonText: 'OK'
  }).then(() => {
    logoutUser();
  });
}

function clearTimers() {
  clearTimeout(reconnectTimer);
  clearTimeout(autoReconnectTimer);
}

async function logoutUser() {
  isReconnecting = false;
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    window.location.href = "/";
    return;
  }

  try {
    await fetch("/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      }
    });
  } catch (e) {
    console.error("Logout error:", e);
  }

  localStorage.removeItem("jwt_token");
  updateStatusDot(false);
  updateDeviceStatusUI(false);
  stopDeviceStatusMonitoring();
  window.location.href = "/";
}

function handleApiError(data) {
  const code = data?.code;
  const message = data?.message || "Unknown error";

  switch (code) {
    case 1203: // MISSING_TOKEN
      showToast("error", "Missing Token", message);
      break;
    case 1208: // INVALID_TOKEN_FORMAT
      showToast("error", "Invalid Token Format", message);
      break;
    case 1205: // TOKEN_EXPIRED
      showToast("error", "Token Expired", message);
      break;
    case 1204: // INVALID_TOKEN
      showToast("error", "Invalid Token", message);
      break;
    case 1206: // USER_NOT_FOUND
      showToast("error", "User Not Found", message);
      break;
    case 1201: // INTERNAL_ERROR
      showToast("error", "Server Error", message);
      break;
    case 1204: // MISSING_DEVICE_ID
      showToast("error", "Missing Device ID", message);
      break;
    case 1005: // DEVICE_ID_NOT_FOUND
      showToast("error", "Device ID not found")
      break;
    default:
      showToast("error", "Error", message);
  }
}

// Xử lý reset password
document.getElementById('resetPasswordBtn').addEventListener('click', function () {
  Swal.fire({
    title: 'Change Password',
    html: `
                <input type="password" id="oldPassword" class="swal2-input" placeholder="Old Password">
                <input type="password" id="newPassword" class="swal2-input" placeholder="New Password">
                <label style="display:flex;align-items:center;justify-content:center;margin-top:5px;">
                    <input type="checkbox" id="showPasswordToggle" style="margin-right:5px;"> Show Passwords
                </label>
            `,
    confirmButtonText: 'Change',
    showCancelButton: true,
    focusConfirm: false,
    didOpen: () => {
      document.getElementById('showPasswordToggle').addEventListener('change', function () {
        const oldInput = document.getElementById('oldPassword');
        const newInput = document.getElementById('newPassword');
        const type = this.checked ? 'text' : 'password';
        oldInput.type = type;
        newInput.type = type;
      });
    },
    preConfirm: () => {
      const oldPass = document.getElementById('oldPassword').value;
      const newPass = document.getElementById('newPassword').value;

      if (!oldPass || !newPass) {
        Swal.showValidationMessage('Please fill in both fields');
        return false;
      }

      return fetch('/change_password', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
        },
        body: new URLSearchParams({
          old_password: oldPass,
          new_password: newPass
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.code === 0) {
            return data;
          } else {
            throw new Error(data.message);
          }
        })
        .catch(error => {
          Swal.showValidationMessage(`Request failed: ${error.message}`);
        });
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      Swal.fire('Success', 'Password changed successfully!', 'success');
    }
  });
});

// Khởi động ứng dụng
document.addEventListener('DOMContentLoaded', function () {
  fetchUserInfo();
  renderButtons();
});