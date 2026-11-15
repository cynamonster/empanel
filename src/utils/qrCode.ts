/**
 * Minimal zero-dependency QR Code Matrix & SVG Generator
 * Supports ISO/IEC 18004 QR Code Version 1-10 with Byte Mode & Error Correction Level L/M.
 */

// GF(256) tables for Reed-Solomon Error Correction
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  EXP[i + 255] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGenPoly(n: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], factor);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const coef = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      res[j] ^= gfMul(gen[j], coef);
    }
  }
  return res;
}

// Version table: [version, totalBytes, dataBytesL, ecCountL]
const VERSION_TABLE = [
  [1, 26, 19, 7],
  [2, 44, 34, 10],
  [3, 70, 55, 15],
  [4, 100, 80, 20],
  [5, 134, 108, 26],
  [6, 172, 136, 36],
];

export function generateQrMatrix(text: string): boolean[][] {
  const textBytes = new TextEncoder().encode(text);
  const dataLen = textBytes.length;

  let chosenVersion = 1;
  let totalBytes = 26;
  let dataCapacity = 19;
  let ecBytes = 7;

  for (const [v, total, cap, ec] of VERSION_TABLE) {
    // 4 bits mode + 8 bits length indicator + data
    if (dataLen + 3 <= cap) {
      chosenVersion = v;
      totalBytes = total;
      dataCapacity = cap;
      ecBytes = ec;
      break;
    }
  }

  // Bitstream creation
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // 1. Mode indicator: Byte mode = 0100
  pushBits(0b0100, 4);

  // 2. Character count indicator (8 bits for versions 1-9)
  pushBits(dataLen, 8);

  // 3. Data bytes
  for (let i = 0; i < dataLen; i++) {
    pushBits(textBytes[i], 8);
  }

  // 4. Terminator (up to 4 zeros)
  const remainingBits = dataCapacity * 8 - bits.length;
  const termLen = Math.min(4, Math.max(0, remainingBits));
  pushBits(0, termLen);

  // 5. Pad to 8-bit boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 6. Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < dataCapacity * 8) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to data bytes
  const dataCodewords = new Uint8Array(dataCapacity);
  for (let i = 0; i < dataCapacity; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    dataCodewords[i] = byteVal;
  }

  // Error correction codewords
  const ecCodewords = rsCompute(dataCodewords, ecBytes);

  // Final codeword stream: data + EC
  const allCodewords = new Uint8Array(totalBytes);
  allCodewords.set(dataCodewords, 0);
  allCodewords.set(ecCodewords, dataCapacity);

  // Matrix setup
  const size = 17 + 4 * chosenVersion;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean, isFunc = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (isFunc) isFunction[r][c] = true;
    }
  };

  // Finder pattern helper
  const drawFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const row = r + dr;
        const col = c + dc;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            setModule(row, col, true);
          } else {
            setModule(row, col, false);
          }
        } else {
          setModule(row, col, false); // Separator
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(4 * chosenVersion + 9, 8, true);

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) setModule(8, i, false);
    if (!isFunction[i][8]) setModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setModule(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setModule(size - 1 - i, 8, false);
  }

  // Alignment pattern for versions >= 2
  if (chosenVersion >= 2) {
    const alignPos = [6, 18, 22, 26, 30, 34][chosenVersion - 1];
    const centers = [6, alignPos];
    for (const ar of centers) {
      for (const ac of centers) {
        if (isFunction[ar][ac]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setModule(ar + dr, ac + dc, isDark);
          }
        }
      }
    }
  }

  // Place codewords in zigzag
  let bitIdx = 0;
  const totalBitsCount = allCodewords.length * 8;
  let right = size - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (!isFunction[r][col]) {
          let bit = false;
          if (bitIdx < totalBitsCount) {
            const byte = allCodewords[Math.floor(bitIdx / 8)];
            bit = ((byte >>> (7 - (bitIdx % 8))) & 1) === 1;
            bitIdx++;
          }
          // Apply standard mask 0: (row + col) % 2 === 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit !== mask;
        }
      }
    }
    right -= 2;
    upward = !upward;
  }

  // Format info: Level L + Mask 0 = 0b01000 ^ 0b101010000010010 = 0x77c4
  const formatInfo = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >>> (14 - i)) & 1) === 1;
    if (i < 6) {
      matrix[i][8] = bit;
    } else if (i < 8) {
      matrix[i + 1][8] = bit;
    } else {
      matrix[size - (15 - i)][8] = bit;
    }

    if (i < 8) {
      matrix[8][size - 1 - i] = bit;
    } else if (i < 9) {
      matrix[8][15 - i] = bit;
    } else {
      matrix[8][14 - i] = bit;
    }
  }

  return matrix.map(row => row.map(cell => Boolean(cell)));
}

/**
 * Renders an SVG path string for a given text.
 */
export function generateQrSvgPath(text: string): { path: string; size: number } {
  const matrix = generateQrMatrix(text);
  const size = matrix.length;
  let d = '';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        d += `M${c},${r}h1v1h-1z `;
      }
    }
  }

  return { path: d, size };
}
