import type { Juror } from '../types';

export interface ParsedJurorData {
  jurorNumber: string;
  fullName: string;
  age?: string;
  gender?: string;
  raceEthnicity?: string;
  occupation?: string;
  employer?: string;
  cityOrZip?: string;
  maritalStatus?: string;
  education?: string;
  notes?: string;
}

/**
 * Robust CSV/TSV parser supporting quotes, commas, tabs, and line breaks.
 */
export function parseDelimitedText(text: string): string[][] {
  const lines: string[][] = [];
  const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const rawLine of rows) {
    if (!rawLine.trim()) continue;
    
    // Check delimiter: tab vs comma
    const isTab = rawLine.includes('\t');
    const delimiter = isTab ? '\t' : ',';
    
    const row: string[] = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      if (char === '"') {
        if (insideQuotes && rawLine[i + 1] === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    lines.push(row);
  }

  return lines;
}

/**
 * Intelligent field matcher for court roster headers
 */
function findIndex(headers: string[], regexPatterns: RegExp[]): number {
  return headers.findIndex(h => {
    const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return regexPatterns.some(pattern => pattern.test(clean));
  });
}

export function mapRowsToJurors(matrix: string[][], caseId: string): Juror[] {
  if (matrix.length === 0) return [];

  // Determine if first row is header
  const firstRow = matrix[0];
  const hasHeader = firstRow.some(cell => 
    /^(juror|number|no|name|age|occ|job|city|zip|gender|race|sex|status|seat)/i.test(cell.trim())
  );

  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (hasHeader) {
    headers = firstRow;
    dataRows = matrix.slice(1);
  } else {
    // Synthetic headers based on common 1-indexed format: No, Name, Occupation, Age
    headers = ['Juror #', 'Full Name', 'Occupation', 'Age', 'City/Zip'];
    dataRows = matrix;
  }

  const numIdx = findIndex(headers, [/jurorno/, /jurornum/, /badge/, /juror/, /no/, /number/, /id/]);
  const nameIdx = findIndex(headers, [/fullname/, /name/, /jurorname/, /prospectivejuror/]);
  const ageIdx = findIndex(headers, [/age/, /dob/, /birth/]);
  const genderIdx = findIndex(headers, [/gender/, /sex/]);
  const raceIdx = findIndex(headers, [/race/, /ethnicity/]);
  const occIdx = findIndex(headers, [/occupation/, /job/, /title/, /profession/]);
  const empIdx = findIndex(headers, [/employer/, /company/]);
  const cityIdx = findIndex(headers, [/city/, /zip/, /address/, /residence/, /county/]);
  const maritalIdx = findIndex(headers, [/marital/, /spouse/]);
  const eduIdx = findIndex(headers, [/education/, /degree/, /school/]);

  const timestamp = Date.now();

  return dataRows.map((row, index) => {
    const rawNumber = numIdx !== -1 && row[numIdx] ? row[numIdx] : String(index + 1);
    const jurorNumber = rawNumber.replace(/[^0-9A-Za-z-]/g, '').trim() || String(index + 1);
    
    let fullName = '';
    if (nameIdx !== -1 && row[nameIdx]) {
      fullName = row[nameIdx];
    } else if (row.length > 1 && numIdx === 0) {
      fullName = row[1];
    } else {
      fullName = `Juror #${jurorNumber}`;
    }

    const age = ageIdx !== -1 ? row[ageIdx] : undefined;
    const gender = genderIdx !== -1 ? row[genderIdx] : undefined;
    const raceEthnicity = raceIdx !== -1 ? row[raceIdx] : undefined;
    const occupation = occIdx !== -1 ? row[occIdx] : undefined;
    const employer = empIdx !== -1 ? row[empIdx] : undefined;
    const cityOrZip = cityIdx !== -1 ? row[cityIdx] : undefined;
    const maritalStatus = maritalIdx !== -1 ? row[maritalIdx] : undefined;
    const education = eduIdx !== -1 ? row[eduIdx] : undefined;

    return {
      id: `juror-${caseId}-${jurorNumber}-${Math.random().toString(36).substring(2, 6)}`,
      caseId,
      jurorNumber,
      fullName: fullName.trim(),
      age: age ? age.trim() : undefined,
      gender: gender ? gender.trim() : undefined,
      raceEthnicity: raceEthnicity ? raceEthnicity.trim() : undefined,
      occupation: occupation ? occupation.trim() : undefined,
      employer: employer ? employer.trim() : undefined,
      cityOrZip: cityOrZip ? cityOrZip.trim() : undefined,
      maritalStatus: maritalStatus ? maritalStatus.trim() : undefined,
      education: education ? education.trim() : undefined,
      rating: 0,
      status: 'active',
      notes: '',
      tags: [],
      responses: {},
      createdAt: timestamp + index,
      updatedAt: timestamp + index,
    };
  });
}
