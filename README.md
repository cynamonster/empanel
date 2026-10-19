# Voir Dire Trial Assistant (PWA)

A responsive, offline-first Progressive Web App designed to assist trial attorneys in real time during courtroom *voir dire* (jury selection).

## Features

- **Courtroom Seating Layouts**:
  - **Prospective Panel View**: Realistic front/back juror box with alternate juror bench.
  - **Venire Gallery Grid View**: Customizable gallery grid (4x8, etc.) with 1 central walkway aisle and bottom-left courtroom orientation (#1 at bottom-left).
- **Sequential Auto-Pull & Dynamic Reordering**:
  - Automatically advances subsequent panel jurors when any juror is struck.
  - Alternates automatically promote into the open panel end seat.
  - New replacements are pulled sequentially from the unseated Jury Pool into the alternate bench.
  - Hardware-accelerated FLIP animations smoothly glide jurors into their new seats.
- **Strike Console & Tally Tracker**:
  - Turn-based peremptory strike tracking for Prosecution/Plaintiff and Defense.
  - Real-time remaining strike badges in header with quick strike actions.
  - Batson tracking log recording demographics (race/ethnicity, gender).
- **Cause Challenges & Rulings**:
  - Record challenges for cause with statutory grounds and judicial rulings (Granted / Denied / Pending).
- **Group Question Hand-Raise Logger**:
  - 1-click toggling of juror affirmative answers across questions.
- **Undo / Redo History Stack**:
  - Full history stack hotkeyed to `⌘Z` / `Ctrl+Z` and `⌘⇧Z` / `Ctrl+Shift+Z`.
- **Offline-First & Local Storage**:
  - Powered by Dexie.js (IndexedDB) for completely offline courtroom reliability.
  - Export to CSV or full JSON backup.
- **Pre-Configured Demo Trial**:
  - Instant 1-click loading of a 6-juror criminal trial (*State of Texas v. Marcus Vance*).

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation & Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle
npm run build
```

## Tech Stack

- **React 18** + **TypeScript**
- **Vite 5**
- **Tailwind CSS**
- **Dexie.js** (IndexedDB)
- **Lucide Icons**
