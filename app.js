// Nom de la clé dans localStorage
const VAULT_STORAGE_KEY = "mini_password_vault_v1";
const SALT_STORAGE_KEY = "mini_password_vault_salt_v1";

// État en mémoire (déchiffré)
let vaultEntries = [];
let cryptoKey = null; // clé dérivée du mot de passe maître

// Helpers DOM
const masterScreen = document.getElementById("master-screen");
const vaultScreen = document.getElementById("vault-screen");
const masterPasswordInput = document.getElementById("master-password");
const unlockBtn = document.getElementById("unlock-btn");
const masterError = document.getElementById("master-error");
const lockBtn = document.getElementById("lock-btn");

const searchInput = document.getElementById("search-input");
const entriesBody = document.getElementById("entries-body");

const entryForm = document.getElementById("entry-form");
const entryIdInput = document.getElementById("entry-id");
const entryNameInput = document.getElementById("entry-name");
const entryUrlInput = document.getElementById("entry-url");
const entryUsernameInput = document.getElementById("entry-username");
const entryPasswordInput = document.getElementById("entry-password");
const generateBtn = document.getElementById("generate-btn");
const resetFormBtn = document.getElementById("reset-form-btn");

/* ========= UTILITAIRES ENCODAGE ========= */

function strToArrayBuffer(str) {
  return new TextEncoder().encode(str);
}

function arrayBufferToStr(buf) {
  return new TextDecoder().decode(buf);
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/* ========= CRYPTO (Web Crypto) ========= */

// Génère (ou récupère) un salt pour PBKDF2
async function getOrCreateSalt() {
  let saltB64 = localStorage.getItem(SALT_STORAGE_KEY);
  if (saltB64) {
    return base64ToBuf(saltB64);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_STORAGE_KEY, bufToBase64(salt.buffer));
  return salt.buffer;
}

// Dérive une clé AES-GCM à partir du mot de passe maître
async function deriveKeyFromPassword(password) {
  const salt = await getOrCreateSalt();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    strToArrayBuffer(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Chiffre une chaîne (JSON) avec AES-GCM
async function encryptString(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    strToArrayBuffer(plaintext)
  );

  // On stocke iv + ciphertext en base64
  const ivB64 = bufToBase64(iv.buffer);
  const ctB64 = bufToBase64(ciphertext);
  return ivB64 + ":" + ctB64;
}

// Déchiffre une chaîne en AES-GCM
async function decryptString(data, key) {
  const [ivB64, ctB64] = data.split(":");
  if (!ivB64 || !ctB64) {
    throw new Error("Format de données invalide");
  }
  const iv = new Uint8Array(base64ToBuf(ivB64));
  const ciphertext = base64ToBuf(ctB64);

  const plaintextBuf = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext
  );
  return arrayBufferToStr(plaintextBuf);
}

/* ========= GESTION DU COFFRE ========= */

function getStoredVault() {
  return localStorage.getItem(VAULT_STORAGE_KEY) || null;
}

async function loadVaultWithPassword(password) {
  // dérive la clé
  const key = await deriveKeyFromPassword(password);
  cryptoKey = key;

  const encrypted = getStoredVault();
  if (!encrypted) {
    // Pas encore de coffre => on crée un coffre vide
    vaultEntries = [];
    await saveVault();
    return true;
  }

  try {
    const json = await decryptString(encrypted, key);
    vaultEntries = JSON.parse(json);
    if (!Array.isArray(vaultEntries)) {
      vaultEntries = [];
    }
    return true;
  } catch (e) {
    console.error("Erreur de déchiffrement :", e);
    return false;
  }
}

async function saveVault() {
  if (!cryptoKey) {
    throw new Error("Clé non initialisée");
  }
  const json = JSON.stringify(vaultEntries);
  const encrypted = await encryptString(json, cryptoKey);
  localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
}

/* ========= UI : AFFICHAGE ========= */

function renderEntries(filter = "") {
  entriesBody.innerHTML = "";

  const lowerFilter = filter.trim().toLowerCase();

  vaultEntries
    .filter((entry) =>
      !lowerFilter
        ? true
        : (entry.name || "").toLowerCase().includes(lowerFilter)
    )
    .forEach((entry, index) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = entry.name || "";
      tr.appendChild(tdName);

      const tdUrl = document.createElement("td");
      if (entry.url) {
        const a = document.createElement("a");
        a.href = entry.url;
        a.textContent = entry.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        tdUrl.appendChild(a);
      }
      tr.appendChild(tdUrl);

      const tdUsername = document.createElement("td");
      tdUsername.textContent = entry.username || "";
      tr.appendChild(tdUsername);

      const tdPassword = document.createElement("td");
      const pwSpan = document.createElement("span");
      pwSpan.textContent = "••••••••";
      pwSpan.dataset.realPassword = entry.password || "";
      pwSpan.style.cursor = "pointer";
      pwSpan.title = "Cliquer pour afficher / masquer";
      let visible = false;
      pwSpan.addEventListener("click", () => {
        visible = !visible;
        pwSpan.textContent = visible
          ? pwSpan.dataset.realPassword
          : "••••••••";
      });
      tdPassword.appendChild(pwSpan);
      tr.appendChild(tdPassword);

      const tdActions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.textContent = "Éditer";
      editBtn.className = "action-btn edit";
      editBtn.addEventListener("click", () => {
        loadEntryIntoForm(index);
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "Supprimer";
      delBtn.className = "action-btn delete";
      delBtn.addEventListener("click", async () => {
        if (confirm("Supprimer cette entrée ?")) {
          vaultEntries.splice(index, 1);
          await saveVault();
          renderEntries(searchInput.value);
        }
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);
      tr.appendChild(tdActions);

      entriesBody.appendChild(tr);
    });
}

/* ========= UI : FORMULAIRE ENTRÉE ========= */

function resetForm() {
  entryIdInput.value = "";
  entryNameInput.value = "";
  entryUrlInput.value = "";
  entryUsernameInput.value = "";
  entryPasswordInput.value = "";
}

function loadEntryIntoForm(index) {
  const entry = vaultEntries[index];
  entryIdInput.value = index;
  entryNameInput.value = entry.name || "";
  entryUrlInput.value = entry.url || "";
  entryUsernameInput.value = entry.username || "";
  entryPasswordInput.value = entry.password || "";
}

/* ========= GÉNÉRATION DE MOT DE PASSE ========= */

function generatePassword(length = 16) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.?/";

  let pw = "";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    pw += chars[array[i] % chars.length];
  }
  return pw;
}

/* ========= ÉVÈNEMENTS ========= */

// Déverrouiller le coffre
unlockBtn.addEventListener("click", async () => {
  const pwd = masterPasswordInput.value;
  masterError.textContent = "";
  if (!pwd) {
    masterError.textContent = "Merci d'entrer un mot de passe maître.";
    return;
  }

  unlockBtn.disabled = true;
  unlockBtn.textContent = "Déverrouillage...";
  try {
    const ok = await loadVaultWithPassword(pwd);
    if (!ok) {
      masterError.textContent = "Mot de passe maître incorrect.";
      return;
    }
    masterPasswordInput.value = "";
    masterScreen.classList.add("hidden");
    vaultScreen.classList.remove("hidden");
    renderEntries();
  } catch (e) {
    console.error(e);
    masterError.textContent = "Erreur lors du déverrouillage du coffre.";
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = "Déverrouiller";
  }
});

// Verrouiller
lockBtn.addEventListener("click", () => {
  cryptoKey = null;
  vaultEntries = [];
  vaultScreen.classList.add("hidden");
  masterScreen.classList.remove("hidden");
});

// Recherche
searchInput.addEventListener("input", () => {
  renderEntries(searchInput.value);
});

// Soumission du formulaire d'entrée
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const indexStr = entryIdInput.value;
  const entryData = {
    name: entryNameInput.value.trim(),
    url: entryUrlInput.value.trim(),
    username: entryUsernameInput.value.trim(),
    password: entryPasswordInput.value,
  };

  if (!entryData.name) {
    alert("Le champ 'Nom' est obligatoire.");
    return;
  }

  if (indexStr === "") {
    vaultEntries.push(entryData);
  } else {
    const index = parseInt(indexStr, 10);
    vaultEntries[index] = entryData;
  }

  await saveVault();
  resetForm();
  renderEntries(searchInput.value);
});

// Bouton générer mot de passe
generateBtn.addEventListener("click", () => {
  entryPasswordInput.value = generatePassword(16);
});

// Bouton annuler
resetFormBtn.addEventListener("click", () => {
  resetForm();
});
