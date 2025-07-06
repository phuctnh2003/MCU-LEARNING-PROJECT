clearUsernameOnLoad();

function clearUsernameOnLoad() {
    sessionStorage.removeItem('username');
}

document.getElementById('show-password').addEventListener('change', function () {
    const passwordField = document.getElementById('login-password');
    passwordField.type = this.checked ? 'text' : 'password';
});

document.getElementById('show-signup-password').addEventListener('change', function () {
    const passwordField = document.getElementById('signup-password');
    passwordField.type = this.checked ? 'text' : 'password';
});

const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');

loginBtn.addEventListener('click', (e) => {
    let parent = e.target.closest('.form-structor');
    parent.querySelector('.signup').classList.add('slide-up');
    parent.querySelector('.login').classList.remove('slide-up');
    resetSignupForm();
});

signupBtn.addEventListener('click', (e) => {
    let parent = e.target.closest('.form-structor');
    parent.querySelector('.login').classList.add('slide-up');
    parent.querySelector('.signup').classList.remove('slide-up');
    resetLoginForm();
});

// Đăng ký
document.getElementById('signup-btn').addEventListener('click', async () => {
    const username = document.getElementById('signup-username').value.trim();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!username || !name || !email || !password) {
        showToast("error", "Error", "Please fill in all fields.");
        return;
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, name, email, password }),
    });

    const data = await response.json();

    switch (data.code) {
        case 0: // SUCCESS
            showToast("success", "Success", "Sign up successful!");
            resetSignupForm();
            loginBtn.click();
            break;
        case 1001: // USERNAME_EXISTS
            showToast("error", "Error", "Username already exists.");
            break;
        case 1002: // INVALID_PASSWORD
            showToast("error", "Error", "Password must contain uppercase, lowercase, number, special character, min 4 characters.");
            break;
        case 1003: // EMAIL_EXISTS
            showToast("error", "Error", "Email already exists.");
            break;
        default:
            showToast("error", "Error", "Sign up failed, please try again.");
    }
});

// Đăng nhập
document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showToast("error", "Error", "Please enter username and password.");
        return;
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
    });

    const data = await response.json();

    switch (data.code) {
        case 0: // SUCCESS
            localStorage.setItem("jwt_token", data.token);
            resetLoginForm();
            showToast("success", "Success", "Login successful!");
            setTimeout(() => {
                window.location.href = "index";
            }, 2000);
            break;
        case 1201: // INVALID_CREDENTIALS
            showToast("error", "Error", "Invalid username or password.");
            break;
        case 2001: // NO_DEVICE_ONLINE
            showToast("error", "Error", "No Raspberry Pi is online.");
            break;
        case 2002: // DEVICE_ASSIGNED_TO_OTHER
            showToast("error", "Error", "Device is assigned to another user.");
            break;
        case 2003: // DEVICE_MISMATCH
            showToast("error", "Error", "Device mismatch.");
            break;
        default:
            showToast("error", "Error", "Login failed, please try again.");
    }
});

// Modal quên mật khẩu
document.getElementById("show-forget-password-form").addEventListener("click", function (e) {
    e.preventDefault();
    resetForgetPasswordModal();
    document.getElementById("forget-password-modal").style.display = "block";
    document.getElementById("modal-backdrop").style.display = "block";
});

document.getElementById("modal-close-btn").addEventListener("click", function () {
    resetForgetPasswordModal();
    document.getElementById("forget-password-modal").style.display = "none";
    document.getElementById("modal-backdrop").style.display = "none";
});

document.getElementById('show-old-password').addEventListener('change', function () {
    const oldPasswordField = document.getElementById('modal-forget-old-password');
    oldPasswordField.type = this.checked ? 'text' : 'password';
});

document.getElementById('show-new-password').addEventListener('change', function () {
    const newPasswordField = document.getElementById('modal-forget-new-password');
    newPasswordField.type = this.checked ? 'text' : 'password';
});

document.getElementById("modal-forget-btn").addEventListener("click", async () => {
    const email = document.getElementById("modal-forget-email").value;
    const oldPassword = document.getElementById("modal-forget-old-password").value;
    const newPassword = document.getElementById("modal-forget-new-password").value;

    if (!email || !oldPassword || !newPassword) {
        showToast("error", "Error", "Please fill in all fields.");
        return;
    }

    const response = await fetch("/forget_password", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, old_password: oldPassword, new_password: newPassword })
    });

    const data = await response.json();

    switch (data.code) {
        case 0: // SUCCESS
            showToast("success", "Success", "Password changed successfully.");
            setTimeout(() => {
                resetForgetPasswordModal();
                document.getElementById("forget-password-modal").style.display = "none";
                document.getElementById("modal-backdrop").style.display = "none";
            }, 2000);
            break;
        case 1202: // SAME_PASSWORD
            showToast("error", "Error", "New password cannot be the same as old password.");
            break;
        case 1207: // INVALID_OLD_PASSWORD
            showToast("error", "Error", "Invalid old password.");
            break;
        case 1002: // INVALID_PASSWORD
            showToast("error", "Error", "Invalid password format.");
            break;
        case 1003: // INVALID_CREDENTIALS
            showToast("error", "Error", "Old password is incorrect.");
            break;
        default:
            showToast("error", "Error", "Something went wrong.");
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
            window.location.href = "index";
        } else {
            localStorage.removeItem("jwt_token");
        }
    }
};

function resetLoginForm() {
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('show-password').checked = false;
    document.getElementById('login-password').type = 'password';
}

function resetSignupForm() {
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('show-signup-password').checked = false;
    document.getElementById('signup-password').type = 'password';
}

function resetForgetPasswordModal() {
    document.getElementById("modal-forget-email").value = "";
    document.getElementById("modal-forget-old-password").value = "";
    document.getElementById("modal-forget-new-password").value = "";
    document.getElementById("show-old-password").checked = false;
    document.getElementById("show-new-password").checked = false;
    document.getElementById("modal-forget-old-password").type = "password";
    document.getElementById("modal-forget-new-password").type = "password";
}

// Hàm show Swal với timer
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
