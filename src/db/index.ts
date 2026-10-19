import Dexie, { type EntityTable } from 'dexie';
import type { Case, Juror, Question, CauseChallenge, PeremptoryStrikeAction } from '../types';

export class VoirDireDatabase extends Dexie {
  cases!: EntityTable<Case, 'id'>;
  jurors!: EntityTable<Juror, 'id'>;
  questions!: EntityTable<Question, 'id'>;
  causeChallenges!: EntityTable<CauseChallenge, 'id'>;
  peremptoryStrikes!: EntityTable<PeremptoryStrikeAction, 'id'>;

  constructor() {
    super('VoirDireDB');
    this.version(1).stores({
      cases: 'id, name, caseType, updatedAt',
      jurors: 'id, caseId, jurorNumber, status, seatNumber, rating, updatedAt',
      questions: 'id, caseId, order',
      causeChallenges: 'id, caseId, jurorId, ruling, timestamp',
      peremptoryStrikes: 'id, caseId, jurorId, side, round, timestamp'
    });
  }
}

export const db = new VoirDireDatabase();

export async function createDefaultCase(type: 'civil' | 'criminal' = 'civil'): Promise<Case> {
  const isCivil = type === 'civil';
  const newCase: Case = {
    id: `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: isCivil ? 'New Civil Trial (3 Strikes)' : 'New Criminal Trial (6 Strikes)',
    caseType: type,
    ourSide: isCivil ? 'plaintiff_prosecution' : 'defense',
    plaintiffStrikesAllowed: isCivil ? 3 : 6,
    defenseStrikesAllowed: isCivil ? 3 : 6,
    alternateStrikesAllowed: 1,
    layoutMode: 'box',
    boxSize: 12,
    alternateCount: 2,
    gridRows: 4,
    gridCols: 8,
    galleryGutters: '1',
    galleryOrigin: 'bottom-left',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.cases.add(newCase);
  return newCase;
}
