let deviceIdGlobal = null;
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
  { name: 'I2C', description: 'Giao tiếp I2C cơ bản' },
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
  if (!deviceIdGlobal) return;

  // Cập nhật thông tin thiết bị
  document.getElementById('deviceIdDisplay').textContent = deviceIdGlobal;
  document.getElementById('deviceName').textContent = currentUser.device_id || 'Raspberry Pi';

  try {
    // Gọi API kiểm tra trạng thái
    const res = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
    if (res.ok) {
      const data = await res.json();
      const isOnline = data.online;

      // Cập nhật giao diện
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.getElementById('deviceStatusText');
      const toggle = document.getElementById('deviceToggle');

      statusIndicator.className = 'status-indicator ' + (isOnline ? 'online' : 'offline');
      statusText.textContent = isOnline ? 'Connected' : 'Disconnected';
      statusText.style.color = isOnline ? '#2ecc71' : '#e74c3c';
      toggle.checked = isOnline;
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
    btn.onclick = () => alert('Bạn đã chọn: ' + t.name);
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
    timer: 2000,
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


// async function tryReconnect() {
//   showLoading(true);
//   await new Promise(resolve => setTimeout(resolve, 3000));

//   try {
//     const response = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
//     showLoading(false);

//     if (response.ok) {
//       const data = await response.json();
//       updateStatusDot(data.online);
//       updateDeviceStatusUI(data.online);

//       if (data.online) {
//         showToast("success", "Reconnected", "Raspberry Pi is back online.");
//         resetDeviceMonitor(); // Reset timer & interval nếu cần
//         return false; // Không cần retry nữa
//       } else {
//         return true; // Chưa online → cần retry
//       }
//     } else {
//       return true; // Response lỗi → retry
//     }
//   } catch (error) {
//     console.error("Reconnect failed:", error);
//     showLoading(false);
//     return true; // Exception → retry
//   }
// }

// function startAutoReconnect() {
//   autoReconnectTimer = setTimeout(async () => {
//     const shouldRetry = await tryReconnect();
//     if (shouldRetry) {
//       handleRetryOrFail();
//     }
//   }, 20000);
// }

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

// async function attemptReconnect() {
//   updateStatusDot(false);
//   updateDeviceStatusUI(false);

//   const confirmReconnect = await Swal.fire({
//     icon: "warning",
//     title: "Device Offline",
//     text: "Raspberry Pi is currently offline. Do you want to retry?",
//     showCancelButton: true,
//     confirmButtonText: "Reconnect",
//     cancelButtonText: "Logout"
//   });

//   if (!confirmReconnect.isConfirmed) {
//     await logoutUser();
//     return;
//   }

//   showLoading(true);
//   await new Promise(resolve => setTimeout(resolve, 5000));

//   try {
//     const reconnectRes = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
//     showLoading(false);
//     if (reconnectRes.ok) {
//       const reconnectData = await reconnectRes.json();
//       updateStatusDot(reconnectData.online);
//       updateDeviceStatusUI(reconnectData.online);

//       if (reconnectData.online) {
//         showToast("success", "Reconnected", "Raspberry Pi is back online.");
//       } else {
//         await attemptReconnect();
//       }
//     } else {
//       await attemptReconnect();
//     }
//   } catch (e) {
//     console.error("Reconnect failed:", e);
//     showLoading(false);
//     await attemptReconnect();
//   }
// }

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
