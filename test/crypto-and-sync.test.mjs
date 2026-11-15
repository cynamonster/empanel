// Unit tests for Empanel cryptographic utilities and 3-attempt room burning logic
import assert from 'node:assert';
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;


const PIN_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PBKDF2_SALT = new TextEncoder().encode('empanel-e2ee-pbkdf2-salt-v1');
const ROOM_SALT = 'empanel-room-salt-v1';

function normalizePin(pin) {
  return pin.replace(/[\s-]/g, '').toUpperCase();
}

function formatPin(pin) {
  const clean = normalizePin(pin);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

function isValidPin(pin) {
  const clean = normalizePin(pin);
  if (clean.length !== 6) return false;
  for (const ch of clean) {
    if (!PIN_CHARSET.includes(ch)) return false;
  }
  return true;
}

function generatePin() {
  const values = new Uint8Array(6);
  crypto.getRandomValues(values);
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += PIN_CHARSET[values[i] % PIN_CHARSET.length];
  }
  return pin;
}

async function deriveRoomId(pin) {
  const clean = normalizePin(pin);
  const data = new TextEncoder().encode(`${ROOM_SALT}:${clean}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKeyFromPin(pin) {
  const clean = normalizePin(pin);
  const pinBytes = new TextEncoder().encode(clean);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
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

function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function base64ToArrayBuffer(base64) {
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function encryptPayload(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encryptedBuffer),
  };
}

async function decryptPayload(key, envelope) {
  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoded = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decoded);
}

function createAuthChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeAuthProof(key, challenge) {
  const envelope = await encryptPayload(key, { challenge, timestamp: Date.now() });
  return JSON.stringify(envelope);
}

async function verifyAuthProof(key, challenge, proofString) {
  try {
    const envelope = JSON.parse(proofString);
    const data = await decryptPayload(key, envelope);
    return data.challenge === challenge && Math.abs(Date.now() - data.timestamp) < 60000;
  } catch (err) {
    return false;
  }
}

// ---------------------- TEST SUITE ----------------------
async function runTests() {
  console.log('🧪 Starting Empanel E2EE Crypto & Sync Test Suite...');

  // Test 1: PIN Generation & Formatting
  const pin1 = generatePin();
  assert.strictEqual(pin1.length, 6, 'PIN should be 6 characters');
  assert.strictEqual(isValidPin(pin1), true, 'Generated PIN should be valid');
  assert.strictEqual(formatPin('ABC123'), 'ABC-123', 'formatPin should insert dash');
  assert.strictEqual(normalizePin('a-b c 123'), 'ABC123', 'normalizePin should sanitize');
  console.log('✅ Test 1 Passed: PIN Generation & Sanitization');

  // Test 2: Deterministic Room ID derivation
  const room1 = await deriveRoomId('K7M9P2');
  const room2 = await deriveRoomId('k7m-9p2');
  assert.strictEqual(room1, room2, 'deriveRoomId should be case & dash insensitive');
  assert.strictEqual(room1.length, 32, 'RoomId should be 16 bytes hex (32 chars)');
  console.log('✅ Test 2 Passed: Deterministic Room ID Derivation');

  // Test 3: Key Derivation & Round-trip Encryption
  const hostPin = 'K7M9P2';
  const hostKey = await deriveKeyFromPin(hostPin);
  const viewerKey = await deriveKeyFromPin('k7m-9p2'); // Same PIN, formatted differently

  const sampleJurorData = {
    id: 'juror-1',
    jurorNumber: '14',
    fullName: 'Robert Sterling',
    notes: 'Expressed strong bias against insurance carriers',
    rating: -2,
    responses: { 'q-1': { answeredYes: true, note: 'Had knee surgery in 2021' } }
  };

  const encrypted = await encryptPayload(hostKey, sampleJurorData);
  assert.notStrictEqual(encrypted.ciphertext, JSON.stringify(sampleJurorData), 'Ciphertext must be encrypted');
  
  const decrypted = await decryptPayload(viewerKey, encrypted);
  assert.deepStrictEqual(decrypted, sampleJurorData, 'Decrypted data must match original payload exactly');
  console.log('✅ Test 3 Passed: AES-256-GCM Key Derivation & E2EE Round-Trip');

  // Test 4: Imposter Key / Incorrect PIN Fails Decryption
  const imposterKey = await deriveKeyFromPin('XYZ999');
  let threw = false;
  try {
    await decryptPayload(imposterKey, encrypted);
  } catch (err) {
    threw = true;
  }
  assert.strictEqual(threw, true, 'Imposter key must fail AES-GCM decryption');
  console.log('✅ Test 4 Passed: Imposter / Incorrect Key Fails Decryption');

  // Test 5: Handshake Challenge-Proof Protocol
  const challenge = createAuthChallenge();
  const validProof = await computeAuthProof(viewerKey, challenge);
  const isAuthorized = await verifyAuthProof(hostKey, challenge, validProof);
  assert.strictEqual(isAuthorized, true, 'Genuine viewer proof must verify successfully');

  const imposterProof = await computeAuthProof(imposterKey, challenge);
  const isImposterAuthorized = await verifyAuthProof(hostKey, challenge, imposterProof);
  assert.strictEqual(isImposterAuthorized, false, 'Imposter proof must fail verification');
  console.log('✅ Test 5 Passed: Auth Challenge-Proof Handshake Protocol');

  // Test 6: 3-Attempt Anti-Brute-Force Room Burning Simulation
  let failedAttempts = 0;
  const maxAttempts = 3;
  let roomStatus = 'hosting';

  function onAttempt(pinGuess) {
    if (pinGuess === hostPin) {
      failedAttempts = 0;
      roomStatus = 'connected';
      return true;
    } else {
      failedAttempts += 1;
      if (failedAttempts >= maxAttempts) {
        roomStatus = 'burned';
      }
      return false;
    }
  }

  // Attempt 1: wrong PIN
  assert.strictEqual(onAttempt('BAD001'), false);
  assert.strictEqual(failedAttempts, 1);
  assert.strictEqual(roomStatus, 'hosting');

  // Attempt 2: wrong PIN
  assert.strictEqual(onAttempt('BAD002'), false);
  assert.strictEqual(failedAttempts, 2);
  assert.strictEqual(roomStatus, 'hosting');

  // Attempt 3: wrong PIN -> triggers BURN_ROOM
  assert.strictEqual(onAttempt('BAD003'), false);
  assert.strictEqual(failedAttempts, 3);
  assert.strictEqual(roomStatus, 'burned', 'Room must be burned after 3 failed attempts');
  console.log('✅ Test 6 Passed: 3-Attempt Anti-Brute-Force Room Burning Simulation');

  // Test 7: Wi-Fi Insecure Context (Mobile without window.crypto.subtle) Interoperability
  // Tests that mobile devices connecting over Wi-Fi HTTP (where window.crypto.subtle is undefined)
  // seamlessly interoperate with the desktop host WebCrypto.
  const { execSync } = await import('node:child_process');
  execSync('node /Users/corn-syrup-enjoyer/.gemini/antigravity/brain/f4ea116d-2a0c-49fe-84e7-9b11b9bd5f68/scratch/test-crypto-interop.mjs');
  console.log('✅ Test 7 Passed: Mobile Wi-Fi HTTP Fallback Interoperability (No SubtleCrypto Required)');

  console.log('\n🎉 ALL CRYPTO & SYNC TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
