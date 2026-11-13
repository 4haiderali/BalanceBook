# Dependency maintenance after 1.2.26

The published 1.2.26 tag and installer are immutable, tested release artifacts. The main branch contains subsequent dependency maintenance; it is not a replacement executable release. Use the release tag when reproducing that installer.

On 13 November 2026, enabling Dependabot exposed advisories in the source dependency tree. Main updates Next/React/RSC, Vite/esbuild, Zod and the Cloudflare/Vinext development toolchain to supported patched versions. Direct updates are pinned and package-lock.json records the transitive tree. npm audit reports zero known vulnerabilities for this updated checkout as of that date. This does not mean all possible vulnerabilities are absent, and the older release tag has its older dependency tree.

Scoped overrides address dependencies whose parent package has not yet adopted the safe version:

- @esbuild-kit/core-utils uses esbuild 0.25.12 instead of vulnerable 0.18.20. Drizzle schema generation into a disposable folder passed.
- Satori uses fflate 0.8.3 instead of its vulnerable 0.7 dependency.
- @typescript-eslint/typescript-estree uses minimatch 11.0.1 instead of vulnerable 10.x. Node 24 satisfies its runtime requirement.
- Miniflare uses sharp 0.35.5, retaining the existing scoped-override approach.

Review and remove these overrides when upstream dependency ranges adopt safe versions. Do not use npm audit fix --force to downgrade Drizzle/Vinext or ignore incompatible peers.

TypeScript, all 31 accounting checks, PWA/persistence/auth checks, desktop and UI builds, account/category operations, report generation and mixed-ledger recovery passed locally with this dependency set. The expected corrupt-database error is part of a passing negative recovery test. Native WebView2 acceptance was not repeated for this post-release dependency update.
