import { h } from "https://esm.sh/preact@10.19.3";
import { useState } from "https://esm.sh/preact@10.19.3/hooks";
import { api, auth } from "../api.js";

// ── Shared form components ────────────────────────────────────────────────────

function Field({ label, type = "text", value, onInput, placeholder, autoComplete }) {
  return h("label", { class: "auth-field" },
    h("span", { class: "auth-label" }, label),
    h("input", {
      class: "auth-input",
      type, value, placeholder, autoComplete,
      onInput: (e) => onInput(e.target.value),
    })
  );
}

function ErrMsg({ msg }) {
  return msg ? h("div", { class: "auth-error" }, msg) : null;
}

function OkMsg({ msg }) {
  return msg ? h("div", { class: "auth-ok" }, msg) : null;
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginForm({ onSuccess, onGoRegister, onGoForgot }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      auth.setToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      setError(err.message.includes("401") ? "Incorrect email or password" : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return h("form", { class: "auth-form", onSubmit: submit },
    h("h2", { class: "auth-title" }, "Sign in"),
    ErrMsg({ msg: error }),
    Field({ label: "Email", type: "email", value: email, onInput: setEmail, placeholder: "you@example.com", autoComplete: "email" }),
    Field({ label: "Password", type: "password", value: password, onInput: setPassword, placeholder: "••••••••", autoComplete: "current-password" }),
    h("button", { class: "auth-btn", type: "submit", disabled: loading },
      loading ? "Signing in…" : "Sign in"
    ),
    h("div", { class: "auth-links" },
      h("button", { class: "auth-link", type: "button", onClick: onGoForgot }, "Forgot password?"),
      h("span", { class: "auth-link-sep" }, "·"),
      h("button", { class: "auth-link", type: "button", onClick: onGoRegister }, "Create account"),
    )
  );
}

// ── Register ──────────────────────────────────────────────────────────────────

function RegisterForm({ onSuccess, onGoLogin }) {
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await api.register(username.trim(), email.trim(), password);
      auth.setToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      const msg = err.message;
      setError(msg.includes("400") ? "Email or username already taken" : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return h("form", { class: "auth-form", onSubmit: submit },
    h("h2", { class: "auth-title" }, "Create account"),
    ErrMsg({ msg: error }),
    Field({ label: "Username", value: username, onInput: setUsername, placeholder: "yourname", autoComplete: "username" }),
    Field({ label: "Email", type: "email", value: email, onInput: setEmail, placeholder: "you@example.com", autoComplete: "email" }),
    Field({ label: "Password", type: "password", value: password, onInput: setPassword, placeholder: "Min 6 characters", autoComplete: "new-password" }),
    Field({ label: "Confirm password", type: "password", value: confirm, onInput: setConfirm, placeholder: "••••••••", autoComplete: "new-password" }),
    h("button", { class: "auth-btn", type: "submit", disabled: loading },
      loading ? "Creating account…" : "Create account"
    ),
    h("div", { class: "auth-links" },
      h("span", null, "Already have an account?"),
      h("button", { class: "auth-link", type: "button", onClick: onGoLogin }, "Sign in"),
    )
  );
}

// ── Forgot password ───────────────────────────────────────────────────────────

function ForgotForm({ onGoLogin, onTokenReady }) {
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      onTokenReady(res.reset_token);
    } catch (err) {
      setError(err.message.includes("404") ? "No account found with that email" : "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return h("form", { class: "auth-form", onSubmit: submit },
    h("h2", { class: "auth-title" }, "Reset password"),
    h("p", { class: "auth-hint" }, "Enter your account email and we'll generate a reset token."),
    ErrMsg({ msg: error }),
    Field({ label: "Email", type: "email", value: email, onInput: setEmail, placeholder: "you@example.com", autoComplete: "email" }),
    h("button", { class: "auth-btn", type: "submit", disabled: loading },
      loading ? "Sending…" : "Get reset token"
    ),
    h("div", { class: "auth-links" },
      h("button", { class: "auth-link", type: "button", onClick: onGoLogin }, "← Back to sign in"),
    )
  );
}

// ── Reset password ────────────────────────────────────────────────────────────

function ResetForm({ prefillToken, onGoLogin }) {
  const [token,    setToken]    = useState(prefillToken ?? "");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [ok,       setOk]       = useState("");
  const [loading,  setLoading]  = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setOk("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await api.resetPassword(token.trim(), password);
      setOk("Password reset successfully! You can now sign in.");
    } catch (err) {
      setError(err.message.includes("400") ? "Invalid or expired token" : "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return h("form", { class: "auth-form", onSubmit: submit },
    h("h2", { class: "auth-title" }, "Set new password"),
    ErrMsg({ msg: error }),
    OkMsg({ msg: ok }),
    !ok && h("div", null,
      h("label", { class: "auth-field" },
        h("span", { class: "auth-label" }, "Reset token"),
        h("textarea", {
          class: "auth-input auth-textarea",
          value: token,
          onInput: (e) => setToken(e.target.value),
          placeholder: "Paste your reset token here",
          rows: 2,
        })
      ),
      Field({ label: "New password", type: "password", value: password, onInput: setPassword, placeholder: "Min 6 characters", autoComplete: "new-password" }),
      Field({ label: "Confirm new password", type: "password", value: confirm, onInput: setConfirm, placeholder: "••••••••", autoComplete: "new-password" }),
      h("button", { class: "auth-btn", type: "submit", disabled: loading },
        loading ? "Resetting…" : "Reset password"
      )
    ),
    h("div", { class: "auth-links" },
      h("button", { class: "auth-link", type: "button", onClick: onGoLogin }, "← Back to sign in"),
    )
  );
}

// ── AuthPage root ─────────────────────────────────────────────────────────────

export function AuthPage({ authView, onSetView, onLogin }) {
  const [resetToken, setResetToken] = useState(null);

  function handleTokenReady(token) {
    setResetToken(token);
    onSetView("reset");
  }

  return h("div", { class: "auth-page" },
    h("div", { class: "auth-card" },
      h("div", { class: "auth-logo" },
        h("svg", { viewBox: "0 0 36 36", width: 40, height: 40, fill: "none" },
          h("rect", { width: 36, height: 36, rx: 10, fill: "#2563eb" }),
          h("path", { d: "M10 12h16M10 18h10M10 24h13", stroke: "#fff", "stroke-width": 2.2, "stroke-linecap": "round" })
        ),
        h("span", { class: "auth-logo-name" }, "OmniNote")
      ),

      authView === "login"    && h(LoginForm,    { onSuccess: onLogin, onGoRegister: () => onSetView("register"), onGoForgot: () => onSetView("forgot") }),
      authView === "register" && h(RegisterForm, { onSuccess: onLogin, onGoLogin: () => onSetView("login") }),
      authView === "forgot"   && h(ForgotForm,   { onGoLogin: () => onSetView("login"), onTokenReady: handleTokenReady }),
      authView === "reset"    && h(ResetForm,    { prefillToken: resetToken, onGoLogin: () => onSetView("login") }),
    )
  );
}
