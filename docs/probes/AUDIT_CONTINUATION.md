# Audit Continuation Instructions

Use this file if the chat context is compacted or lost.

## Mission

Continue the FormaNova repo audit through sequential probes. The user wants a final architectural assessment after all probes are complete.

## Rules

- The user will provide the prompts for each probe.
- Do not edit code files during probes.
- It is allowed to write audit output files under `docs/probes/`.
- Each probe should be saved as `docs/probes/probeN.txt`.
- Maintain `docs/probes/ROLLING_AUDIT_SUMMARY.md` after each probe.
- Keep chat replies short after each probe:
  - say the probe was saved,
  - give top 2-3 findings,
  - mention any blocker.
- Before the final assessment, reread:
  - all `docs/probes/probe*.txt`,
  - `docs/probes/ROLLING_AUDIT_SUMMARY.md`.

## Current Saved State

- `docs/probes/probe1.txt` exists.
- `docs/probes/probe2.txt` exists.
- `docs/probes/ROLLING_AUDIT_SUMMARY.md` exists.

## Known Context

- The repo is a Vite + React + TypeScript app.
- The user is concerned that AI-assisted development caused architectural drift and regressions.
- The audit is meant to identify coupling, duplicate patterns, and risky feature areas.
- Main known risk areas:
  - backend API call standardization,
  - auth/session behavior,
  - admin/credits flow,
  - generation workflows,
  - asset/artifact fetching,
  - on-model studio page,
  - CAD page/rendering/export flow,
  - global CSS/theme/layout behavior.

## Recovery Prompt

If context is lost, the user can say:

> Continue the probe audit. Read `docs/probes/AUDIT_CONTINUATION.md` and `docs/probes/ROLLING_AUDIT_SUMMARY.md` first.

Then continue with the next probe number.
