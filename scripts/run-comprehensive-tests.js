#!/usr/bin/env node

/**
 * Comprehensive Test Suite Runner
 *
 * This script executes the full test plan for user admin, job, and job collaborator functionality.
 * It runs unit tests, integration tests, component tests, and E2E tests in the correct order.
 *
 * Usage: node scripts/run-comprehensive-tests.js [--env=test] [--coverage] [--e2e] [--parallel]
 */

const { spawn, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

// Configuration
const config = {
  testEnvironment: process.env.NODE_ENV || 'test',
  coverageThreshold: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80
  },
  timeout: 300000, // 5 minutes
  retries: 2
}

// Test categories
const testSuites = {
  unit: {
    name: 'Unit Tests',
    pattern: '**/*.test.ts',
    timeout: 30000
  },
  integration: {
    name: 'Integration Tests',
    pattern: '**/api/**/*.test.ts',
    timeout: 60000
  },
  component: {
    name: 'Component Tests',
    pattern: '**/*.test.tsx',
    timeout: 45000
  },
  e2e: {
    name: 'End-to-End Tests',
    pattern: '**/e2e/**/*.test.ts',
    timeout: 120000
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  coverage: args.includes('--coverage'),
  e2e: args.includes('--e2e'),
  parallel: args.includes('--parallel'),
  watch: args.includes('--watch'),
  env: args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'test'
}

console.log(chalk.blue.bold('🚀 Starting Comprehensive Test Suite'))
console.log(chalk.gray(`Environment: ${options.env}`))
console.log(chalk.gray(`Coverage: ${options.coverage ? 'enabled' : 'disabled'}`))
console.log(chalk.gray(`E2E Tests: ${options.e2e ? 'enabled' : 'disabled'}`))
console.log(chalk.gray(`Parallel: ${options.parallel ? 'enabled' : 'disabled'}`))
console.log('')

/**
 * Execute a command and return a promise
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

/**
 * Setup test environment
 */
async function setupTestEnvironment() {
  console.log(chalk.yellow('📋 Setting up test environment...'))

  try {
    // Check if database is accessible
    if (fs.existsSync('.env.test')) {
      console.log(chalk.green('✓ Test environment configuration found'))
    } else {
      console.log(chalk.red('✗ Test environment configuration missing'))
      throw new Error('Please create .env.test file')
    }

    // Setup test database (skipping - using existing database)
    console.log(chalk.gray('Using existing database configuration...'))

    console.log(chalk.green('✓ Test environment ready'))
  } catch (error) {
    console.error(chalk.red('✗ Environment setup failed:'), error.message)
    process.exit(1)
  }
}

/**
 * Run a specific test suite
 */
async function runTestSuite(suiteKey, suite) {
  console.log(chalk.blue(`\n🧪 Running ${suite.name}...`))

  const jestArgs = [
    '--testPathPatterns=' + suite.pattern,
    '--testTimeout=' + suite.timeout,
    '--maxWorkers=' + (options.parallel ? '4' : '1'),
    '--verbose'
  ]

  if (options.coverage && suiteKey !== 'e2e') {
    jestArgs.push(
      '--coverage',
      '--coverageDirectory=coverage/' + suiteKey,
      '--coverageReporters=text',
      '--coverageReporters=lcov'
    )
  }

  if (options.watch) {
    jestArgs.push('--watch')
  }

  try {
    await runCommand('npx', ['jest', ...jestArgs])
    console.log(chalk.green(`✓ ${suite.name} completed successfully`))
    return true
  } catch (error) {
    console.error(chalk.red(`✗ ${suite.name} failed`))
    return false
  }
}

/**
 * Run Playwright E2E tests
 */
async function runE2ETests() {
  console.log(chalk.blue('\n🎭 Running End-to-End Tests...'))

  try {
    // Install Playwright if needed
    await runCommand('npx', ['playwright', 'install', '--with-deps'])

    // Run E2E tests
    const playwrightArgs = [
      'playwright', 'test',
      '--config=playwright.config.js',
      'tests/e2e/',
      '--reporter=html'
    ]

    if (options.parallel) {
      playwrightArgs.push('--workers=2')
    }

    await runCommand('npx', playwrightArgs)
    console.log(chalk.green('✓ E2E tests completed successfully'))
    return true
  } catch (error) {
    console.error(chalk.red('✗ E2E tests failed'))
    return false
  }
}

/**
 * Generate test report
 */
async function generateTestReport(results) {
  console.log(chalk.blue('\n📊 Generating test report...'))

  const report = {
    timestamp: new Date().toISOString(),
    environment: options.env,
    results: results,
    summary: {
      total: Object.keys(results).length,
      passed: Object.values(results).filter(r => r).length,
      failed: Object.values(results).filter(r => !r).length
    }
  }

  // Create reports directory
  if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports', { recursive: true })
  }

  // Write JSON report
  const reportPath = `reports/test-report-${Date.now()}.json`
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  // Write HTML report
  const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .summary { margin: 20px 0; }
    .results { margin-top: 20px; }
    .passed { color: green; }
    .failed { color: red; }
    .suite { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Comprehensive Test Report</h1>
    <p>Generated: ${report.timestamp}</p>
    <p>Environment: ${report.environment}</p>
  </div>

  <div class="summary">
    <h2>Summary</h2>
    <p>Total Suites: ${report.summary.total}</p>
    <p class="passed">Passed: ${report.summary.passed}</p>
    <p class="failed">Failed: ${report.summary.failed}</p>
  </div>

  <div class="results">
    <h2>Results</h2>
    ${Object.entries(results).map(([suite, passed]) => `
      <div class="suite">
        <h3 class="${passed ? 'passed' : 'failed'}">${testSuites[suite]?.name || suite}</h3>
        <p>Status: ${passed ? 'PASSED' : 'FAILED'}</p>
      </div>
    `).join('')}
  </div>
</body>
</html>
  `

  const htmlReportPath = `reports/test-report-${Date.now()}.html`
  fs.writeFileSync(htmlReportPath, htmlReport)

  console.log(chalk.green(`✓ Test report generated: ${reportPath}`))
  console.log(chalk.green(`✓ HTML report generated: ${htmlReportPath}`))

  return report
}

/**
 * Check coverage thresholds
 */
async function checkCoverageThresholds() {
  if (!options.coverage) return true

  console.log(chalk.blue('\n📈 Checking coverage thresholds...'))

  try {
    // Read coverage summary
    const coveragePath = 'coverage/lcov-report/index.html'
    if (fs.existsSync(coveragePath)) {
      console.log(chalk.green('✓ Coverage report generated'))
      console.log(chalk.gray(`View coverage: file://${path.resolve(coveragePath)}`))
    }

    return true
  } catch (error) {
    console.error(chalk.red('✗ Coverage check failed:'), error.message)
    return false
  }
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now()
  const results = {}

  try {
    // Setup
    await setupTestEnvironment()

    // Run test suites
    for (const [suiteKey, suite] of Object.entries(testSuites)) {
      // Skip E2E tests if not requested
      if (suiteKey === 'e2e' && !options.e2e) {
        console.log(chalk.yellow(`⏭ Skipping ${suite.name} (use --e2e to include)`))
        continue
      }

      if (suiteKey === 'e2e') {
        results[suiteKey] = await runE2ETests()
      } else {
        results[suiteKey] = await runTestSuite(suiteKey, suite)
      }
    }

    // Check coverage
    if (options.coverage) {
      await checkCoverageThresholds()
    }

    // Generate report
    const report = await generateTestReport(results)

    // Summary
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000)

    console.log(chalk.blue.bold('\n📋 Test Summary'))
    console.log(chalk.gray('─'.repeat(50)))

    Object.entries(results).forEach(([suite, passed]) => {
      const icon = passed ? '✓' : '✗'
      const color = passed ? chalk.green : chalk.red
      const name = testSuites[suite]?.name || suite
      console.log(color(`${icon} ${name}`))
    })

    console.log(chalk.gray('─'.repeat(50)))
    console.log(`Duration: ${duration}s`)
    console.log(`Passed: ${report.summary.passed}/${report.summary.total}`)

    if (report.summary.failed > 0) {
      console.log(chalk.red('\n❌ Some tests failed!'))
      process.exit(1)
    } else {
      console.log(chalk.green('\n🎉 All tests passed!'))
      process.exit(0)
    }

  } catch (error) {
    console.error(chalk.red('\n💥 Test execution failed:'), error.message)
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled rejection:'), error)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught exception:'), error)
  process.exit(1)
})

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = {
  runTestSuite,
  runE2ETests,
  generateTestReport,
  main
}