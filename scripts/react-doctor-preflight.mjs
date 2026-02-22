#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const command = 'bunx';
const args = ['react-doctor'];

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  stdio: 'pipe',
  encoding: 'utf8',
});

const stdout = result.stdout ?? '';
const stderr = result.stderr ?? '';

if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

if (result.error) {
  console.error(`Failed to run React Doctor: ${result.error.message}`);
  process.exit(1);
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}

const scoreMatch = stdout.match(/(?:score|health)\D{0,20}(100|\d{1,2})(?:\s*\/\s*100|%|\b)/i) ?? stdout.match(/\b(100|\d{1,2})\s*\/\s*100\b/);

if (!scoreMatch) {
  console.error('React Doctor completed, but no score was detected in the output.');
  process.exit(1);
}

const score = Number.parseInt(scoreMatch[1], 10);

if (!Number.isFinite(score)) {
  console.error('React Doctor score could not be parsed.');
  process.exit(1);
}

if (score < 100) {
  console.error(`React Doctor score ${score}/100 is below the required threshold of 100/100.`);
  process.exit(1);
}

console.log('React Doctor score is 100/100.');
