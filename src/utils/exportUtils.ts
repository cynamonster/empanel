import type { Case, Juror, Question, CauseChallenge, PeremptoryStrikeAction } from '../types';

export function exportJurorsToCSV(jurors: Juror[], caseName: string) {
  const headers = [
    'Juror #',
    'Full Name',
    'Status',
    'Rating (-3 to +3)',
    'Seat Number',
    'Age',
    'Gender',
    'Race/Ethnicity',
    'Occupation',
    'Employer',
    'Area of County',
    'Notes',
    'Cause / Strike Details'
  ];

  const rows = jurors.map(j => [
    j.jurorNumber,
    `"${(j.fullName || '').replace(/"/g, '""')}"`,
    j.status,
    j.rating,
    j.seatNumber ?? '',
    j.age ?? '',
    j.gender ?? '',
    j.raceEthnicity ?? '',
    `"${(j.occupation || '').replace(/"/g, '""')}"`,
    `"${(j.employer || '').replace(/"/g, '""')}"`,
    `"${(j.areaOfCounty || j.cityState || j.cityOrZip || '').replace(/"/g, '""')}"`,
    `"${(j.notes || '').replace(/"/g, '""')}"`,
    `"${(j.statusNotes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${caseName.replace(/[^a-zA-Z0-9_-]/g, '_')}_jurors_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCaseBackupJSON(
  caseData: Case,
  jurors: Juror[],
  questions: Question[],
  causeChallenges: CauseChallenge[],
  peremptoryStrikes: PeremptoryStrikeAction[]
) {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    caseData,
    jurors,
    questions,
    causeChallenges,
    peremptoryStrikes,
  };

  const jsonContent = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${caseData.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_backup_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
