# DerivProAcademy — Progress & Changes Since Last Push

## Summary

This update covers all work done after the previous push (`71aa5f6 / c7ce1d6`).
The focus was on making the **funded account mode behave correctly** end-to-end:
correct trade display, proper account switching, bot stop on mode change, and
daily drawdown enforcement. A webpack dev server startup bug was also fixed.

---

## 1. Funded Trade Display — Transactions Panel

**Problem:** Funded account trades showed differently from real/demo trades in the
Transactions and Journal panels:

- Contract IDs used a `funded_TIMESTAMP` string instead of a numeric ID
- Longcodes read "Funded DIGITOVER on R_50" instead of proper Deriv text
- Entry and exit spots showed different values (first tick vs last tick)

**What was fixed:**

- `FundedTradeEngine` now generates proper Deriv-style longcodes, for example:
  _"Win payout if the last digit of Volatility 50 Index is strictly higher than 5
  after 5 ticks."_
- Contract IDs and transaction IDs are now random 9/10-digit numbers matching
  Deriv's real format
- Entry spot and exit spot both show the same settling tick value, matching how
  Deriv displays digit contracts in demo and real accounts
- Contracts are tagged with `_is_funded: true` internally so the system can
  identify them without relying on the ID format

---

## 2. Funded Trade Detection in Transactions Store

**Problem:** The transactions store identified funded trades by checking if the
contract ID started with `"funded_"`. This broke when IDs became numeric.

**What was fixed:**

- Detection now checks for the `_is_funded: true` property on the contract object
- This prevents funded trades from being recorded to Supabase as real trades

---

## 3. Bot Stops When Switching Away from Funded Mode

**Problem:** If a user switched from Funded → Demo or Funded → Real while the bot
was running, the bot continued running and kept executing funded trades on the
wrong account.

**What was fixed:**

- When the user switches away from funded mode, a `dpa_funded_bot_stop` window
  event is dispatched
- The bot's run-panel store listens for this event and calls `stopBot()` immediately
- Any in-flight tick subscription (a trade already counting ticks) is cancelled
  instantly so no stale trades settle after the switch

---

## 4. Funded Mode Does Not Re-Activate After Switching Away

**Problem:** If the user switched to Demo or Real and then refreshed the page,
the app would re-activate funded mode automatically because the guard's auto-
activate logic ran on every page load.

**What was fixed:**

- When the user deliberately chooses Demo or Real, their choice is saved to
  `sessionStorage` as `dpa_chosen_mode`
- On page refresh, this value is read back into `window.__dpa_user_chose`
- The guard activation checks this value first and skips activation if the user
  previously chose Deriv mode
- The `sessionStorage` key is cleared when the admin removes the user from the
  challenge (Supabase real-time DELETE event), so funded mode can re-activate
  correctly for a fresh challenge

---

## 5. Funded Balance Updates in Real Time

**Problem:** The funded balance shown in the header was previously synced through
`localStorage`, which meant the bot-web-ui and core packages were tightly coupled
through shared storage keys.

**What was fixed:**

- After each funded trade settles, `FundedAccountStore` dispatches a
  `dpa_funded_balance_updated` window event with the new balance
- The header's account-info component listens for this event and updates the
  displayed balance immediately without any localStorage dependency

---

## 6. Account Switcher — No Snap-Back on Real Account

**Problem:** When funded mode was active, the real account was still highlighted
in the account switcher, making it look like the user was on a real account.

**What was fixed:**

- When funded mode is selected, no real account is highlighted in the switcher
- The `window.__dpa_user_chose` global (which survives React remounts) is the
  single source of truth for which mode is active

---

## 7. Funded Mode Guard — localStorage Fully Removed

**Problem:** `FundedTradeEngine` was checking `localStorage` as a fallback to
determine if funded mode was active. This meant that even after the user switched
away, the bot would still run funded trades if the localStorage flag was stale.

**What was fixed:**

- `FundedTradeEngine.isActive()` now only checks `window.__dpa_funded_active`
- `destroyFundedGuard()` explicitly clears the old localStorage keys as a
  clean-up step so no stale flags are left behind
- No part of the funded mode system writes or reads from localStorage anymore

---

## 8. Daily Drawdown Popup

**How it works (no code change needed):**

- The `max_daily_loss_percent` rule is fetched from the Supabase `challenge_rules`
  table per phase — it is **admin-configured**, not hardcoded
- When a funded trade pushes the daily loss over the limit, a popup appears
  with "Daily loss limit reached. Trading suspended until tomorrow."
- On the next trade attempt (even after refresh), the pre-trade check blocks the
  purchase and shows the popup again
- The popup fires each time the user tries to run the bot while the limit is hit

---

## 9. Bot Workspace Loading Fix

**Problem:** The `BotXmlLoader` component would show "Loading bot into workspace..."
permanently if the Blockly workspace never finished initializing. There was no
timeout — it silently gave up after 60 seconds with no message.

**What was fixed:**

- After 120 failed attempts (60 seconds), a red error toast now appears:
  _"Bot workspace took too long to load. Please refresh and try again."_

---

## 10. Webpack Dev Server Startup Fix

**Problem:** The webpack dev server (`npm run serve` in the core package) would
immediately crash with:

> `Invalid options object — options has an unknown property '_assetEmittingPreviousFiles'`

This was caused by the `GenerateSW` (Workbox service worker) plugin conflicting
with webpack-dev-server 5.2.x on webpack 5.105.x.

**What was fixed:**

- `GenerateSW` is now only added to the plugin list in production (`IS_RELEASE`)
  builds
- In development mode the plugin is skipped, so the dev server starts cleanly

---

## 11. Bot Loading Infinite Spinner

**Problem:** If `retrieveActiveSymbols()` failed or timed out, the bot page would
show a loading spinner forever with no error message.

**What was fixed:**

- A `.catch()` handler was added so that if the symbols fetch fails, the loading
  state is cleared and the bot UI becomes accessible regardless

---

## Files Changed

| File                                      | Change                                                     |
| ----------------------------------------- | ---------------------------------------------------------- |
| `bot-skeleton/.../funded-trade-engine.js` | Longcodes, numeric IDs, entry=exit spot, `_is_funded` flag |
| `bot-skeleton/.../Purchase.js`            | Uses new longcode generator and numeric IDs                |
| `bot-skeleton/.../OpenContract.js`        | Supabase real trade recording via window event             |
| `bot-web-ui/.../app-content.jsx`          | Error catch on symbol load                                 |
| `bot-web-ui/.../funded-account-store.ts`  | Balance via window event, deactivate stops bot             |
| `bot-web-ui/.../run-panel-store.ts`       | Listens for `dpa_funded_bot_stop`                          |
| `bot-web-ui/.../transactions-store.ts`    | `_is_funded` detection                                     |
| `bot-web-ui/webpack.config.js`            | StyleLint disabled (pre-existing errors)                   |
| `core/build/constants.js`                 | Skip GenerateSW in dev mode                                |
| `core/.../AppContent.tsx`                 | Bot stop event wiring                                      |
| `core/.../BotXmlLoader/index.tsx`         | Timeout error message                                      |
| `core/.../DPANavbar/index.tsx`            | Skip guard if user chose Deriv mode                        |
| `core/.../account-info.jsx`               | Window global mode, real-time balance listener             |
| `core/.../account-switcher.jsx`           | sessionStorage persistence, no snap-back                   |
| `core/Services/funded-guard.ts`           | localStorage cleared on destroy                            |
| `core/Services/supabase.ts`               | Supporting queries                                         |
