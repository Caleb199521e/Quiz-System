# EcoRevise (Quiz System)

This is a small single-file client-side quiz app that stores questions in `localStorage`.

What's added in this refactor:

- Split JS into `js/lib.js` (pure utilities) and `js/app.js` (DOM/UI wiring).
- Added export/import JSON feature (in Staff view: `Export` / `Import`).
- Added tests for utilities using Jest.

Quick setup for tests (Windows PowerShell):

```powershell
cd "c:\Users\Quo Bena\Documents\Quiz System"
npm install
npm test
```

Open `deepseek_html_20260327_1d2e5d.html` in a browser to run the app.
