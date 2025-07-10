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
        showToast("error", "Lỗi", "Vui lòng điền đầy đủ các trường.");
        return;
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, name, email, password }),
    });

    const data = await response.json();

    switch (data.code) {
        case 0:
            showToast("success", "Thành công", "Đăng ký thành công");
            resetSignupForm();
            loginBtn.click();
            break;
        case 1002:
            showToast("error", "Lỗi", "Tên người dùng đã tồn tại");
            break;
        case 1206:
            showToast("error", "Lỗi", "Mật khẩu phải có chữ hoa, chữ thường, số, ký tự đặc biệt, tối thiểu 4 ký tự");
            break;
        case 1003:
            showToast("error", "Lỗi", "Email đã tồn tại");
            break;
        default:
            showToast("error", "Lỗi", "Đăng ký thất bại, vui lòng thử lại");
    }
});

// Đăng nhập
document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showToast("error", "Lỗi", "Vui lòng nhập tên đăng nhập và mật khẩu");
        return;
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
    });

    const data = await response.json();

    switch (data.code) {
        case 0:
            localStorage.setItem("jwt_token", data.token);
            resetLoginForm();
            showToast("success", "Thành công", "Đăng nhập thành công!");
            setTimeout(() => {
                window.location.href = "index";
            }, 2000);
            break;
        case 1201:
            showToast("error", "Lỗi", "Tên đăng nhập hoặc mật khẩu không đúng");
            break;
        case 2001:
            showToast("error", "Lỗi", "Không có thiết bị nào đang hoạt động");
            break;
        case 2002:
            showToast("error", "Lỗi", "Thiết bị đang được người khác sử dụng");
            break;
        case 2003:
            showToast("error", "Lỗi", "Thiết bị không khớp");
            break;
        default:
            showToast("error", "Lỗi", "Đăng nhập thất bại, vui lòng thử lại");
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
        showToast("error", "Lỗi", "Vui lòng điền đầy đủ các trường");
        return;
    }

    const response = await fetch("/forget_password", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, old_password: oldPassword, new_password: newPassword })
    });

    const data = await response.json();

    switch (data.code) {
        case 0:
            showToast("success", "Thành công", "Đổi mật khẩu thành công");
            setTimeout(() => {
                resetForgetPasswordModal();
                document.getElementById("forget-password-modal").style.display = "none";
                document.getElementById("modal-backdrop").style.display = "none";
            }, 1000);
            break;
        case 1202:
            showToast("error", "Lỗi", "Mật khẩu mới không được trùng với mật khẩu cũ");
            break;
        case 1207:
            showToast("error", "Lỗi", "Mật khẩu cũ không chính xác");
            break;
        case 1206:
            showToast("error", "Lỗi", "Định dạng mật khẩu không hợp lệ");
            break;
        case 1201:
            showToast("error", "Lỗi", "Thông tin đăng nhập không hợp lệ");
            break;
        default:
            showToast("error", "Lỗi", "Đã xảy ra lỗi");
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

// Hàm hiển thị thông báo ngắn
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
