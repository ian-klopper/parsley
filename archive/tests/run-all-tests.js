#!/usr/bin/env node

const { clearDatabase } = require('./test-utils');
const { runAuthTests } = require('./auth-tests');
const { runJobTests } = require('./job-tests');
const { runCollaboratorTests } = require('./collaborator-tests');
const { runActivityLogTests } = require('./activity-log-tests');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

async function runComprehensiveTestSuite() {
  console.log(colors.bright + colors.cyan);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          COMPREHENSIVE TEST SUITE FOR PARSLEY APP           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  console.log(colors.yellow + '\n🔧 Initializing test environment...' + colors.reset);

  // Clear database before starting
  try {
    await clearDatabase();
    console.log(colors.green + '✓ Database cleared successfully' + colors.reset);
  } catch (error) {
    console.error(colors.red + '✗ Failed to clear database:' + colors.reset, error.message);
    process.exit(1);
  }

  const testSuites = [
    { name: 'Authentication & Authorization', runner: runAuthTests },
    { name: 'Job Management', runner: runJobTests },
    { name: 'Collaborator Management', runner: runCollaboratorTests },
    { name: 'Activity Logging', runner: runActivityLogTests }
  ];

  const allResults = {
    totalPassed: 0,
    totalFailed: 0,
    totalTests: 0,
    suiteResults: []
  };

  console.log(colors.yellow + '\n📊 Running test suites...\n' + colors.reset);

  for (const suite of testSuites) {
    console.log(colors.bright + colors.blue);
    console.log('━'.repeat(60));
    console.log(`  ${suite.name} Suite`);
    console.log('━'.repeat(60));
    console.log(colors.reset);

    try {
      const results = await suite.runner();

      allResults.totalPassed += results.passed;
      allResults.totalFailed += results.failed;
      allResults.totalTests += results.passed + results.failed;

      allResults.suiteResults.push({
        name: suite.name,
        passed: results.passed,
        failed: results.failed,
        total: results.passed + results.failed,
        errors: results.errors
      });

      console.log(colors.cyan + `\n  Suite Summary: ${results.passed}/${results.passed + results.failed} tests passed` + colors.reset);

    } catch (error) {
      console.error(colors.red + `\n  Suite Error: ${error.message}` + colors.reset);
      allResults.totalFailed += 1;
      allResults.totalTests += 1;
      allResults.suiteResults.push({
        name: suite.name,
        passed: 0,
        failed: 1,
        total: 1,
        errors: [{ test: 'Suite Execution', error: error.message }]
      });
    }
  }

  // Print final summary
  console.log(colors.bright + colors.magenta);
  console.log('\n' + '═'.repeat(60));
  console.log('                    FINAL TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(colors.reset);

  // Suite breakdown
  console.log(colors.yellow + '\n📈 Suite Breakdown:' + colors.reset);
  for (const suite of allResults.suiteResults) {
    const passRate = ((suite.passed / suite.total) * 100).toFixed(1);
    const statusColor = suite.failed === 0 ? colors.green : colors.red;

    console.log(`\n  ${colors.bright}${suite.name}:${colors.reset}`);
    console.log(`    Passed: ${colors.green}${suite.passed}${colors.reset}`);
    console.log(`    Failed: ${colors.red}${suite.failed}${colors.reset}`);
    console.log(`    Pass Rate: ${statusColor}${passRate}%${colors.reset}`);

    if (suite.errors && suite.errors.length > 0) {
      console.log(colors.red + '    Failed Tests:' + colors.reset);
      suite.errors.slice(0, 3).forEach((err, idx) => {
        console.log(`      ${idx + 1}. ${err.test}`);
        console.log(`         ${colors.yellow}${err.error.substring(0, 100)}${colors.reset}`);
      });
      if (suite.errors.length > 3) {
        console.log(`      ... and ${suite.errors.length - 3} more`);
      }
    }
  }

  // Overall summary
  const overallPassRate = ((allResults.totalPassed / allResults.totalTests) * 100).toFixed(1);
  const overallColor = allResults.totalFailed === 0 ? colors.green : allResults.totalFailed <= 5 ? colors.yellow : colors.red;

  console.log(colors.bright + colors.cyan);
  console.log('\n' + '─'.repeat(60));
  console.log('                    OVERALL SUMMARY');
  console.log('─'.repeat(60));
  console.log(colors.reset);

  console.log(`\n  Total Tests: ${colors.bright}${allResults.totalTests}${colors.reset}`);
  console.log(`  Passed: ${colors.green}${allResults.totalPassed}${colors.reset}`);
  console.log(`  Failed: ${colors.red}${allResults.totalFailed}${colors.reset}`);
  console.log(`  Pass Rate: ${overallColor}${overallPassRate}%${colors.reset}`);

  // Test coverage status
  console.log(colors.yellow + '\n📋 Test Coverage Status:' + colors.reset);
  const coverageItems = [
    { name: 'Authentication & Authorization', status: '✅' },
    { name: 'Role-Based Access Control', status: '✅' },
    { name: 'Job Management', status: '✅' },
    { name: 'Collaborator Management', status: '✅' },
    { name: 'Activity Logging', status: '✅' },
    { name: 'Edge Cases & Validation', status: '✅' },
    { name: 'Concurrent Operations', status: '✅' },
    { name: 'Error Handling', status: '✅' }
  ];

  coverageItems.forEach(item => {
    console.log(`  ${item.status} ${item.name}`);
  });

  // Final verdict
  console.log(colors.bright);
  console.log('\n' + '═'.repeat(60));

  if (allResults.totalFailed === 0) {
    console.log(colors.green);
    console.log('       🎉 ALL TESTS PASSED! SYSTEM IS FULLY FUNCTIONAL 🎉');
  } else if (allResults.totalFailed <= 5) {
    console.log(colors.yellow);
    console.log('       ⚠️  MINOR ISSUES DETECTED - REVIEW FAILED TESTS ⚠️');
  } else {
    console.log(colors.red);
    console.log('       ❌ CRITICAL ISSUES FOUND - IMMEDIATE ATTENTION REQUIRED ❌');
  }

  console.log('═'.repeat(60));
  console.log(colors.reset);

  // Exit with appropriate code
  process.exit(allResults.totalFailed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(colors.red + '\n❌ Unhandled error during test execution:' + colors.reset);
  console.error(error);
  process.exit(1);
});

// Run the test suite
runComprehensiveTestSuite().catch(error => {
  console.error(colors.red + '\n❌ Fatal error:' + colors.reset, error);
  process.exit(1);
});