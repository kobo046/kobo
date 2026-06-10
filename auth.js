let authSession = null;
let currentRole = "viewer";
let authClient = null;

function getAuthConfig() {
  return window.BADMINTON_SUPABASE_CONFIG || {};
}

function getAuthClient() {
  const config = getAuthConfig();
  if (!config.url || !config.anonKey || !window.supabase || !window.supabase.createClient) return null;
  if (window.cloudSync && window.cloudSync.getClient) {
    const sharedClient = window.cloudSync.getClient();
    if (sharedClient) return sharedClient;
  }
  if (!authClient) {
    authClient = window.supabase.createClient(config.url, config.anonKey);
  }
  return authClient;
}

function authClubId() {
  return window.cloudSync && window.cloudSync.clubId ? window.cloudSync.clubId() : getAuthConfig().clubId || "default";
}

function currentAccessToken() {
  return authSession && authSession.access_token ? authSession.access_token : "";
}

function isEditor() {
  return currentRole === "admin" || currentRole === "editor";
}

function readableRole() {
  if (currentRole === "admin") return "管理員";
  if (currentRole === "editor") return "可編輯";
  return "只讀";
}

function authRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
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

  const emailInput = byId("adminEmail");
  const loginButton = byId("loginButton");
  const logoutButton = byId("logoutButton");

  if (emailInput) {
    emailInput.disabled = Boolean(authSession);
    if (authSession && authSession.user && authSession.user.email) {
      emailInput.value = authSession.user.email;
    }
  }

  if (loginButton) loginButton.classList.toggle("hidden", Boolean(authSession));
  if (logoutButton) logoutButton.classList.toggle("hidden", !authSession);

  if (message) {
    setAuthStatus(message, isError);
    return;
  }

  if (!authSession) {
    setAuthStatus("目前是只讀模式。管理員可輸入 Email 登入。");
    return;
  }

  const email = authSession.user && authSession.user.email ? authSession.user.email : "已登入帳戶";
  if (isEditor()) {
    setAuthStatus(`${email} 已登入，權限：${readableRole()}。`);
  } else {
    setAuthStatus(`${email} 已登入，但未有管理員權限，只可查看資料。`, true);
  }
}

async function refreshAuthRole() {
  currentRole = "viewer";
  if (!authSession || !authSession.user) return currentRole;

  const client = getAuthClient();
  if (!client) return currentRole;

  const { data, error } = await client
    .from("badminton_club_members")
    .select("role")
    .eq("club_id", authClubId())
    .eq("user_id", authSession.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load badminton member role", error);
    return currentRole;
  }

  if (data && ["admin", "editor", "viewer"].includes(data.role)) {
    currentRole = data.role;
  }
  return currentRole;
}

async function refreshAuthState(nextSession) {
  authSession = nextSession || null;
  await refreshAuthRole();
  updateAuthUi();
  renderAll();
}

async function initializeAuth() {
  const client = getAuthClient();
  if (!client) {
    currentRole = "viewer";
    updateAuthUi("未設定 Supabase Auth，網站目前只可查看本機資料。", true);
    return;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    console.warn("Unable to load auth session", error);
  }
  authSession = data && data.session ? data.session : null;
  await refreshAuthRole();
  updateAuthUi();

  client.auth.onAuthStateChange(async (_event, session) => {
    await refreshAuthState(session);
  });
}

async function handleLoginClick(event) {
  if (event) event.preventDefault();

  const client = getAuthClient();
  if (!client) {
    updateAuthUi("Supabase Auth 未設定好，暫時不能登入。", true);
    return false;
  }

  const emailInput = byId("adminEmail");
  const email = emailInput ? emailInput.value.trim() : "";
  if (!email) {
    updateAuthUi("請先輸入管理員 Email。", true);
    return false;
  }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: authRedirectUrl()
    }
  });

  if (error) {
    updateAuthUi(`登入連結寄出失敗：${error.message}`, true);
    return false;
  }

  updateAuthUi(`已寄出登入連結到 ${email}，請到 Email 按連結登入。`);
  return false;
}

async function handleLogoutClick(event) {
  if (event) event.preventDefault();
  const client = getAuthClient();
  if (client) await client.auth.signOut();
  authSession = null;
  currentRole = "viewer";
  updateAuthUi("已登出，現在是只讀模式。");
  return false;
}

function requireEditorAction(actionName) {
  if (isEditor()) return true;
  const message = `只有管理員可以${actionName}。請先用管理員 Email 登入。`;
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
