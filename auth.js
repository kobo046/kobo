const adminAccessKey = "badmintonAdminAccess.v1";
const adminPasscode = "95510265";
let currentRole = "viewer";

function currentAccessToken() {
  return "";
}

function isEditor() {
  return currentRole === "admin";
}

function setAuthStatus(message, isError = false) {
  const status = byId("authStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateAuthUi(message, isError = false) {
  document.body.classList.toggle("editor-mode", isEditor());
  document.body.classList.toggle("viewer-mode", !isEditor());

  const passcodeInput = byId("adminPasscode");
  const loginButton = byId("loginButton");
  const logoutButton = byId("logoutButton");

  if (passcodeInput) {
    passcodeInput.disabled = isEditor();
    if (isEditor()) passcodeInput.value = "";
  }

  if (loginButton) loginButton.classList.toggle("hidden", isEditor());
  if (logoutButton) logoutButton.classList.toggle("hidden", !isEditor());

  if (message) {
    setAuthStatus(message, isError);
    return;
  }

  setAuthStatus(isEditor() ? "管理員模式已開啟，可以新增、編輯和刪除資料。" : "目前是只讀模式。輸入管理員密碼可解鎖修改功能。");
}

async function initializeAuth() {
  currentRole = localStorage.getItem(adminAccessKey) === "unlocked" ? "admin" : "viewer";
  updateAuthUi();
}

async function handleLoginClick(event) {
  if (event) event.preventDefault();

  const passcodeInput = byId("adminPasscode");
  const passcode = passcodeInput ? passcodeInput.value.trim() : "";

  if (passcode !== adminPasscode) {
    updateAuthUi("密碼不正確，仍然是只讀模式。", true);
    return false;
  }

  localStorage.setItem(adminAccessKey, "unlocked");
  currentRole = "admin";
  updateAuthUi("管理員模式已開啟。");
  setStatus("管理員模式已開啟，可以修改資料。");
  renderAll();
  return false;
}

async function handleLogoutClick(event) {
  if (event) event.preventDefault();
  localStorage.removeItem(adminAccessKey);
  currentRole = "viewer";
  updateAuthUi("已退出管理員模式，現在只可查看資料。");
  renderAll();
  return false;
}

function requireEditorAction(actionName) {
  if (isEditor()) return true;
  const message = `只有管理員可以${actionName}。請先輸入管理員密碼。`;
  updateAuthUi(message, true);
  setStatus(message, true);
  return false;
}

window.currentAccessToken = currentAccessToken;
window.isEditor = isEditor;
window.initializeAuth = initializeAuth;
window.updateAuthUi = updateAuthUi;
window.requireEditorAction = requireEditorAction;
window.handleLoginClick = handleLoginClick;
window.handleLogoutClick = handleLogoutClick;
