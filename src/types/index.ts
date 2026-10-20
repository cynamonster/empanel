export type JurorStatus = 
  | 'active'       // In the pool / in play
  | 'seated'       // In the jury box
  | 'alternate'    // Alternate juror
  | 'struck_plaintiff'  // Peremptory strike by Plaintiff/Prosecution
  | 'struck_defense'    // Peremptory strike by Defense
  | 'cause_granted'     // Excused for cause
  | 'cause_denied'      // Cause challenge raised but denied by judge
  | 'dismissed';        // Excused by court (hardship/etc.)

export interface Juror {
  id: string;
  caseId: string;
  jurorNumber: string;
  fullName: string;
  age?: number | string;
  gender?: string;
  raceEthnicity?: string;
  occupation?: string;
  employer?: string;
  cityState?: string;
  cityOrZip?: string;
  maritalStatus?: string;
  education?: string;
  priorJuryService?: string;
  
  // Tactical ratings & assessment
  rating: number; // -3 (Strong Opponent Favorable) to 0 (Neutral) to +3 (Strong Our Favorable)
  status: JurorStatus;
  statusNotes?: string;
  notes: string;
  tags?: string[];
  
  // Tactical notes to self on strike intent
  strikeIntent?: 'none' | 'strike_peremptory' | 'strike_cause';
  strikeIntentNote?: string;
  
  // Seating assignment
  seatNumber?: number; // 1-12/14 for box, or grid index
  isAlternate?: boolean;
  
  // Hand raises / question responses: map of questionId -> response boolean or note
  responses: Record<string, { answeredYes: boolean; note?: string }>;
  
  createdAt: number;
  updatedAt: number;
}

export type CaseType = 'civil' | 'criminal';

export interface Case {
  id: string;
  name: string;
  caseNumber?: string;
  court?: string;
  judge?: string;
  caseType: CaseType;
  ourSide: 'plaintiff_prosecution' | 'defense';
  
  // Strike rules
  plaintiffStrikesAllowed: number;
  defenseStrikesAllowed: number;
  alternateStrikesAllowed: number;
  
  // Layout preferences
  layoutMode: 'box' | 'grid';
  boxSize: number; // typically 6, 8, 12, 14
  alternateCount: number; // typically 1-4
  gridRows: number;
  gridCols: number;
  galleryGutters?: 'none' | '1';
  galleryOrigin?: 'bottom-left' | 'top-left' | 'top-right';
  customSplits?: number[];
  galleryOrder?: string[]; // Array of juror IDs to preserve dragged gallery order
  autoFillPanel?: boolean; // Auto-prefill and pull in sequentially available jurors

  createdAt: number;
  updatedAt: number;
}

export interface Question {
  id: string;
  caseId: string;
  text: string;
  category?: string;
  order: number;
  createdAt: number;
}

export interface CauseChallenge {
  id: string;
  caseId: string;
  jurorId: string;
  jurorNumber: string;
  jurorName: string;
  raisedBy: 'our_side' | 'opponent';
  grounds: string; // e.g., "Expressed inability to be impartial on damages"
  ruling: 'pending' | 'granted' | 'denied';
  judgeComment?: string;
  timestamp: number;
}

export interface PeremptoryStrikeAction {
  id: string;
  caseId: string;
  jurorId: string;
  jurorNumber: string;
  jurorName: string;
  side: 'plaintiff_prosecution' | 'defense';
  round: number;
  timestamp: number;
  notes?: string;
}
