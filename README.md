# Empanel

An offline-first web app to assist trial attorneys in real time during courtroom *voir dire* (jury selection).

## Features

- **Courtroom Seating Views**:
  - **Prospective Panel**: 6 or 12-juror box with interactive front/back rows and alternate juror bench.
  - **Venire Gallery Grid**: Configurable gallery with central aisle and courtroom orientation (#1 at bottom-left).
- **Auto-Pull & Dynamic Reordering**:
  - Eliminating a juror automatically slides subsequent panel jurors over.
  - Alternates automatically promote into the open panel end seat.
  - Next sequential unstruck juror from the pool refills the alternate bench.
  - Hardware-accelerated FLIP animations smoothly glide cards to their new positions.
- **Strategic Strike Console**:
  - Real-time peremptory strike countdowns (Prosecution & Defense) and cause challenges.
  - Built-in demographic tracking and Batson challenge log.
  - Quick-strike gavel buttons directly on seated cards.
- **Group Question Hand-Raise Logger**:
  - 1-click tracking of juror responses during group questioning.
- **Offline-First & Undo/Redo**:
  - Full IndexedDB persistence via Dexie.js (works 100% offline in courtroom).
  - Undo/Redo history stack (`⌘Z` / `Ctrl+Z`, `⌘⇧Z` / `Ctrl+Shift+Z`).
  - CSV export and full JSON backup/restore.
- **Built-in Demo Mode**:
  - 1-click pre-configured 6-juror criminal trial (*State of Texas v. Marcus Vance*).

## Getting Started

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **React 18** + **TypeScript**
- **Vite 6** + **Tailwind CSS**
- **Dexie.js** (IndexedDB)
- **Lucide Icons**
