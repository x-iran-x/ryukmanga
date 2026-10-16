import { Account, Client, ID } from "https://cdn.jsdelivr.net/npm/appwrite@17.0.0/+esm";

const APPWRITE_ENDPOINT = "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = "6ad28bbc0023dee367ab";

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);

const authModal = document.getElementById("authModal");
const openAuthBtn = document.getElementById("openAuthBtn");
const closeAuthBtn = document.getElementById("closeAuthBtn");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const statusMessage = document.getElementById("authStatus");

let currentUser = null;

function showMessage(message, isError = false) {
  if (!statusMessage) {
    alert(message);
    return;
  }
  statusMessage.textContent = message;
  statusMessage.dataset.state = isError ? "error" : "success";
  statusMessage.hidden = false;
}

function clearMessage() {
  if (!statusMessage) return;
  statusMessage.textContent = "";
  statusMessage.hidden = true;
  delete statusMessage.dataset.state;
}

function showAuthTab(tab) {
  const registering = tab === "register";
  loginTab?.classList.toggle("active", !registering);
  registerTab?.classList.toggle("active", registering);
  loginForm?.classList.toggle("active", !registering);
  registerForm?.classList.toggle("active", registering);
  clearMessage();
}

function setBusy(form, busy, busyText) {
  const button = form?.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function friendlyError(error) {
  const message = String(error?.message || "");
  if (/user.*already exists|already exists/i.test(message)) {
    return "این ایمیل قبلاً ثبت‌نام کرده است؛ از بخش ورود استفاده کن.";
  }
  if (/invalid.*credentials|user.*not found|password.*wrong/i.test(message)) {
    return "ایمیل یا رمز عبور درست نیست.";
  }
  if (/password.*(length|short)|password.*weak/i.test(message)) {
    return "رمز عبور باید حداقل ۸ کاراکتر داشته باشد.";
  }
  if (/rate limit/i.test(message)) {
    return "تعداد تلاش‌ها زیاد بوده؛ کمی بعد دوباره امتحان کن.";
  }
  return "عملیات انجام نشد. تنظیمات Authentication در Appwrite و اتصال اینترنت را بررسی کن.";
}

function updateSignedInUI(user) {
  currentUser = user || null;
  if (openAuthBtn) {
    openAuthBtn.textContent = currentUser
      ? (currentUser.name || currentUser.email || "حساب کاربری")
      : "ورود / ثبت‌نام";
    openAuthBtn.setAttribute("aria-label", currentUser ? "مدیریت حساب و خروج" : "ورود یا ثبت‌نام");
  }
}

if (openAuthBtn && authModal) {
  openAuthBtn.addEventListener("click", async () => {
    if (currentUser) {
      const shouldLogout = window.confirm(
        `وارد حساب ${currentUser.email || currentUser.name || "کاربری"} هستی. برای خروج از حساب OK را بزن.`
      );
      if (!shouldLogout) return;
      try {
        await account.deleteSession("current");
        updateSignedInUI(null);
        showMessage("با موفقیت از حساب خارج شدی.");
      } catch (error) {
        console.error("Appwrite logout error:", error);
        alert("خروج از حساب انجام نشد. دوباره تلاش کن.");
      }
      return;
    }
    clearMessage();
    authModal.classList.add("active");
  });
}

closeAuthBtn?.addEventListener("click", () => authModal?.classList.remove("active"));
window.addEventListener("click", (event) => {
  if (event.target === authModal) authModal.classList.remove("active");
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") authModal?.classList.remove("active");
});

loginTab?.addEventListener("click", () => showAuthTab("login"));
registerTab?.addEventListener("click", () => showAuthTab("register"));

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  setBusy(loginForm, true, "در حال ورود...");
  try {
    await account.createEmailPasswordSession(email, password);
    const user = await account.get();
    updateSignedInUI(user);
    authModal?.classList.remove("active");
    loginForm.reset();
    showMessage("با موفقیت وارد حساب شدی.");
  } catch (error) {
    console.error("Appwrite login error:", error);
    showMessage(friendlyError(error), true);
  } finally {
    setBusy(loginForm, false);
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  const formData = new FormData(registerForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (password.length < 8) {
    showMessage("رمز عبور باید حداقل ۸ کاراکتر باشد.", true);
    return;
  }
  setBusy(registerForm, true, "در حال ساخت حساب...");
  try {
    await account.create(ID.unique(), email, password, name || undefined);
    await account.createEmailPasswordSession(email, password);
    const user = await account.get();
    updateSignedInUI(user);
    authModal?.classList.remove("active");
    registerForm.reset();
    showMessage("حساب کاربری ساخته شد و وارد شدی.");
  } catch (error) {
    console.error("Appwrite registration error:", error);
    showMessage(friendlyError(error), true);
  } finally {
    setBusy(registerForm, false);
  }
});

async function initializeAppwriteAuth() {
  try {
    // A lightweight connectivity check; authentication state is checked separately.
    await client.ping();
    console.info("RyukManga is connected to Appwrite.");
  } catch (error) {
    console.error("Appwrite ping failed:", error);
  }

  try {
    const user = await account.get();
    updateSignedInUI(user);
  } catch {
    updateSignedInUI(null);
  }
}

initializeAppwriteAuth();
