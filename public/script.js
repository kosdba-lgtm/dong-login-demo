const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const authForm = document.getElementById("authForm");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const messageEl = document.getElementById("message");

let mode = "login";

const setMode = (newMode) => {
  mode = newMode;
  loginTab.classList.toggle("active", mode === "login");
  signupTab.classList.toggle("active", mode === "signup");
  nameInput.parentElement.style.display = mode === "signup" ? "grid" : "none";
  messageEl.textContent = "";
  messageEl.className = "message";
};

const showMessage = (text, success = false) => {
  messageEl.textContent = text;
  messageEl.className = `message ${success ? "success" : ""}`;
};

const submitAuth = async () => {
  const path = mode === "login" ? "/api/login" : "/api/signup";
  const payload = {
    email: emailInput.value,
    password: passwordInput.value,
    name: nameInput.value,
  };

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.success) {
      showMessage(data.message || "오류가 발생했습니다.");
      return;
    }

    showMessage(`${mode === "login" ? "로그인" : "회원가입"} 성공: ${data.user.name}`, true);
    if (mode === "signup") {
      setMode("login");
    }
  } catch (error) {
    console.error(error);
    showMessage("서버 요청에 실패했습니다.");
  }
};

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth();
});

setMode("login");
