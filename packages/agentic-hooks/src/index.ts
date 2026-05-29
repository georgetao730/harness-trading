// agentic-hooks entry. Real implementation arrives in Sprint 1.
//
// Six lifecycle events (mirror Claude Code hooks reference):
//   UserPromptSubmit · PreToolUse · PostToolUse · SessionStart · SessionEnd · Stop
//
// Adapters planned for v0.1: claude (Claude Code), codex (Codex CLI).
// More adapters (cursor, qoder) follow when their hook surfaces stabilize.
export type HookEvent =
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop';

export const HOOK_EVENTS: readonly HookEvent[] = [
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'SessionEnd',
  'Stop',
] as const;
