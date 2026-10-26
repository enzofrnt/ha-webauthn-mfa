/**
 * WebAuthn MFA — native-looking Home Assistant passkey management panel.
 *
 * HA web components provide every interactive control. The CSS is only layout
 * glue and uses HA design tokens so the active theme remains authoritative.
 */

class WebAuthnPanel extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._credentials = [];
    this._mounted = false;
    this._isAttached = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._menuBtn) this._menuBtn.hass = hass;
    if (this._isAttached && !this._mounted) this._mount();
  }

  set narrow(value) {
    this._narrow = value;
    if (this._menuBtn) this._menuBtn.narrow = value;
  }

  connectedCallback() {
    this._isAttached = true;
    if (this._hass && !this._mounted) this._mount();
  }

  disconnectedCallback() {
    this._mounted = false;
    this._isAttached = false;
  }

  async _mount() {
    if (this._mounted) return;
    this._mounted = true;

    const T = await this._loadStrings();
    if (!T) {
      this._renderFatal();
      return;
    }

    this._root.replaceChildren();

    this.style.cssText = `
      display: grid;
      grid-template-rows: var(--header-height, 56px) minmax(0, 1fr);
      width: 100%; height: 100%; overflow: hidden;
      background: var(--primary-background-color);
      color: var(--primary-text-color);
    `;

    const header = document.createElement("div");
    header.setAttribute("role", "banner");
    header.style.cssText = `
      display: flex; align-items: center;
      min-height: var(--header-height, 56px);
      padding: 0 var(--ha-space-4, 16px);
      padding-inline-start: max(var(--ha-space-1, 4px), var(--safe-area-inset-left, 0px));
      background: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      box-shadow: var(--app-header-box-shadow, none); z-index: 2;
    `;

    this._menuBtn = document.createElement("ha-menu-button");
    this._menuBtn.hass = this._hass;
    this._menuBtn.narrow = this._narrow;
    header.appendChild(this._menuBtn);

    const title = document.createElement("div");
    title.textContent = T.title;
    title.style.cssText = `
      flex: 1; margin-inline-start: var(--ha-space-4, 16px); overflow: hidden;
      font-size: var(--ha-font-size-xl, 20px);
      font-weight: var(--ha-font-weight-medium, 500);
      line-height: var(--ha-line-height-condensed, 1.2); letter-spacing: .15px;
      text-overflow: ellipsis; white-space: nowrap;
    `;
    header.appendChild(title);
    this._root.appendChild(header);

    const content = document.createElement("main");
    content.className = "webauthn-content";
    content.innerHTML = this._buildHTML(T);
    this._root.appendChild(content);

    this._bindEvents(content, T);
    this._loadCredentials(content, T);
  }

  async _loadStrings() {
    const raw =
      this._hass?.language || this._hass?.locale?.language ||
      navigator.language || "en";
    const lang = raw.split("-")[0].toLowerCase();
    try {
      const response = await fetch(
        `/api/webauthn_mfa/strings?section=panel&lang=${encodeURIComponent(lang)}`,
        { headers: this._authHeaders(), credentials: "same-origin" }
      );
      if (response.ok) return await response.json();
      console.error("[WebAuthn] strings request failed:", response.status);
    } catch (err) {
      console.error("[WebAuthn] loadStrings error:", err);
    }
    return null;
  }

  _renderFatal() {
    this.style.cssText = `
      display: block; box-sizing: border-box; min-height: 100%;
      padding: var(--ha-space-6, 24px);
      background: var(--primary-background-color); color: var(--primary-text-color);
    `;
    const alert = document.createElement("ha-alert");
    alert.setAttribute("alert-type", "error");
    alert.textContent =
      "Passkeys panel could not load its translations. Check the Home Assistant logs.";
    this._root.replaceChildren(alert);
  }

  _format(template, values) {
    return String(template || "").replace(/\{(\w+)\}/g, (match, key) =>
      key in values ? values[key] : match
    );
  }

  _escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  _buildHTML(T) {
    const e = (value) => this._escapeHTML(value);
    return `
      <style>
        .webauthn-content {
          box-sizing: border-box; overflow-y: auto;
          padding: var(--ha-space-6, 24px) var(--ha-space-4, 16px);
        }
        .page-column {
          display: grid; gap: var(--ha-space-4, 16px);
          width: 100%; max-width: 720px; margin: 0 auto;
        }
        .intro {
          margin: 0 0 var(--ha-space-2, 8px); color: var(--secondary-text-color);
          font-size: var(--ha-font-size-m, 14px);
          line-height: var(--ha-line-height-normal, 1.5);
        }
        ha-card {
          overflow: hidden;
          --ha-card-header-font-size: var(--ha-font-size-xl, 20px);
          --ha-card-header-font-weight: var(--ha-font-weight-normal, 400);
        }
        .card-content { padding: 0 var(--ha-space-4, 16px) var(--ha-space-4, 16px); }
        .credential-list {
          margin: 0 calc(var(--ha-space-4, 16px) * -1)
            calc(var(--ha-space-4, 16px) * -1);
        }
        .credential-row {
          display: flex; align-items: center; min-height: 64px;
          gap: var(--ha-space-3, 12px);
          padding: var(--ha-space-2, 8px) var(--ha-space-4, 16px);
          border-top: 1px solid var(--divider-color);
        }
        .credential-row:first-child { border-top: 0; }
        .credential-icon, .empty-icon {
          display: flex; flex: 0 0 auto; align-items: center; justify-content: center;
          width: 40px; height: 40px;
          border-radius: var(--ha-border-radius-circle, 50%);
          background: var(--ha-color-fill-primary-quiet-resting,
            color-mix(in srgb, var(--primary-color) 12%, transparent));
          color: var(--primary-color);
        }
        .credential-icon ha-icon { --mdc-icon-size: 22px; }
        .credential-info {
          display: flex; flex: 1 1 auto; min-width: 0;
          flex-direction: column; gap: 2px;
        }
        .credential-name {
          overflow: hidden; color: var(--primary-text-color);
          font-size: var(--ha-font-size-m, 14px);
          font-weight: var(--ha-font-weight-medium, 500);
          line-height: var(--ha-line-height-normal, 1.4);
          text-overflow: ellipsis; white-space: nowrap;
        }
        .credential-id {
          overflow: hidden; color: var(--secondary-text-color);
          font-family: var(--ha-font-family-code, monospace);
          font-size: var(--ha-font-size-xs, 12px);
          line-height: var(--ha-line-height-condensed, 1.25);
          text-overflow: ellipsis; white-space: nowrap;
        }
        .credential-actions {
          display: flex; flex: 0 0 auto; align-items: center; justify-content: flex-end;
          gap: var(--ha-space-1, 4px);
        }
        .confirm-copy {
          color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 13px);
        }
        .empty-state, .loading-state {
          display: flex; align-items: center; gap: var(--ha-space-3, 12px);
          min-height: 64px; color: var(--secondary-text-color);
          font-size: var(--ha-font-size-m, 14px);
        }
        .empty-icon { background: var(--secondary-background-color); color: var(--secondary-text-color); }
        .loading-state { min-height: 48px; }
        .loading-state ha-spinner { width: 28px; height: 28px; }
        .form-row {
          display: flex; align-items: flex-start; gap: var(--ha-space-3, 12px);
        }
        .form-row ha-input {
          flex: 1 1 auto; min-width: 0; --ha-input-padding-bottom: 0;
        }
        .form-row ha-button { flex: 0 0 auto; margin-top: var(--ha-space-2, 8px); }
        #status { margin-top: var(--ha-space-4, 16px); }
        #status[hidden] { display: none; }
        @media (max-width: 600px) {
          .webauthn-content { padding: var(--ha-space-4, 16px) var(--ha-space-2, 8px); }
          .form-row { flex-direction: column; }
          .form-row ha-input, .form-row ha-button { width: 100%; }
          .form-row ha-button { margin-top: 0; }
          .credential-row.confirming { align-items: flex-start; flex-wrap: wrap; }
          .credential-row.confirming .credential-actions {
            width: 100%; padding-inline-start: 52px;
          }
          .confirm-copy { margin-inline-end: auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            transition-duration: .01ms !important; animation-duration: .01ms !important;
          }
        }
      </style>
      <div class="page-column">
        <p class="intro">${e(T.subtitle)}</p>
        <ha-card header="${e(T.registered)}">
          <div class="card-content">
            <div id="credentials-list" class="credential-list" aria-live="polite">
              <div class="loading-state"><ha-spinner></ha-spinner><span>${e(T.loading)}</span></div>
            </div>
          </div>
        </ha-card>
        <ha-card header="${e(T.add)}">
          <div class="card-content">
            <div class="form-row">
              <ha-input id="passkey-name" type="text" label="${e(T.placeholder)}"
                maxlength="64" autocomplete="off"></ha-input>
              <ha-button id="register-btn" appearance="accent">
                <ha-icon slot="start" icon="mdi:plus"></ha-icon>${e(T.addBtn)}
              </ha-button>
            </div>
            <ha-alert id="status" alert-type="info" hidden></ha-alert>
          </div>
        </ha-card>
      </div>
    `;
  }

  _bindEvents(root, T) {
    const button = root.querySelector("#register-btn");
    const input = root.querySelector("#passkey-name");
    const register = () => {
      if (button.disabled || button.loading) return;
      if (!window.PublicKeyCredential) {
        this._setStatus(root, T.noSupport, "error");
        return;
      }
      this._registerPasskey(root, T, input.value.trim() || "My Passkey", button);
    };
    button.addEventListener("click", register);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        register();
      }
    });
  }

  _authHeaders() {
    try {
      const token = this._hass?.auth?.data?.access_token;
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {
      // HA will return 401 and the panel will display the error.
    }
    return {};
  }

  _bufferToBase64url(buffer) {
    let value = "";
    for (const byte of new Uint8Array(buffer)) value += String.fromCharCode(byte);
    return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  _base64urlToBuffer(value) {
    value = value.replace(/-/g, "+").replace(/_/g, "/");
    while (value.length % 4) value += "=";
    const binary = atob(value);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
  }

  async _loadCredentials(root, T) {
    try {
      const response = await fetch("/api/webauthn_mfa/list", {
        headers: this._authHeaders(), credentials: "same-origin",
      });
      if (!response.ok) throw new Error(T.serverError);
      this._credentials = await response.json();
      this._renderCredentials(root, T);
    } catch (err) {
      console.error("[WebAuthn] loadCredentials error:", err);
      this._credentials = [];
      this._renderCredentials(root, T);
      this._setStatus(root, err.message || T.serverError, "error");
    }
  }

  _renderCredentials(root, T) {
    const container = root.querySelector("#credentials-list");
    if (!container) return;
    container.replaceChildren();

    if (this._credentials.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML =
        '<span class="empty-icon"><ha-icon icon="mdi:key-variant"></ha-icon></span><span></span>';
      empty.lastElementChild.textContent = T.empty;
      container.appendChild(empty);
      return;
    }

    for (const credential of this._credentials) {
      const row = document.createElement("div");
      row.className = "credential-row";
      row.dataset.credentialId = credential.credential_id;

      const icon = document.createElement("span");
      icon.className = "credential-icon";
      icon.innerHTML = '<ha-icon icon="mdi:key-variant"></ha-icon>';

      const info = document.createElement("div");
      info.className = "credential-info";
      const name = document.createElement("span");
      name.className = "credential-name";
      name.textContent = credential.name;
      const id = document.createElement("span");
      id.className = "credential-id";
      id.textContent = credential.credential_id;
      id.title = credential.credential_id;
      info.append(name, id);

      const actions = document.createElement("div");
      actions.className = "credential-actions";
      const deleteButton = document.createElement("ha-button");
      deleteButton.setAttribute("appearance", "plain");
      deleteButton.setAttribute("variant", "danger");
      deleteButton.setAttribute("size", "s");
      deleteButton.textContent = T.delete;
      deleteButton.addEventListener("click", () =>
        this._showDeleteConfirmation(root, T, row, credential.credential_id)
      );
      actions.appendChild(deleteButton);

      row.append(icon, info, actions);
      container.appendChild(row);
    }
  }

  _showDeleteConfirmation(root, T, _row, credentialId) {
    this._renderCredentials(root, T);
    const row = [...root.querySelectorAll(".credential-row")].find(
      (candidate) => candidate.dataset.credentialId === credentialId
    );
    if (!row) return;
    row.classList.add("confirming");
    const actions = row.querySelector(".credential-actions");
    actions.replaceChildren();

    const copy = document.createElement("span");
    copy.className = "confirm-copy";
    copy.textContent = T.confirmDelete;

    const cancelButton = document.createElement("ha-button");
    cancelButton.setAttribute("appearance", "plain");
    cancelButton.setAttribute("variant", "neutral");
    cancelButton.setAttribute("size", "s");
    cancelButton.textContent = T.cancel;
    cancelButton.addEventListener("click", () => this._renderCredentials(root, T));

    const confirmButton = document.createElement("ha-button");
    confirmButton.setAttribute("appearance", "filled");
    confirmButton.setAttribute("variant", "danger");
    confirmButton.setAttribute("size", "s");
    confirmButton.textContent = T.delete;
    confirmButton.addEventListener("click", () =>
      this._deleteCredential(root, T, credentialId, confirmButton)
    );
    actions.append(copy, cancelButton, confirmButton);
    confirmButton.focus();
  }

  async _deleteCredential(root, T, credentialId, button) {
    button.loading = true;
    button.disabled = true;
    try {
      const response = await fetch(`/api/webauthn_mfa/delete/${credentialId}`, {
        method: "DELETE", headers: this._authHeaders(), credentials: "same-origin",
      });
      if (!response.ok) throw new Error(T.deleteError);
      this._credentials = this._credentials.filter(
        (credential) => credential.credential_id !== credentialId
      );
      this._renderCredentials(root, T);
      this._setStatus(root, T.deleted, "success");
    } catch (err) {
      this._renderCredentials(root, T);
      this._setStatus(root, err.message || T.deleteError, "error");
    }
  }

  async _registerPasskey(root, T, name, button) {
    button.disabled = true;
    button.loading = true;
    this._setStatus(root, T.waiting, "info");
    try {
      const challengeResponse = await fetch("/api/webauthn_mfa/register/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this._authHeaders() },
        credentials: "same-origin", body: JSON.stringify({}),
      });
      if (!challengeResponse.ok) {
        const error = await challengeResponse.json();
        throw new Error(error.message || T.serverError);
      }

      const options = await challengeResponse.json();
      options.challenge = this._base64urlToBuffer(options.challenge);
      options.user.id = this._base64urlToBuffer(options.user.id);
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map((credential) => ({
          ...credential, id: this._base64urlToBuffer(credential.id),
        }));
      }

      const credential = await navigator.credentials.create({ publicKey: options });
      const registrationResponse = await fetch("/api/webauthn_mfa/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this._authHeaders() },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          response: {
            id: credential.id,
            rawId: this._bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
              attestationObject: this._bufferToBase64url(
                credential.response.attestationObject
              ),
              clientDataJSON: this._bufferToBase64url(
                credential.response.clientDataJSON
              ),
            },
          },
        }),
      });
      if (!registrationResponse.ok) {
        const error = await registrationResponse.json();
        throw new Error(error.message || T.regError);
      }

      this._setStatus(root, this._format(T.registered_ok, { name }), "success");
      root.querySelector("#passkey-name").value = "";
      await this._loadCredentials(root, T);
    } catch (err) {
      const message = err.name === "NotAllowedError"
        ? T.cancelled
        : err.name === "InvalidStateError"
          ? T.alreadyRegistered
          : err.message || T.regError;
      this._setStatus(root, message, "error");
    } finally {
      button.disabled = false;
      button.loading = false;
    }
  }

  _setStatus(root, message, type) {
    const alert = root.querySelector("#status");
    if (!alert) return;
    alert.hidden = false;
    alert.setAttribute("alert-type", type);
    alert.textContent = message;
  }
}

if (!customElements.get("webauthn-panel")) {
  customElements.define("webauthn-panel", WebAuthnPanel);
}
