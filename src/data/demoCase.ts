import type { Case, Juror, Question, CauseChallenge, PeremptoryStrikeAction } from '../types';

export function getDemoCaseData(): {
  caseData: Case;
  jurors: Juror[];
  questions: Question[];
  causeChallenges: CauseChallenge[];
  peremptoryStrikes: PeremptoryStrikeAction[];
} {
  const caseId = `demo-case-${Date.now()}`;
  const now = Date.now();

  const caseData: Case = {
    id: caseId,
    name: 'State of Texas v. Marcus Vance (Demo)',
    caseNumber: '24-CR-0842',
    court: '147th Criminal District Court',
    judge: 'Hon. Clifford Alvarez',
    caseType: 'criminal',
    ourSide: 'defense',
    plaintiffStrikesAllowed: 3, // Prosecution in 6-juror criminal trial
    defenseStrikesAllowed: 3,   // Defense in 6-juror criminal trial
    alternateStrikesAllowed: 1,
    layoutMode: 'grid', // Showcase the venire gallery grid by default
    boxSize: 6,         // Six-person criminal jury
    alternateCount: 1,  // 1 alternate juror
    gridRows: 4,
    gridCols: 8,
    galleryGutters: '1', // Default 1 central aisle
    galleryOrigin: 'bottom-left', // Default bottom-left
    autoFillPanel: true,
    createdAt: now,
    updatedAt: now,
  };

  const questions: Question[] = [
    {
      id: `q-demo-1`,
      caseId,
      text: 'Have you, a close family member, or a close friend ever been accused, arrested, or convicted of a criminal offense?',
      category: 'Criminal Justice Experience',
      order: 1,
      createdAt: now,
    },
    {
      id: `q-demo-2`,
      caseId,
      text: 'Do you believe law enforcement officers are naturally more truthful or credible than civilian witnesses simply because they wear a badge?',
      category: 'Police Credibility & Bias',
      order: 2,
      createdAt: now + 1,
    },
    {
      id: `q-demo-3`,
      caseId,
      text: 'If a defendant exercises their constitutional Fifth Amendment right not to testify, would you hold that against them or suspect guilt?',
      category: 'Constitutional Rights',
      order: 3,
      createdAt: now + 2,
    },
    {
      id: `q-demo-4`,
      caseId,
      text: 'Can you hold the State strictly to its high burden of proof beyond a reasonable doubt, and vote Not Guilty if any reasonable doubt remains?',
      category: 'Burden of Proof',
      order: 4,
      createdAt: now + 3,
    },
  ];

  const rawJurors = [
    { num: '1', name: 'Robert Chen', age: '46', g: 'Male', race: 'Asian', occ: 'Mechanical Systems Engineer', emp: 'Applied Materials', city: 'Austin 78759', rating: 2, tags: ['Engineer', 'Analytical', 'Proof Strict'], notes: 'Methodical and data-driven. Firm that State must prove each criminal element without assumption.' },
    { num: '2', name: 'Maria Elena Rodriguez', age: '39', g: 'Female', race: 'Hispanic', occ: 'Bilingual Elementary Teacher', emp: 'Austin ISD', city: 'Round Rock 78664', rating: -2, tags: ['5th Amend Issue', 'Strike Candidate'], notes: 'Stated she would wonder what defendant is hiding if he does not take the stand.' },
    { num: '3', name: 'David Miller', age: '54', g: 'Male', race: 'Caucasian', occ: 'Commercial Fleet Dispatcher', emp: 'Penske Logistics', city: 'Cedar Park 78613', rating: 1, tags: ['Former MP Reserve', 'Procedure'], notes: 'Former Army reserve military police. Respects procedural rights and formal chain-of-custody.' },
    { num: '4', name: 'Brianna Hayes', age: '29', g: 'Female', race: 'African American', occ: 'Community Organizer', emp: 'Austin Justice Coalition', city: 'Austin 78702', rating: 3, tags: ['Defense Favorite', 'Skeptical of Police'], notes: 'Vocal about systemic over-policing and faulty eyewitness identifications.' },
    { num: '5', name: 'Marcus Washington', age: '62', g: 'Male', race: 'African American', occ: 'Retired Postal Carrier', emp: 'USPS', city: 'Pflugerville 78660', rating: 1, tags: ['Retired', 'Fair Minded'], notes: 'Served 30 years with USPS. Calm, deliberative, strongly respects presumption of innocence.' },
    { num: '6', name: 'Sarah Jenkins', age: '33', g: 'Female', race: 'Caucasian', occ: 'Corporate Compliance Specialist', emp: 'Dell Technologies', city: 'Austin 78727', rating: 2, tags: ['Compliance', 'Chain of Custody'], notes: 'Understands forensic standard operating procedures and reasonable doubt thresholds.' },
    { num: '7', name: 'James O’Connor', age: '50', g: 'Male', race: 'Caucasian', occ: 'Independent General Contractor', emp: 'O’Connor Builders', city: 'Lakeway 78734', rating: 2, tags: ['Constitutionalist', 'Anti-Overreach'], notes: 'Expressed strong skepticism of government overreach and overcharging.' },
    { num: '8', name: 'Patricia Bailey', age: '57', g: 'Female', race: 'Caucasian', occ: 'Emergency Room RN', emp: 'St. David’s Medical', city: 'Austin 78705', rating: -3, tags: ['Police Family', 'Cause Candidate'], notes: 'Brother is a detective in the arresting division. Admitted she cannot view officer testimony neutrally.' },
    { num: '9', name: 'Carlos Gomez', age: '42', g: 'Male', race: 'Hispanic', occ: 'Heavy Diesel Mechanic', emp: 'Rush Truck Centers', city: 'Del Valle 78617', rating: 2, tags: ['Mechanic', 'Physical Evidence'], notes: 'Wants tangible physical/forensic evidence, not just conflicting witness statements.' },
    { num: '10', name: 'Hannah Scott', age: '25', g: 'Female', race: 'Caucasian', occ: 'Graduate Student (Sociology)', emp: 'UT Austin', city: 'Austin 78712', rating: 2, tags: ['Student', 'Fair Sentencing'], notes: 'Researches criminal justice reforms. Very receptive to defense reasonable doubt arguments.' },
    { num: '11', name: 'Thomas Wright', age: '68', g: 'Male', race: 'Caucasian', occ: 'Retired CFO', emp: 'KPMG', city: 'Georgetown 78626', rating: 0, tags: ['Retired Exec', 'Strict Law'], notes: 'Conservative demeanor, but explicitly confirmed he can hold State to beyond a reasonable doubt.' },
    { num: '12', name: 'Angela Brooks', age: '40', g: 'Female', race: 'African American', occ: 'Human Resources Director', emp: 'Whole Foods Market', city: 'Austin 78703', rating: 1, tags: ['HR', 'Objective'], notes: 'Balanced and attentive. Takes detailed notes; no preconceived opinions.' },
    { num: '13', name: 'Kevin Patel', age: '32', g: 'Male', race: 'South Asian', occ: 'Senior Risk Analyst', emp: 'Charles Schwab', city: 'Austin 78758', rating: 2, tags: ['Analytical', 'Probability'], notes: 'Probability expert. Said 90% certainty is not enough to convict when a person’s liberty is at stake.' },
    { num: '14', name: 'Linda Evans', age: '51', g: 'Female', race: 'Caucasian', occ: 'Executive Legal Assistant', emp: 'Private Law Firm', city: 'Buda 78610', rating: 0, tags: ['Legal Background'], notes: 'Familiar with court procedures and juror admonishments.' },
    { num: '15', name: 'Samuel Ramirez', age: '45', g: 'Male', race: 'Hispanic', occ: 'Licensed Commercial Electrician', emp: 'IBEW Local 520', city: 'Kyle 78640', rating: 1, tags: ['Union Member', 'Brother Arrested'], notes: 'Brother had previous arrest that was dismissed. Believes innocent people get charged.' },
    { num: '16', name: 'Dr. Rebecca Taylor', age: '37', g: 'Female', race: 'Caucasian', occ: 'Pediatric Dentist', emp: 'Cedar Smiles Practice', city: 'Cedar Park 78613', rating: 1, tags: ['Medical', 'Scientific'], notes: 'Demands scientific rigor from expert witnesses and crime lab analysts.' },
    { num: '17', name: 'Devon Richardson', age: '30', g: 'Male', race: 'African American', occ: 'Software DevOps Engineer', emp: 'Atlassian', city: 'Austin 78701', rating: 1, tags: ['Tech', 'Quiet'], notes: 'Quiet and attentive. Nodded during burden of proof explanation.' },
    { num: '18', name: 'Chloe Dubois', age: '44', g: 'Female', race: 'Caucasian', occ: 'Insurance Fraud Investigator', emp: 'State Farm', city: 'Round Rock 78681', rating: -2, tags: ['Investigator', 'Pro-Prosecution'], notes: 'Investigates fraudulent claims. Naturally suspicious of defense excuses.' },
    { num: '19', name: 'Arthur Pendelton', age: '71', g: 'Male', race: 'Caucasian', occ: 'Retired Rancher', emp: 'Self', city: 'Dripping Springs 78620', rating: -1, tags: ['Traditional', 'Pro-Law Enforcement'], notes: 'Stated he trusts police officers unconditionally unless proven corrupt.' },
    { num: '20', name: 'Jasmine Morales', age: '28', g: 'Female', race: 'Hispanic', occ: 'Social Media Marketing Manager', emp: 'Freelance', city: 'Austin 78745', rating: 1, tags: ['Creative', 'Empathy'], notes: 'Values fairness and hearing all context before making judgments.' },
    { num: '21', name: 'Victor Vance', age: '59', g: 'Male', race: 'Caucasian', occ: 'Commercial Freight Broker', emp: 'C.H. Robinson', city: 'Austin 78746', rating: 1, tags: ['Business', 'Pragmatic'], notes: 'No relation to defendant. Understands strict evidence requirements.' },
    { num: '22', name: 'Brenda Coleman', age: '64', g: 'Female', race: 'African American', occ: 'Retired Bank Teller', emp: 'Wells Fargo', city: 'Manor 78653', rating: 0, tags: ['Retired', 'Neutral'], notes: 'Friendly and grandmotherly demeanor. Ready to perform civic duty.' },
    { num: '23', name: 'Lucas Meyer', age: '36', g: 'Male', race: 'Caucasian', occ: 'High School Athletic Coach', emp: 'Leander ISD', city: 'Leander 78641', rating: 1, tags: ['Coach', 'Fair Play'], notes: 'Values fair rules and holding both teams to the exact same standard.' },
    { num: '24', name: 'Amina Al-Mansoor', age: '41', g: 'Female', race: 'Middle Eastern', occ: 'Biostatistician', emp: 'UT Dell Medical', city: 'Austin 78731', rating: 2, tags: ['Statistician', 'Scientific Proof'], notes: 'Skeptical of eyewitness recall; demands objective forensic verification.' },
    { num: '25', name: 'Gregory Stone', age: '53', g: 'Male', race: 'Caucasian', occ: 'Long-Haul Truck Driver', emp: 'Swift Transportation', city: 'Buda 78610', rating: 0, tags: ['Blue Collar'], notes: 'Has common-sense view of evidence and accountability.' },
    { num: '26', name: 'Rachel Foster', age: '35', g: 'Female', race: 'Caucasian', occ: 'Physical Therapist', emp: 'Austin Physical Therapy', city: 'Austin 78749', rating: 0, tags: ['Healthcare'], notes: 'Emphasized need to see all facts before drawing conclusions.' },
    { num: '27', name: 'Kenneth Wu', age: '49', g: 'Male', race: 'Asian', occ: 'Hardware Architect', emp: 'Intel', city: 'Austin 78726', rating: 1, tags: ['Hardware Engineer'], notes: 'Methodical thinker, values logic and verification.' },
    { num: '28', name: 'Evelyn Vasquez', age: '47', g: 'Female', race: 'Hispanic', occ: 'Office Manager', emp: 'Dental Clinic', city: 'San Marcos 78666', rating: -1, tags: ['Skeptical of Silence'], notes: 'Expressed mild reservation about why an innocent person wouldn’t speak.' },
    { num: '29', name: 'Donald Hoffman', age: '60', g: 'Male', race: 'Caucasian', occ: 'Commercial Aviation Pilot', emp: 'American Airlines', city: 'Austin 78704', rating: 0, tags: ['Airline Pilot', 'Protocol'], notes: 'Rigid adherence to protocols, checklists, and statutory standards.' },
    { num: '30', name: 'Stephanie Kim', age: '27', g: 'Female', race: 'Asian', occ: 'UX Interaction Designer', emp: 'Meta', city: 'Austin 78701', rating: 1, tags: ['Tech', 'Open Minded'], notes: 'Agrees presumption of innocence is the cornerstone of justice.' },
    { num: '31', name: 'Gary Peterson', age: '58', g: 'Male', race: 'Caucasian', occ: 'Warehouse Logistics Supervisor', emp: 'Amazon Fulfillment', city: 'Kyle 78640', rating: 1, tags: ['Warehouse'], notes: 'Believes prosecutors must do their job completely without cutting corners.' },
    { num: '32', name: 'Tanya Simmons', age: '43', g: 'Female', race: 'African American', occ: 'Nurse Practitioner', emp: 'Ascension Seton', city: 'Austin 78723', rating: 1, tags: ['Nurse', 'Triage'], notes: 'Observant and careful, understands that initial impressions can be flawed.' },
  ];

  // Specific question responses for demo:
  // Q1 (Accused/arrested experience): 4, 10, 15, 20, 26, 30
  // Q2 (Police inherently more credible): 2, 8, 11, 14, 18, 19, 29
  // Q3 (Hold silence against defendant): 2, 7, 11, 18, 19, 28
  // Q4 (Hold State strictly to beyond reasonable doubt): 1, 3, 4, 5, 6, 9, 10, 12, 13, 16, 21, 23, 24, 25, 27, 31

  const q1Yes = new Set(['4', '10', '15', '20', '26', '30']);
  const q2Yes = new Set(['2', '8', '11', '14', '18', '19', '29']);
  const q3Yes = new Set(['2', '7', '11', '18', '19', '28']);
  const q4Yes = new Set(['1', '3', '4', '5', '6', '9', '10', '12', '13', '16', '21', '23', '24', '25', '27', '31']);

  // For a 6-juror criminal trial with sequential auto-pull:
  // - Juror 2: Struck by Defense (Round 1)
  // - Juror 4: Struck by State (Round 1)
  // - Juror 8: Cause Challenge Granted
  //
  // Because auto-pull shifted the subsequent jurors:
  // Seat 1: Juror 1
  // Seat 2: Juror 3
  // Seat 3: Juror 5
  // Seat 4: Juror 6
  // Seat 5: Juror 7
  // Seat 6: Juror 9
  // Alternate 1: Juror 10

  const seatedMapping: Record<string, { seatNumber: number; isAlternate: boolean }> = {
    '1': { seatNumber: 1, isAlternate: false },
    '3': { seatNumber: 2, isAlternate: false },
    '5': { seatNumber: 3, isAlternate: false },
    '6': { seatNumber: 4, isAlternate: false },
    '7': { seatNumber: 5, isAlternate: false },
    '9': { seatNumber: 6, isAlternate: false },
    '10': { seatNumber: 1, isAlternate: true },
  };

  const jurors: Juror[] = rawJurors.map((item, idx) => {
    const jResponses: Record<string, { answeredYes: boolean; note?: string }> = {
      'q-demo-1': { answeredYes: q1Yes.has(item.num) },
      'q-demo-2': { answeredYes: q2Yes.has(item.num) },
      'q-demo-3': { answeredYes: q3Yes.has(item.num) },
      'q-demo-4': { answeredYes: q4Yes.has(item.num) },
    };

    let status: Juror['status'] = 'active';
    let seatNumber: number | undefined = undefined;
    let isAlternate = false;
    let statusNotes: string | undefined = undefined;

    if (item.num === '2') {
      status = 'struck_defense';
      statusNotes = 'Peremptory Strike Round 1 (Defense)';
    } else if (item.num === '4') {
      status = 'struck_plaintiff';
      statusNotes = 'Peremptory Strike Round 1 (Prosecution)';
    } else if (item.num === '8') {
      status = 'cause_granted';
      statusNotes = 'Cause Challenge Granted: Implied / Actual Bias';
    } else if (seatedMapping[item.num]) {
      status = seatedMapping[item.num].isAlternate ? 'alternate' : 'seated';
      seatNumber = seatedMapping[item.num].seatNumber;
      isAlternate = seatedMapping[item.num].isAlternate;
    }

    let strikeIntent: Juror['strikeIntent'] = 'none';
    let strikeIntentNote: string | undefined = undefined;

    if (item.num === '18') {
      strikeIntent = 'strike_peremptory';
      strikeIntentNote = 'Fraud investigator; predisposed to believe prosecution claims';
    } else if (item.num === '19') {
      strikeIntent = 'strike_cause';
      strikeIntentNote = 'Confirmed unconditional trust in police officers; actual bias';
    } else if (item.num === '28') {
      strikeIntent = 'strike_peremptory';
      strikeIntentNote = 'Skeptical of defendant exercising 5th Amendment right to remain silent';
    }

    return {
      id: `juror-${caseId}-${item.num}`,
      caseId,
      jurorNumber: item.num,
      fullName: item.name,
      age: item.age,
      gender: item.g,
      raceEthnicity: item.race,
      occupation: item.occ,
      employer: item.emp,
      cityOrZip: item.city,
      rating: item.rating,
      status,
      statusNotes,
      strikeIntent,
      strikeIntentNote,
      notes: item.notes,
      tags: item.tags,
      seatNumber,
      isAlternate,
      responses: jResponses,
      createdAt: now + idx,
      updatedAt: now + idx,
    };
  });

  const causeChallenges: CauseChallenge[] = [
    {
      id: `cause-demo-1`,
      caseId,
      jurorId: `juror-${caseId}-8`,
      jurorNumber: '8',
      jurorName: 'Patricia Bailey',
      raisedBy: 'our_side',
      grounds: 'Juror confirmed her brother is an active detective in the arresting unit and stated she cannot evaluate officer testimony without inherent partiality.',
      ruling: 'granted',
      judgeComment: 'Excused for cause under Texas Code of Criminal Procedure Art. 35.16 (bias or prejudice).',
      timestamp: now - 3600000,
    },
  ];

  const peremptoryStrikes: PeremptoryStrikeAction[] = [
    {
      id: `strike-demo-1`,
      caseId,
      jurorId: `juror-${caseId}-2`,
      jurorNumber: '2',
      jurorName: 'Maria Elena Rodriguez',
      side: 'defense',
      round: 1,
      timestamp: now - 1800000,
      notes: 'Defense peremptory strike: juror indicated she expects defendant to testify to prove innocence.',
    },
    {
      id: `strike-demo-2`,
      caseId,
      jurorId: `juror-${caseId}-4`,
      jurorNumber: '4',
      jurorName: 'Brianna Hayes',
      side: 'plaintiff_prosecution',
      round: 1,
      timestamp: now - 1200000,
      notes: 'State peremptory strike: juror expressed vocal skepticism toward police search protocols.',
    },
  ];

  return {
    caseData,
    jurors,
    questions,
    causeChallenges,
    peremptoryStrikes,
  };
}
