    let deviceIdGlobal = null;
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
      window.location.href = "/";
      return;
    }

    deviceIdGlobal = payload.device_id;
    checkDeviceStatusPeriodically();

    try {
      const response = await fetch("/user_info", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await response.json();

      if (response.status === 200) {
        document.getElementById("username").textContent = data.username;
        document.getElementById("email").textContent = data.email;
        document.getElementById("name").textContent = data.name;
      } else {
        handleApiError(data);
        localStorage.removeItem("jwt_token");
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
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

  async function checkDeviceStatusPeriodically() {
    const token = localStorage.getItem("jwt_token");
    if (!token || !deviceIdGlobal) return;

    try {
      const res = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.online) {
          await attemptReconnect();
        } else {
          console.log("Device is online.");
        }
      }
    } catch (err) {
      console.error("Error checking device status:", err);
    }

    setTimeout(checkDeviceStatusPeriodically, 30000);
  }

  async function attemptReconnect() {
    const confirmReconnect = await Swal.fire({
      icon: "warning",
      title: "Device Offline",
      text: "Raspberry Pi is currently offline. Do you want to retry?",
      showCancelButton: true,
      confirmButtonText: "Reconnect",
      cancelButtonText: "Logout"
    });

    if (!confirmReconnect.isConfirmed) {
      await logoutUser();
      return;
    }

    showLoading(true);
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5s

    try {
      const reconnectRes = await fetch(`/check_device_status?device_id=${deviceIdGlobal}`);
      showLoading(false);
      if (reconnectRes.ok) {
        const reconnectData = await reconnectRes.json();
        if (reconnectData.online) {
          showToast("success", "Reconnected", "Raspberry Pi is back online.");
          setTimeout(() => location.reload(), 1500);
        } else {
          await attemptReconnect();
        }
      } else {
        await attemptReconnect();
      }
    } catch (e) {
      console.error("Reconnect failed:", e);
      showLoading(false);
      await attemptReconnect();
    }
  }

  async function logoutUser() {
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
    window.location.href = "/";
  }

  function handleApiError(data) {
    const code = data?.code;
    const message = data?.message || "Unknown error";

    switch (code) {
      case 1001: // MISSING_TOKEN
        showToast("error", "Missing Token", message);
        break;
      case 1002: // INVALID_TOKEN_FORMAT
        showToast("error", "Invalid Token Format", message);
        break;
      case 1003: // TOKEN_EXPIRED
        showToast("error", "Token Expired", message);
        break;
      case 1004: // INVALID_TOKEN
        showToast("error", "Invalid Token", message);
        break;
      case 1005: // USER_NOT_FOUND
        showToast("error", "User Not Found", message);
        break;
      case 1006: // INTERNAL_ERROR
        showToast("error", "Server Error", message);
        break;
      case 1007: // MISSING_DEVICE_ID
        showToast("error", "Missing Device ID", message);
        break;
      default:
        showToast("error", "Error", message);
    }
  }

  fetchUserInfo();
