const KEY_PREFIX = 'chat_e2ee_keypair_v1_';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
};

const fromBase64 = (base64) => {
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const storageKeyFor = (userId) => `${KEY_PREFIX}${userId}`;

const generateIdentity = async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  return {
    publicKey: toBase64(spki),
    privateKey: toBase64(pkcs8),
  };
};

const importPublicKey = async (publicKeyBase64) =>
  crypto.subtle.importKey(
    'spki',
    fromBase64(publicKeyBase64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

const importPrivateKey = async (privateKeyBase64) =>
  crypto.subtle.importKey(
    'pkcs8',
    fromBase64(privateKeyBase64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

export const ensureE2EEIdentity = async ({ userId, apiFetch }) => {
  if (!userId || !apiFetch) return null;
  const key = storageKeyFor(userId);
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    stored = null;
  }

  let remote = null;
  try {
    remote = await apiFetch('/api/chat/keys/me');
  } catch {
    remote = null;
  }

  // If server already has a keypair, treat it as canonical to keep devices in sync.
  if (remote?.publicKey && remote?.privateKey) {
    stored = { publicKey: remote.publicKey, privateKey: remote.privateKey };
    localStorage.setItem(key, JSON.stringify(stored));
  }

  if (!stored?.publicKey || !stored?.privateKey) {
    stored = await generateIdentity();
    localStorage.setItem(key, JSON.stringify(stored));
  }

  // Best-effort register/update server-side keypair for multi-device continuity.
  try {
    await apiFetch('/api/chat/keys/me', {
      method: 'PUT',
      body: JSON.stringify({ publicKey: stored.publicKey, privateKey: stored.privateKey }),
    });
  } catch {
    // Keep local key; chat can fallback while offline.
  }
  return stored;
};

// Participants' public keys per thread, reused for a few minutes so sending a message
// doesn't need an extra request first. A fresh fetch runs in the background on reuse.
const THREAD_KEYS_TTL_MS = 5 * 60 * 1000;
const threadKeysCache = new Map(); // threadId -> { at, promise }
const loadThreadKeys = (threadId, apiFetch) => {
  const key = String(threadId);
  const hit = threadKeysCache.get(key);
  const fetchKeys = () => {
    const promise = apiFetch(`/api/chat/threads/${threadId}/keys`);
    threadKeysCache.set(key, { at: Date.now(), promise });
    promise.catch(() => threadKeysCache.delete(key));
    return promise;
  };
  if (hit && Date.now() - hit.at < THREAD_KEYS_TTL_MS) return hit.promise;
  return fetchKeys();
};

export const encryptChatMessage = async ({ threadId, text, myId, apiFetch }) => {
  if (!threadId || !text || !myId || !apiFetch) return null;
  const payload = await loadThreadKeys(threadId, apiFetch);
  const keyMap = payload?.keys || {};
  const participants = Object.entries(keyMap).filter(([, value]) => value?.publicKey);
  if (!participants.length) return null;

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(text)
  );
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

  const wrappedKeys = [];
  for (const [participantId, value] of participants) {
    try {
      const publicKey = await importPublicKey(value.publicKey);
      const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAesKey);
      wrappedKeys.push({ userId: participantId, wrappedKey: toBase64(wrapped) });
    } catch {
      // Skip invalid key
    }
  }

  // Need at least sender + one receiver key for practical E2EE.
  if (!wrappedKeys.some((k) => String(k.userId) === String(myId)) || wrappedKeys.length < 2) {
    return null;
  }

  return {
    algorithm: 'AES-GCM',
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertextBuffer),
    keys: wrappedKeys,
    version: 'v1',
  };
};

export const decryptChatMessage = async ({ message, myId, privateKeyBase64 }) => {
  if (!message?.encrypted?.ciphertext || !message?.encrypted?.iv || !Array.isArray(message?.encrypted?.keys)) {
    return message?.text || '';
  }
  if (!myId) return message?.text || '';
  let resolvedPrivateKey = privateKeyBase64 || '';
  if (!resolvedPrivateKey) {
    try {
      const local = JSON.parse(localStorage.getItem(storageKeyFor(myId)) || 'null');
      resolvedPrivateKey = local?.privateKey || '';
    } catch {
      resolvedPrivateKey = '';
    }
  }
  if (!resolvedPrivateKey) return message?.text || '';
  const wrapped = message.encrypted.keys.find((entry) => String(entry?.userId) === String(myId));
  if (!wrapped?.wrappedKey) return message?.text || '';

  try {
    const privateKey = await importPrivateKey(resolvedPrivateKey);
    const rawAesKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      fromBase64(wrapped.wrappedKey)
    );
    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(message.encrypted.iv) },
      aesKey,
      fromBase64(message.encrypted.ciphertext)
    );
    return decoder.decode(plainBuffer);
  } catch {
    return message?.text || '';
  }
};
