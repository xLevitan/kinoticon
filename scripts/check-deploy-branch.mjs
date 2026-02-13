#!/usr/bin/env node
/**
 * Pre-deploy/playtest guard: only allow deploy from main branch.
 * Prevents accidental deployment of dev/feature branches to the hackathon sub.
 *
 * Allowed: main (clean or uncommitted)
 * Blocked: dev, feature/*, etc.
 */
import { execSync } from 'child_process';

const ALLOWED_BRANCH = 'main';

try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  if (branch !== ALLOWED_BRANCH) {
    console.error('');
    console.error('⚠️  Deploy blocked: must be on main branch');
    console.error(`   Current branch: ${branch}`);
    console.error('');
    console.error('   To deploy to the hackathon sub:');
    console.error('   git checkout main');
    console.error('   npm run deploy   (or npm run dev for playtest)');
    console.error('');
    process.exit(1);
  }
} catch (e) {
  console.error('Could not read git branch:', e.message);
  process.exit(1);
}
