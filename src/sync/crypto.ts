// Client-Side Cryptographic Utilities for Empanel E2EE Sync
// Universal implementation using native Web Crypto API (SubtleCrypto)

const PIN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters, avoids 0/O, 1/I
const PBKDF2_SALT = new TextEncoder().encode('empanel-e2ee-pbkdf2-salt-v1');
const ROOM_SALT = 'empanel-room-salt-v1';

/**
 * Generates a human-friendly 6-character alphanumeric PIN.
 */
export function generatePin(): string {
  const values = new Uint8Array(6);
  window.crypto.getRandomValues(values);
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += PIN_CHARSET[values[i] % PIN_CHARSET.length];
  }
  return pin;
}

/**
 * Formats a PIN for readable display (e.g. "K7M-9P2").
 */
export function formatPin(pin: string): string {
  const clean = normalizePin(pin);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

/**
 * Strips dashes, spaces, and normalizes to uppercase.
 */
export function normalizePin(pin: string): string {
  return pin.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Validates whether a normalized PIN is valid 6-char alphanumeric.
 */
export function isValidPin(pin: string): boolean {
  const clean = normalizePin(pin);
  if (clean.length !== 6) return false;
  for (const ch of clean) {
    if (!PIN_CHARSET.includes(ch)) return false;
  }
  return true;
}

/**
 * Derives a deterministic one-way Room ID from the PIN.
 * The signaling relay server only sees this Room ID, never the PIN or the derived key.
 */
export async function deriveRoomId(pin: string): Promise<string> {
  const clean = normalizePin(pin);
  const data = new TextEncoder().encode(`${ROOM_SALT}:${clean}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Return first 16 bytes as hex
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives an AES-256-GCM CryptoKey from the 6-character PIN using PBKDF2.
 */
export async function deriveKeyFromPin(pin: string): Promise<CryptoKey> {
  const clean = normalizePin(pin);
  const pinBytes = new TextEncoder().encode(clean);

  // Import raw PIN as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key using 100,000 PBKDF2 iterations
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PBKDF2_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedEnvelope {
  iv: string; // Base64 12-byte IV
  ciphertext: string; // Base64 ciphertext
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts an arbitrary JSON-serializable payload with AES-256-GCM.
 */
export async function encryptPayload<T>(key: CryptoKey, data: T): Promise<EncryptedEnvelope> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer),
  };
}

/**
 * Decrypts an EncryptedEnvelope with AES-256-GCM and parses as JSON.
 */
export async function decryptPayload<T>(key: CryptoKey, envelope: EncryptedEnvelope): Promise<T> {
  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoded = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decoded) as T;
}

/**
 * Creates an ephemeral 32-byte authentication challenge.
 */
export function createAuthChallenge(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes an authentication response proof for a challenge using the derived key.
 */
export async function computeAuthProof(key: CryptoKey, challenge: string): Promise<string> {
  const envelope = await encryptPayload(key, { challenge, timestamp: Date.now() });
  return JSON.stringify(envelope);
}

/**
 * Verifies an authentication proof against the challenge.
 */
export async function verifyAuthProof(
  key: CryptoKey,
  challenge: string,
  proofString: string
): Promise<boolean> {
  try {
    const envelope: EncryptedEnvelope = JSON.parse(proofString);
    const data = await decryptPayload<{ challenge: string; timestamp: number }>(key, envelope);
    return data.challenge === challenge && Math.abs(Date.now() - data.timestamp) < 60000;
  } catch (err) {
    return false;
  }
}
