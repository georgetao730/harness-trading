# @harness-trading/web

> **Status**: Reserved skeleton (Sprint 0). Real code lands in Sprint 4.

This package will host the browser-side UI (status panel, skill runner UI, broker dashboard) for harness-trading.

The current `frontend/` directory at the repo root is the v1 Next.js app from Phase 1. It will be migrated into this package during Sprint 4 when the Web ↔ ws-bridge integration is wired (see [docs/tech-spec-phase2.md §17](../../docs/tech-spec-phase2.md#17-实施分期)).

Until then, this directory only carries the npm name reservation `@harness-trading/web` so the publish pipeline can be tested end-to-end with all 6 packages present.
