// Client-Side Cryptographic Utilities for Empanel E2EE Sync
// Universal implementation with native WebCrypto API and pure JS fallback
// for non-secure contexts (e.g. mobile devices connecting over Wi-Fi HTTP).

const PIN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters, avoids 0/O, 1/I
const PBKDF2_SALT = new TextEncoder().encode('empanel-e2ee-pbkdf2-salt-v1');
const ROOM_SALT = 'empanel-room-salt-v1';

export type EmpanelKey = CryptoKey | { __raw: Uint8Array };

function getRandomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

/**
 * Generates a human-friendly 6-character alphanumeric PIN.
 */
export function generatePin(): string {
  const values = getRandomBytes(6);
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

// =========================================================================
// Pure JavaScript Cryptographic Primitives (Fallback for Insecure Contexts)
// =========================================================================

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(data: Uint8Array): Uint8Array {
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const l = data.length;
  const bitLen = l * 8;
  const padLen = (l % 64 < 56) ? (56 - l % 64) : (120 - l % 64);
  const totalLen = l + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(data);
  padded[l] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t-15] >>> 7) | (W[t-15] << 25)) ^
                 ((W[t-15] >>> 18) | (W[t-15] << 14)) ^
                 (W[t-15] >>> 3);
      const s1 = ((W[t-2] >>> 17) | (W[t-2] << 15)) ^
                 ((W[t-2] >>> 19) | (W[t-2] << 13)) ^
                 (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^
                 ((e >>> 11) | (e << 21)) ^
                 ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^
                 ((a >>> 13) | (a << 19)) ^
                 ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) {
    outView.setUint32(i * 4, H[i], false);
  }
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) {
    k = sha256(k);
  }
  const paddedKey = new Uint8Array(64);
  paddedKey.set(k);

  const k_ipad = new Uint8Array(64);
  const k_opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    k_ipad[i] = paddedKey[i] ^ 0x36;
    k_opad[i] = paddedKey[i] ^ 0x5c;
  }

  const inner = new Uint8Array(64 + message.length);
  inner.set(k_ipad);
  inner.set(message, 64);
  const innerHash = sha256(inner);

  const outer = new Uint8Array(64 + 32);
  outer.set(k_opad);
  outer.set(innerHash, 64);
  return sha256(outer);
}

function pbkdf2HmacSha256(password: Uint8Array, salt: Uint8Array, iterations: number, keyLen = 32): Uint8Array {
  const saltBlock = new Uint8Array(salt.length + 4);
  saltBlock.set(salt);
  saltBlock[salt.length + 3] = 1; // block 1

  let u = hmacSha256(password, saltBlock);
  const result = new Uint8Array(u);

  for (let i = 1; i < iterations; i++) {
    u = hmacSha256(password, u);
    for (let j = 0; j < 32; j++) {
      result[j] ^= u[j];
    }
  }

  return result.slice(0, keyLen);
}

// AES-256 Rijndael Engine
const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
]);

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function expandKey(key: Uint8Array): Uint32Array {
  const w = new Uint32Array(60);
  const view = new DataView(key.buffer, key.byteOffset, key.byteLength);
  for (let i = 0; i < 8; i++) {
    w[i] = view.getUint32(i * 4, false);
  }
  for (let i = 8; i < 60; i++) {
    let temp = w[i - 1];
    if (i % 8 === 0) {
      const rot = ((temp << 8) | (temp >>> 24)) >>> 0;
      temp = ((SBOX[(rot >>> 24) & 0xff] << 24) |
              (SBOX[(rot >>> 16) & 0xff] << 16) |
              (SBOX[(rot >>> 8) & 0xff] << 8) |
              (SBOX[rot & 0xff])) >>> 0;
      temp ^= (RCON[i / 8] << 24);
    } else if (i % 8 === 4) {
      temp = ((SBOX[(temp >>> 24) & 0xff] << 24) |
              (SBOX[(temp >>> 16) & 0xff] << 16) |
              (SBOX[(temp >>> 8) & 0xff] << 8) |
              (SBOX[temp & 0xff])) >>> 0;
    }
    w[i] = (w[i - 8] ^ temp) >>> 0;
  }
  return w;
}

function xtime(x: number): number {
  return ((x << 1) ^ (((x >> 7) & 1) * 0x11b)) & 0xff;
}

function aesEncryptBlock(w: Uint32Array, input: Uint8Array, inOffset: number, output: Uint8Array, outOffset: number) {
  const s = new Uint8Array(16);
  for (let i = 0; i < 16; i++) s[i] = input[inOffset + i];

  // Round 0
  for (let c = 0; c < 4; c++) {
    const wi = w[c];
    s[c * 4] ^= (wi >>> 24) & 0xff;
    s[c * 4 + 1] ^= (wi >>> 16) & 0xff;
    s[c * 4 + 2] ^= (wi >>> 8) & 0xff;
    s[c * 4 + 3] ^= wi & 0xff;
  }

  // Rounds 1 to 13
  for (let r = 1; r <= 13; r++) {
    const u0 = SBOX[s[0]], u4 = SBOX[s[4]], u8 = SBOX[s[8]], u12 = SBOX[s[12]];
    const u1 = SBOX[s[5]], u5 = SBOX[s[9]], u9 = SBOX[s[13]], u13 = SBOX[s[1]];
    const u2 = SBOX[s[10]], u6 = SBOX[s[14]], u10 = SBOX[s[2]], u14 = SBOX[s[6]];
    const u3 = SBOX[s[15]], u7 = SBOX[s[3]], u11 = SBOX[s[7]], u15 = SBOX[s[11]];

    const w0 = w[r * 4], w1 = w[r * 4 + 1], w2 = w[r * 4 + 2], w3 = w[r * 4 + 3];

    s[0] = xtime(u0 ^ u1) ^ u1 ^ u2 ^ u3 ^ ((w0 >>> 24) & 0xff);
    s[1] = xtime(u1 ^ u2) ^ u2 ^ u3 ^ u0 ^ ((w0 >>> 16) & 0xff);
    s[2] = xtime(u2 ^ u3) ^ u3 ^ u0 ^ u1 ^ ((w0 >>> 8) & 0xff);
    s[3] = xtime(u3 ^ u0) ^ u0 ^ u1 ^ u2 ^ (w0 & 0xff);

    s[4] = xtime(u4 ^ u5) ^ u5 ^ u6 ^ u7 ^ ((w1 >>> 24) & 0xff);
    s[5] = xtime(u5 ^ u6) ^ u6 ^ u7 ^ u4 ^ ((w1 >>> 16) & 0xff);
    s[6] = xtime(u6 ^ u7) ^ u7 ^ u4 ^ u5 ^ ((w1 >>> 8) & 0xff);
    s[7] = xtime(u7 ^ u4) ^ u4 ^ u5 ^ u6 ^ (w1 & 0xff);

    s[8] = xtime(u8 ^ u9) ^ u9 ^ u10 ^ u11 ^ ((w2 >>> 24) & 0xff);
    s[9] = xtime(u9 ^ u10) ^ u10 ^ u11 ^ u8 ^ ((w2 >>> 16) & 0xff);
    s[10] = xtime(u10 ^ u11) ^ u11 ^ u8 ^ u9 ^ ((w2 >>> 8) & 0xff);
    s[11] = xtime(u11 ^ u8) ^ u8 ^ u9 ^ u10 ^ (w2 & 0xff);

    s[12] = xtime(u12 ^ u13) ^ u13 ^ u14 ^ u15 ^ ((w3 >>> 24) & 0xff);
    s[13] = xtime(u13 ^ u14) ^ u14 ^ u15 ^ u12 ^ ((w3 >>> 16) & 0xff);
    s[14] = xtime(u14 ^ u15) ^ u15 ^ u12 ^ u13 ^ ((w3 >>> 8) & 0xff);
    s[15] = xtime(u15 ^ u12) ^ u12 ^ u13 ^ u14 ^ (w3 & 0xff);
  }

  // Round 14
  const u0 = SBOX[s[0]], u4 = SBOX[s[4]], u8 = SBOX[s[8]], u12 = SBOX[s[12]];
  const u1 = SBOX[s[5]], u5 = SBOX[s[9]], u9 = SBOX[s[13]], u13 = SBOX[s[1]];
  const u2 = SBOX[s[10]], u6 = SBOX[s[14]], u10 = SBOX[s[2]], u14 = SBOX[s[6]];
  const u3 = SBOX[s[15]], u7 = SBOX[s[3]], u11 = SBOX[s[7]], u15 = SBOX[s[11]];

  const w0 = w[56], w1 = w[57], w2 = w[58], w3 = w[59];
  output[outOffset] = u0 ^ ((w0 >>> 24) & 0xff);
  output[outOffset + 1] = u1 ^ ((w0 >>> 16) & 0xff);
  output[outOffset + 2] = u2 ^ ((w0 >>> 8) & 0xff);
  output[outOffset + 3] = u3 ^ (w0 & 0xff);

  output[outOffset + 4] = u4 ^ ((w1 >>> 24) & 0xff);
  output[outOffset + 5] = u5 ^ ((w1 >>> 16) & 0xff);
  output[outOffset + 6] = u6 ^ ((w1 >>> 8) & 0xff);
  output[outOffset + 7] = u7 ^ (w1 & 0xff);

  output[outOffset + 8] = u8 ^ ((w2 >>> 24) & 0xff);
  output[outOffset + 9] = u9 ^ ((w2 >>> 16) & 0xff);
  output[outOffset + 10] = u10 ^ ((w2 >>> 8) & 0xff);
  output[outOffset + 11] = u11 ^ (w2 & 0xff);

  output[outOffset + 12] = u12 ^ ((w3 >>> 24) & 0xff);
  output[outOffset + 13] = u13 ^ ((w3 >>> 16) & 0xff);
  output[outOffset + 14] = u14 ^ ((w3 >>> 8) & 0xff);
  output[outOffset + 15] = u15 ^ (w3 & 0xff);
}

// GHASH GF(2^128)
function ghashMul(x: Uint8Array, y: Uint8Array): Uint8Array {
  const z = new Uint32Array(4);
  const v = new Uint32Array(4);
  const yView = new DataView(y.buffer, y.byteOffset, 16);
  v[0] = yView.getUint32(0, false);
  v[1] = yView.getUint32(4, false);
  v[2] = yView.getUint32(8, false);
  v[3] = yView.getUint32(12, false);

  for (let i = 0; i < 16; i++) {
    const byte = x[i];
    for (let j = 7; j >= 0; j--) {
      if ((byte >>> j) & 1) {
        z[0] ^= v[0];
        z[1] ^= v[1];
        z[2] ^= v[2];
        z[3] ^= v[3];
      }
      const lsb = v[3] & 1;
      v[3] = ((v[3] >>> 1) | ((v[2] & 1) << 31)) >>> 0;
      v[2] = ((v[2] >>> 1) | ((v[1] & 1) << 31)) >>> 0;
      v[1] = ((v[1] >>> 1) | ((v[0] & 1) << 31)) >>> 0;
      v[0] = (v[0] >>> 1) >>> 0;
      if (lsb) {
        v[0] ^= 0xe1000000;
      }
    }
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, z[0], false);
  outView.setUint32(4, z[1], false);
  outView.setUint32(8, z[2], false);
  outView.setUint32(12, z[3], false);
  return out;
}

function ghash(H: Uint8Array, data: Uint8Array): Uint8Array {
  let y = new Uint8Array(16);
  for (let i = 0; i < data.length; i += 16) {
    const block = data.subarray(i, i + 16);
    for (let j = 0; j < 16; j++) {
      y[j] ^= block[j];
    }
    const nextY = ghashMul(y, H);
    y = new Uint8Array(nextY);
  }
  return y;
}

function aesGcmEncrypt(keyBytes: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const w = expandKey(keyBytes);

  const H = new Uint8Array(16);
  aesEncryptBlock(w, new Uint8Array(16), 0, H, 0);

  const J0 = new Uint8Array(16);
  J0.set(iv);
  J0[15] = 1;

  const CB = new Uint8Array(J0);
  const incCB = () => {
    for (let i = 15; i >= 12; i--) {
      CB[i] = (CB[i] + 1) & 0xff;
      if (CB[i] !== 0) break;
    }
  };
  incCB();

  const ciphertext = new Uint8Array(plaintext.length);
  const streamBlock = new Uint8Array(16);
  for (let i = 0; i < plaintext.length; i += 16) {
    aesEncryptBlock(w, CB, 0, streamBlock, 0);
    const chunkLen = Math.min(16, plaintext.length - i);
    for (let j = 0; j < chunkLen; j++) {
      ciphertext[i + j] = plaintext[i + j] ^ streamBlock[j];
    }
    incCB();
  }

  const padLen = (ciphertext.length % 16 === 0) ? 0 : 16 - (ciphertext.length % 16);
  const ghashInput = new Uint8Array(ciphertext.length + padLen + 16);
  ghashInput.set(ciphertext);
  const ghashView = new DataView(ghashInput.buffer, ghashInput.byteOffset, ghashInput.byteLength);
  const bitLen = ciphertext.length * 8;
  ghashView.setUint32(ghashInput.length - 4, bitLen >>> 0, false);
  ghashView.setUint32(ghashInput.length - 8, Math.floor(bitLen / 0x100000000), false);

  const S = ghash(H, ghashInput);

  const J0Enc = new Uint8Array(16);
  aesEncryptBlock(w, J0, 0, J0Enc, 0);
  const tag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    tag[i] = S[i] ^ J0Enc[i];
  }

  const out = new Uint8Array(ciphertext.length + 16);
  out.set(ciphertext);
  out.set(tag, ciphertext.length);
  return out;
}

function aesGcmDecrypt(keyBytes: Uint8Array, iv: Uint8Array, combined: Uint8Array): Uint8Array {
  if (combined.length < 16) throw new Error('Ciphertext too short');
  const ciphertext = combined.subarray(0, combined.length - 16);
  const expectedTag = combined.subarray(combined.length - 16);

  const w = expandKey(keyBytes);

  const H = new Uint8Array(16);
  aesEncryptBlock(w, new Uint8Array(16), 0, H, 0);

  const J0 = new Uint8Array(16);
  J0.set(iv);
  J0[15] = 1;

  const padLen = (ciphertext.length % 16 === 0) ? 0 : 16 - (ciphertext.length % 16);
  const ghashInput = new Uint8Array(ciphertext.length + padLen + 16);
  ghashInput.set(ciphertext);
  const ghashView = new DataView(ghashInput.buffer, ghashInput.byteOffset, ghashInput.byteLength);
  const bitLen = ciphertext.length * 8;
  ghashView.setUint32(ghashInput.length - 4, bitLen >>> 0, false);
  ghashView.setUint32(ghashInput.length - 8, Math.floor(bitLen / 0x100000000), false);

  const S = ghash(H, ghashInput);

  const J0Enc = new Uint8Array(16);
  aesEncryptBlock(w, J0, 0, J0Enc, 0);
  let diff = 0;
  for (let i = 0; i < 16; i++) {
    const computedTagByte = S[i] ^ J0Enc[i];
    diff |= computedTagByte ^ expectedTag[i];
  }
  if (diff !== 0) {
    throw new Error('Authentication tag mismatch');
  }

  const CB = new Uint8Array(J0);
  const incCB = () => {
    for (let i = 15; i >= 12; i--) {
      CB[i] = (CB[i] + 1) & 0xff;
      if (CB[i] !== 0) break;
    }
  };
  incCB();

  const plaintext = new Uint8Array(ciphertext.length);
  const streamBlock = new Uint8Array(16);
  for (let i = 0; i < ciphertext.length; i += 16) {
    aesEncryptBlock(w, CB, 0, streamBlock, 0);
    const chunkLen = Math.min(16, ciphertext.length - i);
    for (let j = 0; j < chunkLen; j++) {
      plaintext[i + j] = ciphertext[i + j] ^ streamBlock[j];
    }
    incCB();
  }

  return plaintext;
}

// =========================================================================
// High-Level Empanel Cryptographic API (Seamless Hybrid WebCrypto + Fallback)
// =========================================================================

/**
 * Derives a deterministic one-way Room ID from the PIN.
 */
export async function deriveRoomId(pin: string): Promise<string> {
  const clean = normalizePin(pin);
  const data = new TextEncoder().encode(`${ROOM_SALT}:${clean}`);

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fall through to pure JS fallback
    }
  }

  const hash = sha256(data);
  return Array.from(hash.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives an AES-256-GCM key from the 6-character PIN using PBKDF2.
 */
export async function deriveKeyFromPin(pin: string): Promise<EmpanelKey> {
  const clean = normalizePin(pin);
  const pinBytes = new TextEncoder().encode(clean);

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        pinBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return await window.crypto.subtle.deriveKey(
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
    } catch (e) {
      // Fall through to pure JS fallback
    }
  }

  const rawKey = pbkdf2HmacSha256(pinBytes, PBKDF2_SALT, 100000, 32);
  return { __raw: rawKey };
}

export interface EncryptedEnvelope {
  iv: string; // Base64 12-byte IV
  ciphertext: string; // Base64 ciphertext with authentication tag
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
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
export async function encryptPayload<T>(key: EmpanelKey, data: T): Promise<EncryptedEnvelope> {
  const iv = getRandomBytes(12);
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  if (!('__raw' in key) && typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key as CryptoKey,
        encodedData
      );

      return {
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(encryptedBuffer),
      };
    } catch (e) {
      // Fall through to pure JS fallback if subtle fails
    }
  }

  const rawKey = '__raw' in key ? key.__raw : new Uint8Array(32);
  const combined = aesGcmEncrypt(rawKey, iv, encodedData);
  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(combined),
  };
}

/**
 * Decrypts an EncryptedEnvelope with AES-256-GCM and parses as JSON.
 */
export async function decryptPayload<T>(key: EmpanelKey, envelope: EncryptedEnvelope): Promise<T> {
  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const ciphertextBuffer = base64ToArrayBuffer(envelope.ciphertext);

  if (!('__raw' in key) && typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key as CryptoKey,
        ciphertextBuffer
      );

      const decoded = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decoded) as T;
    } catch (e) {
      // If subtle fails (e.g. tag mismatch or context issue), attempt pure JS fallback if key is available
      if (!('__raw' in key)) throw e;
    }
  }

  const rawKey = '__raw' in key ? key.__raw : new Uint8Array(32);
  const decryptedBytes = aesGcmDecrypt(rawKey, iv, new Uint8Array(ciphertextBuffer));
  const decoded = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(decoded) as T;
}

/**
 * Creates an ephemeral 32-byte authentication challenge.
 */
export function createAuthChallenge(): string {
  const bytes = getRandomBytes(32);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes an authentication response proof for a challenge using the derived key.
 */
export async function computeAuthProof(key: EmpanelKey, challenge: string): Promise<string> {
  const envelope = await encryptPayload(key, { challenge, timestamp: Date.now() });
  return JSON.stringify(envelope);
}

/**
 * Verifies an authentication proof against the challenge.
 */
export async function verifyAuthProof(
  key: EmpanelKey,
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
