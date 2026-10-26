# Deep Focus — Vanilla JavaScript Focus Tracker

A responsive Pomodoro and deep-work dashboard built with plain HTML, CSS, and JavaScript. No framework, bundler, or external API is required.

## Features

- Pomodoro focus timer with focus, short-break, and long-break modes
- Start, pause, reset, and skip controls
- Configurable durations and sessions-per-cycle
- Optional auto-start breaks and sound alerts
- Task creation, priority labels, completion, deletion, and filters
- Dashboard stats: focus minutes, completed sessions, tasks, and focus streak
- Last-seven-days activity charts and recent session history
- Level-by-level progress roadmap based on cumulative focus minutes
- Achievement checklist for sessions, focus milestones, task completion, and streaks
- A4 portrait progress report with print / Save as PDF support
- Responsive desktop/tablet/mobile layout
- Local persistence through `localStorage`
- Accessible labels, keyboard focus states, and reduced-motion support

## Run locally

1. Extract the ZIP.
2. Open `index.html` in a modern browser.

You can also use VS Code Live Server for a local development server.

## Project structure

```text
deep-focus-tracker/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Notes

- Progress levels are calculated from cumulative recorded focus minutes; achievements are calculated from sessions, completed tasks, and streaks.
- The A4 report uses the browser print dialog. Choose A4 paper and enable background graphics for the intended colors.
- All app data stays in the current browser on the current device.
- Clearing browser storage or using another browser/device will not transfer data.
- The sound alert uses the Web Audio API and may require a user interaction first.
- This is a frontend-only starter project. It does not include accounts, cloud sync, or cross-device backups.
# deep-mind-focus-pro
