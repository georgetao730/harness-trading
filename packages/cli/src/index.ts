// CLI entry. Real implementation arrives in Sprint 1.
//
// Planned commands (see docs/tech-spec-phase2.md §6):
//   harness-trading onboard
//   harness-trading doctor
//   harness-trading gateway start|stop|status
//   harness-trading skill list|run
//   harness-trading workflow list|run
//   harness-trading auth regenerate
//   harness-trading version

export async function run(argv: readonly string[]): Promise<void> {
  const [cmd] = argv;
  if (!cmd || cmd === 'version' || cmd === '--version' || cmd === '-v') {
    // eslint-disable-next-line no-console
    console.log('harness-trading 0.0.1 (skeleton)');
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `harness-trading: command "${cmd}" is not implemented yet.\n` +
      'Sprint 0 is a skeleton; CLI commands ship in Sprint 1.\n' +
      'See docs/tech-spec-phase2.md for the roadmap.',
  );
  process.exit(2);
}
