#!/usr/bin/env node
// Facade entry. Delegates everything to @harness-trading/cli.
// Keep this file tiny and dependency-free; real CLI lives in packages/cli.
import { run } from '@harness-trading/cli';

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
