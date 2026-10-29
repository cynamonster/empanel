import Dexie, { type EntityTable } from 'dexie';
import type { Case, Juror, Question, CauseChallenge, PeremptoryStrikeAction } from '../types';

export interface AppSetting {
  key: string;
  value: any;
}

export class VoirDireDatabase extends Dexie {
  cases!: EntityTable<Case, 'id'>;
  jurors!: EntityTable<Juror, 'id'>;
  questions!: EntityTable<Question, 'id'>;
  causeChallenges!: EntityTable<CauseChallenge, 'id'>;
  peremptoryStrikes!: EntityTable<PeremptoryStrikeAction, 'id'>;
  appSettings!: EntityTable<AppSetting, 'key'>;

  constructor() {
    super('VoirDireDB');
    this.version(1).stores({
      cases: 'id, name, caseType, updatedAt',
      jurors: 'id, caseId, jurorNumber, status, seatNumber, rating, updatedAt',
      questions: 'id, caseId, order',
      causeChallenges: 'id, caseId, jurorId, ruling, timestamp',
      peremptoryStrikes: 'id, caseId, jurorId, side, round, timestamp'
    });
    this.version(2).stores({
      appSettings: 'key'
    });
  }
}

export const db = new VoirDireDatabase();

export async function getSavedViewerPin(): Promise<string | null> {
  try {
    const setting = await db.appSettings.get('viewerPin');
    if (setting?.value) return setting.value;
  } catch (e) {}
  try {
    return localStorage.getItem('empanel_viewer_pin') || null;
  } catch (e) {
    return null;
  }
}

export async function saveViewerPin(pin: string): Promise<void> {
  try {
    await db.appSettings.put({ key: 'viewerPin', value: pin });
  } catch (e) {}
  try {
    localStorage.setItem('empanel_viewer_pin', pin);
  } catch (e) {}
}

export async function clearSavedViewerPin(): Promise<void> {
  try {
    await db.appSettings.delete('viewerPin');
  } catch (e) {}
  try {
    localStorage.removeItem('empanel_viewer_pin');
  } catch (e) {}
}

export async function createDefaultCase(type: 'civil' | 'criminal' = 'criminal'): Promise<Case> {
  const isCriminal = type === 'criminal';
  const newCase: Case = {
    id: `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: isCriminal ? 'New Criminal Trial' : 'New Civil Trial',
    caseType: type,
    ourSide: 'plaintiff_prosecution',
    plaintiffStrikesAllowed: 3,
    defenseStrikesAllowed: 3,
    alternateStrikesAllowed: 1,
    layoutMode: 'box',
    boxSize: isCriminal ? 6 : 12,
    alternateCount: isCriminal ? 1 : 2,
    gridRows: 4,
    gridCols: 8,
    galleryGutters: '1',
    galleryOrigin: 'bottom-left',
    autoFillPanel: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.cases.add(newCase);
  return newCase;
}
