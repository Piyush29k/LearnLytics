(function attachLearnLyticsAuth(window) {
  const SESSION_KEY = "learnlytics_session";
  const API_ROOT = "http://localhost:5000/api";

  function readSession() {
    try {
      const value = localStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function saveSession(payload) {
    const token = payload?.token;
    const user = payload?.user;

    if (!token || !user?.id) {
      throw new Error("Invalid login session");
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token,
        user,
        savedAt: new Date().toISOString(),
      })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    Object.keys(localStorage)
      .filter((key) => key === "learnlytics_ai_chat_history" || key.startsWith("learnlytics_ai_chat_history_"))
      .forEach((key) => localStorage.removeItem(key));
  }

  function getToken() {
    return readSession()?.token || "";
  }

  function getUser() {
    return readSession()?.user || null;
  }

  function redirectToLogin() {
    const current = window.location.pathname.split("/").pop();
    if (current !== "login.html") {
      window.location.href = "login.html";
    }
  }

  function requireSession(requiredRole = "student") {
    const session = readSession();
    const user = session?.user;

    if (!session?.token || !user?.id) {
      redirectToLogin();
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      clearSession();
      redirectToLogin();
      return null;
    }

    return session;
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function authFetch(input, options = {}) {
    const response = await fetch(input, {
      ...options,
      headers: authHeaders(options.headers || {}),
    });

    if (response.status === 401) {
      clearSession();
      redirectToLogin();
    }

    return response;
  }

  function getDisplayName(user = getUser()) {
    return user?.name || "Student";
  }

  function getAcademicMeta(user = getUser(), fallback = "Student") {
    if (!user) return fallback;

    return [user.regno, user.branch, user.session].filter(Boolean).join(" - ") || fallback;
  }

  function syncUserDisplay() {
    const user = getUser();
    if (!user) return;

    const name = getDisplayName(user);
    const meta = getAcademicMeta(user);

    document.querySelectorAll(
      "#studentName, #profileName, .profile h4, [data-current-user-name]"
    ).forEach((element) => {
      element.textContent = name;
    });

    document.querySelectorAll(
      "#studentMeta, #profileMeta, .profile span, [data-current-user-meta]"
    ).forEach((element) => {
      element.textContent = meta;
    });

    document.querySelectorAll("#regNo, [data-current-user-regno]").forEach((element) => {
      element.textContent = user.regno || "--";
    });

    document.querySelectorAll("[data-current-user-email]").forEach((element) => {
      element.textContent = user.email || "--";
    });
  }

  function setupLogout(selector = "#logoutBtn") {
    document.querySelectorAll(selector).forEach((button) => {
      button.addEventListener("click", () => {
        if (confirm("Logout from dashboard?")) {
          clearSession();
          alert("Logged out successfully");
          window.location.href = "login.html";
        }
      });
    });
  }

  window.LearnLyticsAuth = {
    API_ROOT,
    SESSION_KEY,
    authFetch,
    authHeaders,
    clearSession,
    getAcademicMeta,
    getDisplayName,
    getToken,
    getUser,
    readSession,
    requireSession,
    saveSession,
    setupLogout,
    syncUserDisplay,
  };
})(window);
