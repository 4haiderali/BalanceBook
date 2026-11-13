# Build and release

Use the exact release tag and Node 24.22.1.

```powershell
npm ci
npm run typecheck
npm test
node desktop/build.mjs
npx vite build --config vite.desktop.config.ts
node --import tsx desktop/smoke.mjs
node --import tsx desktop/ledger-items-smoke.mjs
node --import tsx desktop/reports-smoke.mjs
node --import tsx desktop/recovery-smoke.mjs C:\path\to\previous-payload\server.mjs
```

For Windows packaging, extract the release runtime ZIP and use its payload as RuntimePayload. It supplies Node 24.22.1 x64, the icon, Microsoft WebView2 1.0.2903.40 assemblies/loader, and notices. Application executables, server and UI are rebuilt. Use a fresh output folder.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/pack.ps1 -RuntimePayload C:\path\to\payload -OutputFolder dist\BalanceBook-Windows
& 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe' desktop\single-file.iss
```

The .NET Framework 4.8 compiler and netstandard facade are required. Optional signing parameters need a trusted certificate; no private key belongs in Git. The Inno script accepts ReleaseRoot/OutputRoot definitions for alternative paths.

Reproduction means building the tagged source with these dependency versions. Byte-identical PE files/installer hashes are not promised because compiler timestamps and packaging metadata can differ.

Before release: inspect source AND bundled server/UI for personal data; run all suites; test the exact downloaded installer; check fresh start, update/draft cancellation, uninstall and reinstall; compare baseline balances/revision/audit; verify restore in isolated data; compute SHA-256; publish one obvious installer and a runtime ZIP. Do not publish local data or old personalized migration packages.
