import { runRelationshipTestSuite } from './relationshipEngine.test';
import { runDbMapperTestSuite } from '../services/db/mappers.test';

interface SuiteResult {
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    title: string;
    expected: string;
    actual: string;
    passed: boolean;
    notes?: string;
  }>;
}

function printSuite(label: string, suite: SuiteResult) {
  console.log(`\n--- ${label} ---`);
  suite.results.forEach((r, idx) => {
    const icon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(
      `${icon} [${idx + 1}/${suite.total}] ${r.title} => Expected: "${r.expected}" | Actual: "${r.actual}"`,
    );
    if (r.notes) {
      console.log(`    Note: ${r.notes}`);
    }
  });
}

console.log('--- Tiesora Automated Test Suite ---');

const relationship = runRelationshipTestSuite();
printSuite('Relationship Engine', relationship);

const mappers = runDbMapperTestSuite();
printSuite('Supabase Data Mappers', mappers);

const total = relationship.total + mappers.total;
const passed = relationship.passed + mappers.passed;
const failed = relationship.failed + mappers.failed;

console.log('\n=========================================');
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('=========================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All test suites verified successfully.');
}
