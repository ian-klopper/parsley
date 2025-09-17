import { test, expect } from '@playwright/test'

// E2E tests for complete job and collaboration workflow
describe('Job and Collaboration Workflow - E2E', () => {
  let jobOwnerEmail = 'jobowner@test.com'
  let jobOwnerPassword = 'owner123'
  let collaboratorEmail = 'collaborator@test.com'
  let collaboratorPassword = 'collab123'
  let adminEmail = 'admin@test.com'
  let adminPassword = 'admin123'

  test.beforeEach(async ({ page }) => {
    // Set up test database state
    await page.goto('/api/test/setup', { waitUntil: 'networkidle' })
  })

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await page.goto('/api/test/cleanup', { waitUntil: 'networkidle' })
  })

  test.describe('Job Creation and Management', () => {
    test('complete job lifecycle: create, update, collaborate, complete', async ({ page, context }) => {
      // Step 1: Login as job owner
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      // Verify jobs page loads
      await expect(page).toHaveURL('/jobs')
      await expect(page.locator('h1')).toHaveText('Jobs')

      // Step 2: Create new job
      await page.click('button:has-text("New Job")')

      // Fill job creation form
      await page.fill('input[name="venue"]', 'Test Restaurant E2E')
      await page.fill('input[name="jobId"]', 'E2E-TEST-001')

      // Select collaborators
      const collaboratorSwitch = page.locator('[data-testid="collaborator-switch"]').first()
      await collaboratorSwitch.check()

      // Upload files (mock file upload)
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'test-menu.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('mock pdf content')
      })

      // Create job
      await page.click('button:has-text("Create Job")')

      // Verify job creation success
      await expect(page.locator('.toast')).toContainText('Job created successfully')

      // Step 3: Verify job appears in list
      await expect(page.locator('text=Test Restaurant E2E')).toBeVisible()
      await expect(page.locator('text=E2E-TEST-001')).toBeVisible()
      await expect(page.locator('.badge:has-text("draft")')).toBeVisible()

      // Step 4: Navigate to job detail
      await page.click('text=Test Restaurant E2E')

      await expect(page).toHaveURL(/\/job\?id=/)
      await expect(page.locator('h1')).toHaveText('Test Restaurant E2E')

      // Step 5: Start extraction process
      await page.click('button:has-text("Start Extraction")')

      // Verify tabs appear
      await expect(page.locator('text=Food')).toBeVisible()
      await expect(page.locator('text=Cocktails + Shots')).toBeVisible()
      await expect(page.locator('text=Menu Structure')).toBeVisible()

      // Step 6: Navigate through tabs
      await page.click('text=Wine')
      await expect(page.locator('[aria-selected="true"]:has-text("Wine")')).toBeVisible()

      await page.click('text=Menu Structure')
      await expect(page.locator('text=Menu Structure details will go here')).toBeVisible()

      // Step 7: Manage collaborators
      await page.click('[data-testid="manage-collaborators"]')
      await expect(page.locator('text=Manage Collaborators')).toBeVisible()

      // Add another collaborator
      const additionalCollaboratorSwitch = page.locator('[data-testid="user-switch"]').nth(1)
      await additionalCollaboratorSwitch.check()

      await page.click('button:has-text("Update Collaborators")')
      await expect(page.locator('.toast')).toContainText('Collaborators updated')

      // Step 8: Update job status
      await page.goto('/jobs')
      const jobRow = page.locator('tr:has-text("Test Restaurant E2E")')

      // Status should still be draft initially
      await expect(jobRow.locator('.badge')).toHaveText('draft')
    })

    test('collaborator workflow: receive access, collaborate, view restrictions', async ({ page, context }) => {
      // First, create a job as owner (using previous test setup)
      const ownerPage = await context.newPage()
      await ownerPage.goto('/')
      await ownerPage.fill('input[type="email"]', jobOwnerEmail)
      await ownerPage.fill('input[type="password"]', jobOwnerPassword)
      await ownerPage.click('button[type="submit"]')

      // Create job with collaborator
      await ownerPage.click('button:has-text("New Job")')
      await ownerPage.fill('input[name="venue"]', 'Collaboration Test Venue')
      await ownerPage.fill('input[name="jobId"]', 'COLLAB-TEST-001')

      const collaboratorSwitch = ownerPage.locator('[data-testid="collaborator-switch"]').first()
      await collaboratorSwitch.check()

      await ownerPage.click('button:has-text("Create Job")')
      await expect(ownerPage.locator('.toast')).toContainText('Job created successfully')

      // Now login as collaborator
      await page.goto('/')
      await page.fill('input[type="email"]', collaboratorEmail)
      await page.fill('input[type="password"]', collaboratorPassword)
      await page.click('button[type="submit"]')

      // Verify collaborator can see the job
      await expect(page.locator('text=Collaboration Test Venue')).toBeVisible()

      // Navigate to job detail
      await page.click('text=Collaboration Test Venue')
      await expect(page.locator('h1')).toHaveText('Collaboration Test Venue')

      // Verify collaborator can view but has limited permissions
      // Collaborator should NOT see collaborator management icon
      await expect(page.locator('[data-testid="manage-collaborators"]')).not.toBeVisible()

      // Collaborator can start extraction
      await page.click('button:has-text("Start Extraction")')
      await expect(page.locator('text=Food')).toBeVisible()

      // Collaborator can navigate tabs
      await page.click('text=Wine')
      await expect(page.locator('[aria-selected="true"]:has-text("Wine")')).toBeVisible()
    })

    test('job ownership transfer workflow', async ({ page, context }) => {
      // Create job as original owner
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Transfer Test Venue')
      await page.fill('input[name="jobId"]', 'TRANSFER-001')
      await page.click('button:has-text("Create Job")')

      // Navigate to job detail
      await page.click('text=Transfer Test Venue')

      // Transfer ownership to collaborator
      await page.click('[data-testid="job-menu"]')
      await page.click('text=Transfer Ownership')

      // Select new owner
      await page.selectOption('select[name="newOwner"]', { label: 'Collaborator User' })
      await page.click('button:has-text("Transfer Ownership")')

      await expect(page.locator('.toast')).toContainText('Ownership transferred')

      // Login as new owner and verify access
      const newOwnerPage = await context.newPage()
      await newOwnerPage.goto('/')
      await newOwnerPage.fill('input[type="email"]', collaboratorEmail)
      await newOwnerPage.fill('input[type="password"]', collaboratorPassword)
      await newOwnerPage.click('button[type="submit"]')

      await newOwnerPage.click('text=Transfer Test Venue')

      // New owner should now have management capabilities
      await expect(newOwnerPage.locator('[data-testid="manage-collaborators"]')).toBeVisible()

      // Original owner should lose management capabilities
      await page.reload()
      await expect(page.locator('[data-testid="manage-collaborators"]')).not.toBeVisible()
    })
  })

  test.describe('Admin Job Management', () => {
    test('admin can view and manage all jobs', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      // Admin should see all jobs regardless of ownership
      await expect(page.locator('h1')).toHaveText('Jobs')

      // Create test data by creating jobs as different users first
      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Admin Test Venue')
      await page.fill('input[name="jobId"]', 'ADMIN-TEST-001')
      await page.click('button:has-text("Create Job")')

      // Navigate to any job
      await page.click('text=Admin Test Venue')

      // Admin should have all management capabilities
      await expect(page.locator('[data-testid="manage-collaborators"]')).toBeVisible()

      // Admin can manage collaborators
      await page.click('[data-testid="manage-collaborators"]')
      const userSwitch = page.locator('[data-testid="user-switch"]').first()
      await userSwitch.check()
      await page.click('button:has-text("Update Collaborators")')

      await expect(page.locator('.toast')).toContainText('Collaborators updated')

      // Admin can delete jobs
      await page.goto('/jobs')
      const jobRow = page.locator('tr:has-text("Admin Test Venue")')
      await jobRow.locator('[data-testid="delete-job"]').click()
      await page.click('button:has-text("Delete Job")')

      await expect(page.locator('.toast')).toContainText('Job deleted')
      await expect(page.locator('text=Admin Test Venue')).not.toBeVisible()
    })
  })

  test.describe('Real-time Collaboration', () => {
    test('multiple users can collaborate on job simultaneously', async ({ page, context }) => {
      // Create job as owner
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Realtime Collaboration Test')
      await page.fill('input[name="jobId"]', 'REALTIME-001')

      const collaboratorSwitch = page.locator('[data-testid="collaborator-switch"]').first()
      await collaboratorSwitch.check()

      await page.click('button:has-text("Create Job")')

      // Navigate to job and start extraction
      await page.click('text=Realtime Collaboration Test')
      await page.click('button:has-text("Start Extraction")')

      // Open collaborator session
      const collaboratorPage = await context.newPage()
      await collaboratorPage.goto('/')
      await collaboratorPage.fill('input[type="email"]', collaboratorEmail)
      await collaboratorPage.fill('input[type="password"]', collaboratorPassword)
      await collaboratorPage.click('button[type="submit"]')

      await collaboratorPage.click('text=Realtime Collaboration Test')
      await collaboratorPage.click('button:has-text("Start Extraction")')

      // Both users work on different tabs simultaneously
      await page.click('text=Food')
      await collaboratorPage.click('text=Wine')

      // Verify both can work independently
      await expect(page.locator('[aria-selected="true"]:has-text("Food")')).toBeVisible()
      await expect(collaboratorPage.locator('[aria-selected="true"]:has-text("Wine")')).toBeVisible()

      // Owner makes changes that collaborator should see
      await page.click('[data-testid="manage-collaborators"]')
      const additionalSwitch = page.locator('[data-testid="user-switch"]').nth(1)
      await additionalSwitch.check()
      await page.click('button:has-text("Update Collaborators")')

      // Collaborator refreshes and sees changes
      await collaboratorPage.reload()
      await expect(collaboratorPage.locator('text=Realtime Collaboration Test')).toBeVisible()
    })
  })

  test.describe('Job Status Transitions', () => {
    test('job progresses through complete status lifecycle', async ({ page }) => {
      // Login and create job
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Status Lifecycle Test')
      await page.fill('input[name="jobId"]', 'STATUS-001')
      await page.click('button:has-text("Create Job")')

      // Job starts as draft
      const jobRow = page.locator('tr:has-text("Status Lifecycle Test")')
      await expect(jobRow.locator('.badge')).toHaveText('draft')

      // Navigate to job detail
      await page.click('text=Status Lifecycle Test')

      // Change to live status
      await page.click('[data-testid="status-menu"]')
      await page.click('text=Make Live')
      await expect(page.locator('.badge')).toHaveText('live')

      // Start processing
      await page.click('[data-testid="status-menu"]')
      await page.click('text=Start Processing')
      await expect(page.locator('.badge')).toHaveText('processing')

      // Complete the job
      await page.click('[data-testid="status-menu"]')
      await page.click('text=Mark Complete')
      await expect(page.locator('.badge')).toHaveText('complete')

      // Verify completed job has limited editing capabilities
      await expect(page.locator('[data-testid="manage-collaborators"]')).toBeDisabled()
    })

    test('handles status transition validation', async ({ page }) => {
      // Create job and try invalid status transitions
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Invalid Transition Test')
      await page.fill('input[name="jobId"]', 'INVALID-001')
      await page.click('button:has-text("Create Job")')

      await page.click('text=Invalid Transition Test')

      // Try to jump from draft to complete (should be prevented)
      await page.click('[data-testid="status-menu"]')

      // Complete option should not be available from draft
      await expect(page.locator('text=Mark Complete')).not.toBeVisible()

      // Should only see valid transitions
      await expect(page.locator('text=Make Live')).toBeVisible()
    })
  })

  test.describe('File Upload and Processing', () => {
    test('file upload and extraction workflow', async ({ page }) => {
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'File Upload Test')
      await page.fill('input[name="jobId"]', 'UPLOAD-001')

      // Upload multiple file types
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles([
        {
          name: 'menu.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF content')
        },
        {
          name: 'prices.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('Excel content')
        },
        {
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('JPEG content')
        }
      ])

      await page.click('button:has-text("Create Job")')
      await page.click('text=File Upload Test')

      // Verify files are uploaded
      await expect(page.locator('text=3 files uploaded')).toBeVisible()

      // Start extraction
      await page.click('button:has-text("Start Extraction")')

      // Verify extraction progress
      await expect(page.locator('text=Processing files...')).toBeVisible()

      // Wait for extraction to complete
      await expect(page.locator('text=Food')).toBeVisible({ timeout: 10000 })

      // Verify extracted data appears in tabs
      await page.click('text=Food')
      await expect(page.locator('[data-testid="item-table"]')).toBeVisible()
    })

    test('handles file upload errors', async ({ page }) => {
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Upload Error Test')
      await page.fill('input[name="jobId"]', 'ERROR-001')

      // Try to upload unsupported file type
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Text content')
      })

      // Should show error for unsupported file type
      await expect(page.locator('.toast')).toContainText('Unsupported file type')

      // Upload valid file but simulate server error
      await page.route('/api/jobs/*/upload', route => {
        route.fulfill({ status: 500, body: 'Upload failed' })
      })

      await fileInput.setInputFiles({
        name: 'valid.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content')
      })

      await expect(page.locator('.toast')).toContainText('Upload failed')
    })
  })

  test.describe('Data Export and Sharing', () => {
    test('export job data in multiple formats', async ({ page }) => {
      // Create and populate job
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      await page.click('button:has-text("New Job")')
      await page.fill('input[name="venue"]', 'Export Test Venue')
      await page.fill('input[name="jobId"]', 'EXPORT-001')
      await page.click('button:has-text("Create Job")')

      await page.click('text=Export Test Venue')
      await page.click('button:has-text("Start Extraction")')

      // Add some data to tables
      await page.click('text=Food')
      await page.fill('[data-testid="item-name-input"]', 'Test Food Item')
      await page.click('button:has-text("Add Item")')

      // Export data
      await page.click('[data-testid="export-menu"]')

      // Test CSV export
      const csvDownload = page.waitForEvent('download')
      await page.click('text=Export CSV')
      const csvFile = await csvDownload
      expect(csvFile.suggestedFilename()).toBe('Export-Test-Venue-food.csv')

      // Test Excel export
      const excelDownload = page.waitForEvent('download')
      await page.click('text=Export Excel')
      const excelFile = await excelDownload
      expect(excelFile.suggestedFilename()).toBe('Export-Test-Venue-food.xlsx')

      // Test PDF export
      const pdfDownload = page.waitForEvent('download')
      await page.click('text=Export PDF')
      const pdfFile = await pdfDownload
      expect(pdfFile.suggestedFilename()).toBe('Export-Test-Venue-food.pdf')
    })
  })

  test.describe('Performance and Scalability', () => {
    test('handles large number of jobs efficiently', async ({ page }) => {
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      // Measure initial load time
      const startTime = Date.now()
      await expect(page.locator('h1')).toHaveText('Jobs')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(3000) // Should load within 3 seconds

      // Test pagination if many jobs exist
      const jobRows = page.locator('tbody tr')
      const jobCount = await jobRows.count()

      if (jobCount > 10) {
        // Test pagination
        await page.click('[data-testid="next-page"]')
        await expect(page.locator('[data-testid="page-indicator"]')).toContainText('Page 2')
      }

      // Test search functionality
      await page.fill('[data-testid="search-input"]', 'Test')
      await expect(jobRows.first()).toBeVisible({ timeout: 2000 })
    })

    test('job detail page loads quickly with complex data', async ({ page }) => {
      await page.goto('/')
      await page.fill('input[type="email"]', jobOwnerEmail)
      await page.fill('input[type="password"]', jobOwnerPassword)
      await page.click('button[type="submit"]')

      // Navigate to complex job
      const startTime = Date.now()
      await page.click('tbody tr:first-child')

      await expect(page.locator('h1')).toBeVisible()
      const navigationTime = Date.now() - startTime

      expect(navigationTime).toBeLessThan(2000) // Should navigate within 2 seconds

      // Start extraction and measure tab switching performance
      await page.click('button:has-text("Start Extraction")')

      const tabSwitchStart = Date.now()
      await page.click('text=Wine')
      await expect(page.locator('[aria-selected="true"]:has-text("Wine")')).toBeVisible()
      const tabSwitchTime = Date.now() - tabSwitchStart

      expect(tabSwitchTime).toBeLessThan(500) // Tab switching should be fast
    })
  })
})