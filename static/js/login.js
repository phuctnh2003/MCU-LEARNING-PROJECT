clearUsernameOnLoad();

function clearUsernameOnLoad() {
    sessionStorage.removeItem('username');
}

// Hiện/ẩn mật khẩu
document.getElementById('show-password').addEventListener('change', function () {
    const passwordField = document.getElementById('login-password');
    passwordField.type = this.checked ? 'text' : 'password';
});

document.getElementById('show-signup-password').addEventListener('change', function () {
    const passwordField = document.getElementById('signup-password');
    passwordField.type = this.checked ? 'text' : 'password';
});

// Chuyển form
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');

loginBtn.addEventListener('click', (e) => {
    let parent = e.target.closest('.form-structor');
    parent.querySelector('.signup').classList.add('slide-up');
    parent.querySelector('.login').classList.remove('slide-up');
});

signupBtn.addEventListener('click', (e) => {
    let parent = e.target.closest('.form-structor');
    parent.querySelector('.login').classList.add('slide-up');
    parent.querySelector('.signup').classList.remove('slide-up');
});

// Đăng ký
document.getElementById('signup-btn').addEventListener('click', async () => {
    const username = document.getElementById('signup-username').value.trim();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    const errorBox = document.getElementById("signup-error-message");

    if (!username || !name || !email || !password) {
        errorBox.innerText = "Please fill in all fields.";
        return;
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ username, name, email, password }),
    });

    const message = await response.text();
    const status = response.status;

    if (status === 200 && message === "200") {
        alert("Sign up successful!");
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
        errorBox.innerText = '';
        loginBtn.click();
    } else if (status === 400 && message.includes("Username already exists")) {
        errorBox.innerText = "Username already exists.";
    } else if (status === 400 && message.includes("Password")) {
        errorBox.innerText = "Password must contain uppercase, lowercase, number, special character, min 4 characters.";
    } else {
        errorBox.innerText = "Sign up failed, please try again.";
    }
});

// Đăng nhập
document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    const errorBox = document.getElementById("login-error-message");

    if (!username || !password) {
        errorBox.innerText = "Please enter username and password.";
        return;
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ username, password }),
    });

    const message = await response.text();
    const status = response.status;
    console.log("Response status:", status);  // Debugging line
  if (status === 200) {
    const data = JSON.parse(message);  // vì `message` là JSON string
    localStorage.setItem("jwt_token", data.token);
    window.location.href = "index";  // Chuyển hướng đến trang chính
  } else if (status === 401) {
      errorBox.innerText = "Invalid username or password.";
  } else {
      errorBox.innerText = "Login failed, please try again.";
  }
});

// Mở modal
  document.getElementById("show-forget-password-form").addEventListener("click", function (e) {
    e.preventDefault();
    document.getElementById("forget-password-modal").style.display = "block";
    document.getElementById("modal-backdrop").style.display = "block";
  });

  // Đóng modal
  document.getElementById("modal-close-btn").addEventListener("click", function () 
  {
    // Reset các ô input về rỗng
    document.getElementById("modal-forget-email").value = "";
    document.getElementById("modal-forget-old-password").value = "";
    document.getElementById("modal-forget-new-password").value = "";
    document.getElementById("forget-password-modal").style.display = "none";
    document.getElementById("modal-backdrop").style.display = "none";
    document.getElementById("modal-forget-error-message").textContent = "";
  });

// Hiện/ẩn mật khẩu trong modal "Forget Password"
document.getElementById('show-old-password').addEventListener('change', function () {
    const oldPasswordField = document.getElementById('modal-forget-old-password');
    oldPasswordField.type = this.checked ? 'text' : 'password';
});

document.getElementById('show-new-password').addEventListener('change', function () {
    const newPasswordField = document.getElementById('modal-forget-new-password');
    newPasswordField.type = this.checked ? 'text' : 'password';
});


  // Gửi yêu cầu reset mật khẩu từ modal
  document.getElementById("modal-forget-btn").addEventListener("click", async () => {
    const email = document.getElementById("modal-forget-email").value;
    const oldPassword = document.getElementById("modal-forget-old-password").value;
    const newPassword = document.getElementById("modal-forget-new-password").value;
    const msgEl = document.getElementById("modal-forget-error-message");
     // Reset form
    document.getElementById("modal-forget-email").value = "";
    document.getElementById("modal-forget-old-password").value = "";
    document.getElementById("modal-forget-new-password").value = "";
    document.getElementById("modal-forget-old-password").type = "password";
    document.getElementById("modal-forget-new-password").type = "password";

     if (!email || !oldPassword || !newPassword) {
        msgEl.style.color = "red";
        msgEl.textContent = "Please fill in all fields.";
        return; // DỪNG HÀM
    }

    // Ẩn form nếu cần
    document.getElementById("forget-password-modal").style.display = "none";

    // Xóa thông báo lỗi (nếu có)
    document.getElementById("modal-forget-error-message").innerText = "";


    const response = await fetch("/forget_password", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `email=${encodeURIComponent(email)}&old_password=${encodeURIComponent(oldPassword)}&new_password=${encodeURIComponent(newPassword)}`
    });

    if (response.status === 200) {
      msgEl.style.color = "green";
      msgEl.textContent = "Password changed successfully.";
    } else if (response.status === 400) {
        msgEl.style.color = "red";
      msgEl.textContent = "Invalid password format.";
    } else if (response.status === 404) {
        msgEl.style.color = "red";
      msgEl.textContent = "User not found.";
    } else {
        msgEl.style.color = "red";
      msgEl.textContent = "Something went wrong.";
    }
   
  });
// Kiểm tra token khi tải trang
window.onload = async () => {
    const token = localStorage.getItem("jwt_token");
    if (token) {
        const response = await fetch("/user_info", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 200) {
            // Token còn hợp lệ ⇒ chuyển đến trang chính
            window.location.href = "index";
        } else {
            // Token hết hạn hoặc không hợp lệ ⇒ xóa token
            sessionStorage.removeItem("jwt_token");
        }
    }
};
