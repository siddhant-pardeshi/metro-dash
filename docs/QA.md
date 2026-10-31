# QA notes — Metro Dash

## What was tested

**Environment:** Windows 10 desktop, Chromium (in-app), 1280×720; touch layout checked in a 390×844 emulated frame by the build agent; local server via `python -m http.server`.

- Menu over live attract-mode runner; best score chip reads persisted localStorage value.
- Full run flow: Play → lane switching (keyboard), jumping, sliding, ticket pickup (+10 popups), mission chips updating, near-miss "CLOSE! +25" with slow-mo beat.
- Crash path: crash cam → rooftop debrief card (learning layer) → results board with distance/tickets/close calls/missions/score and personal-best tracking.
- Concept codex: menu Concepts screen lists the scam-radar + status-code bank with mastery stars; results screen counts concepts practiced.
- Build agent's own verification: zero console errors across load, gameplay, results, music sequencer and the full SFX bank in a dedicated tab; swipe/tap paths exercised in the emulated phone frame.
- Reviewer verification: menu, 3 runs, lane/jump/slide inputs, media capture — no console errors observed.

## What was NOT tested (honest gaps)

- Physical mobile devices (touch verified in emulated frames only).
- Audio judged by engine path and no-error runs; no human listened to the soundtrack in this pass.
- Firefox/Safari untested.
- Long-run (10,000 m+) stability not soaked; obstacle patterns are deterministic-fair by construction, not by exhaustive playback.

## Known limitations

- Swipe gestures bind to the game canvas area only, so the topbar buttons stay reachable.
- The rooftop debrief appears once per run (after the crash) by design — it is a debrief, not a quiz gate.
