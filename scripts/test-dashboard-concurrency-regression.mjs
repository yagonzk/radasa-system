import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard = fs.readFileSync('server/services/dashboard.service.ts', 'utf8');

assert.match(dashboard, /runSettledWithConcurrency/);
assert.match(dashboard, /runSettledWithConcurrency\(tasks,\s*2\)/);
assert.match(dashboard, /console\.error\(\`\[dashboard\]/);
assert.doesNotMatch(dashboard, /const results\s*=\s*await Promise\.allSettled\(\[/);

console.log('dashboard concurrency regression: ok');
