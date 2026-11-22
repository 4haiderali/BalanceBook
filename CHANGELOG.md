# Changelog

## Unreleased

- Move Backup & recovery and Help & guide into Settings.
- Add display preferences for date style, currency label, digit grouping and decimal places.
- Add preset category tags and temporary transaction column sorting.

- Add a Settings page with Match system, Light and Dark themes. The choice is stored in a cookie (and localStorage) so it survives the desktop app's changing local port, and `public/theme-init.js` applies it before first paint.
- Replace the stylesheet's hard-coded colours with design tokens, remove the leftover green palette and 153 unused rules, and raise text below 12px to a readable size.
- Show currency as PKR and dates as 21 Nov 2026 consistently across the app.
- Put "To account" beside "From account" in the transfer form.

## 1.2.29

- Prevent transfers from retaining a hidden expense category such as Food, including stale drafts and shortcuts at the save boundary.
- Automatically repair categories on saved transfers, including deleted and known legacy transfers, through a revision-checked save on opening the app.
- Retain original imported values, prior saved versions and correction audit; keep amounts, accounts, links and balance effects unchanged.
- Show no spending category for transfers in the transaction list.

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

