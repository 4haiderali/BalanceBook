# Changelog

## 1.2.28

- Make Escape close category details, group receipts, shortcuts, refund/recovery editors, month links and deletion confirmation through their normal close actions.
- Close only the visible top dialog; a second press can close the remaining parent. Ignore held Escape and block closing during saves.
- Preserve the transaction draft confirmation path and add DOM regression coverage for stacked dialogs.
- Apply the compatible Next.js 16.4.6 security patch.

## 1.2.27

- Add offline Help & guide in the app sidebar, with topic links and practical examples.
- Add matching repository usage instructions, generated from shared content and checked in CI.
- Include the dependency security maintenance previously available only on main; retain pinned versions and documented scoped overrides.
- Keep existing ledger storage and installer behavior unchanged.

## 1.2.26

- Remove personal migration aliases, financial notes, allocations and hard-coded historical checkpoint values from public source and bundles.
- Preserve already-stored ledger identities, balances, revisions and audit without reapplying personal cleanup.
- Generic Cash/zero-balance fresh startup and explicit group-payee selection.
- Add ledger-preserving Windows uninstall/reinstall support and propagate inner setup cancellation/failure.
- MIT license, release/privacy documentation, CI, dependency updates and security-reporting guidance.

## Earlier builds

1.2.25 added the Escape review fix and single-file setup. Earlier public artifacts were withdrawn during the privacy review; personal migration packages are not redistributed.

