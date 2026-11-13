# Changelog

## Unreleased — dependency maintenance

Patched the source dependency tree after enabling security alerts. npm audit reports zero known vulnerabilities; local typecheck, accounting, desktop build/report/recovery checks pass. Direct updates are pinned, and scoped development-tool overrides are documented in docs/DEPENDENCIES.md. Published 1.2.26 artifacts remain unchanged.


## 1.2.26

- Remove personal migration aliases, financial notes, allocations and hard-coded historical checkpoint values from public source and bundles.
- Preserve already-stored ledger identities, balances, revisions and audit without reapplying personal cleanup.
- Generic Cash/zero-balance fresh startup and explicit group-payee selection.
- Add ledger-preserving Windows uninstall/reinstall support and propagate inner setup cancellation/failure.
- MIT license, release/privacy documentation, CI, dependency updates and security-reporting guidance.

## Earlier builds

1.2.25 added the Escape review fix and single-file setup. Earlier public artifacts were withdrawn during the privacy review; personal migration packages are not redistributed.

