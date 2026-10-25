import { runRelationshipTestSuite } from './relationshipEngine.test';

console.log('--- Tiesora Automated Relationship Engine Test Suite ---');
const results = runRelationshipTestSuite();

results.results.forEach((r, idx) => {
  const icon = r.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${idx + 1}/${results.total}] ${r.title} => Expected: "${r.expected}" | Actual: "${r.actual}"`);
  if (r.notes) {
    console.log(`    Note: ${r.notes}`);
  }
});

console.log('\n=========================================');
console.log(`Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
console.log('=========================================');

if (results.failed > 0) {
  process.exit(1);
} else {
  console.log('All relationship calculations verified successfully.');
}
