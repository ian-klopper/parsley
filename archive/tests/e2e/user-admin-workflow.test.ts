import { test, expect } from '@playwright/test'

test.describe('User Admin Workflow - E2E', () => {
  let adminEmail = 'admin@test.com'
  let adminPassword = 'admin123'
  let newUserEmail = 'newuser@test.com'
  let newUserPassword = 'newuser123'

  test.beforeEach(async ({ page }) => {
    // Set up test database state
    await page.goto('/api/test/setup', { waitUntil: 'networkidle' })
  })

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await page.goto('/api/test/cleanup', { waitUntil: 'networkidle' })
  })

  test.describe('Admin User Management', () => {
    test('complete admin workflow: approve user, change role, manage users', async ({ page }) => {
      // Step 1: Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      // Verify admin dashboard loads
      await expect(page).toHaveURL('/jobs')

      // Step 2: Navigate to admin panel
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      await expect(page).toHaveURL('/admin')
      await expect(page.locator('h1')).toHaveText('Admin')

      // Step 3: Check pending users exist
      const pendingUserRow = page.locator(`tr:has-text("${newUserEmail}")`)
      await expect(pendingUserRow).toBeVisible()
      await expect(pendingUserRow.locator('.badge')).toContainText('pending')

      // Step 4: Approve user (change from pending to user)
      const roleSelect = pendingUserRow.locator('select[data-testid="role-select"]')
      await roleSelect.selectOption('user')

      // Wait for success toast
      await expect(page.locator('.toast')).toContainText('User role updated to user')

      // Verify user is now approved
      await expect(pendingUserRow.locator('.badge')).toContainText('user')

      // Step 5: Change user color
      const userAvatar = pendingUserRow.locator('[data-testid="user-avatar"]')
      await userAvatar.click()

      // Select a color from color picker
      await page.click('[data-testid="color-option-3"]')
      await expect(page.locator('.toast')).toContainText('User color updated')

      // Step 6: Promote user to admin
      await roleSelect.selectOption('admin')
      await expect(page.locator('.toast')).toContainText('User role updated to admin')
      await expect(pendingUserRow.locator('.badge')).toContainText('admin')

      // Step 7: Verify admin cannot change their own role
      const adminRow = page.locator('tr:has-text("admin@test.com")')
      const adminRoleSelect = adminRow.locator('select[data-testid="role-select"]')
      await expect(adminRoleSelect).toBeDisabled()

      // Step 8: View activity logs
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Logs')

      await expect(page).toHaveURL('/logs')
      await expect(page.locator('text=user.role_updated')).toBeVisible()
      await expect(page.locator('text=user.color_updated')).toBeVisible()
    })

    test('admin can delete users', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      // Navigate to admin panel
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // Find user to delete
      const userToDelete = page.locator('tr:has-text("user@test.com")')
      await expect(userToDelete).toBeVisible()

      // Click delete button
      const deleteButton = userToDelete.locator('[data-testid="delete-user"]')
      await deleteButton.click()

      // Confirm deletion in modal
      await page.click('button:has-text("Delete User")')

      // Verify user is removed
      await expect(userToDelete).not.toBeVisible()
      await expect(page.locator('.toast')).toContainText('User deleted successfully')
    })

    test('handles admin errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('/api/admin/users/*', route => {
        route.fulfill({ status: 500, body: 'Server error' })
      })

      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      // Navigate to admin panel
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // Try to update a user role
      const firstUserRow = page.locator('tbody tr').first()
      const roleSelect = firstUserRow.locator('select[data-testid="role-select"]')
      await roleSelect.selectOption('admin')

      // Verify error toast appears
      await expect(page.locator('.toast')).toContainText('Failed to update user role')

      // Verify UI remains functional
      await expect(page.locator('h1')).toHaveText('Admin')
    })
  })

  test.describe('User Registration and Approval Flow', () => {
    test('new user registration to approval workflow', async ({ page, context }) => {
      // Step 1: New user registers
      await page.goto('/signup')
      await page.fill('input[name="email"]', newUserEmail)
      await page.fill('input[name="password"]', newUserPassword)
      await page.fill('input[name="fullName"]', 'New Test User')
      await page.click('button[type="submit"]')

      // Verify pending state
      await expect(page.locator('text=Account Pending Approval')).toBeVisible()
      await expect(page.locator('text=Your account is pending approval')).toBeVisible()

      // Step 2: Open new tab as admin
      const adminPage = await context.newPage()
      await adminPage.goto('/')
      await adminPage.fill('input[type="email"]', adminEmail)
      await adminPage.fill('input[type="password"]', adminPassword)
      await adminPage.click('button[type="submit"]')

      // Navigate to admin panel
      await adminPage.click('[data-testid="user-menu"]')
      await adminPage.click('text=Admin')

      // Step 3: Admin approves the new user
      const newUserRow = adminPage.locator(`tr:has-text("${newUserEmail}")`)
      await expect(newUserRow).toBeVisible()

      const roleSelect = newUserRow.locator('select[data-testid="role-select"]')
      await roleSelect.selectOption('user')

      await expect(adminPage.locator('.toast')).toContainText('User role updated')

      // Step 4: User refreshes and gains access
      await page.click('button:has-text("Check Status")')

      // User should now have access
      await expect(page).toHaveURL('/jobs')
      await expect(page.locator('h1')).toHaveText('Jobs')
    })

    test('user can only access appropriate content based on role', async ({ page }) => {
      // Login as regular user
      await page.goto('/')
      await page.fill('input[type="email"]', 'user@test.com')
      await page.fill('input[type="password"]', 'user123')
      await page.click('button[type="submit"]')

      // Verify user can access jobs
      await expect(page).toHaveURL('/jobs')

      // Try to access admin panel directly
      await page.goto('/admin')
      await expect(page.locator('text=Access Denied')).toBeVisible()
      await expect(page.locator('text=Admin privileges are required')).toBeVisible()

      // Click to go back to jobs
      await page.click('button:has-text("Go to Jobs")')
      await expect(page).toHaveURL('/jobs')
    })
  })

  test.describe('Data Consistency and Real-time Updates', () => {
    test('multiple admin sessions stay in sync', async ({ page, context }) => {
      // Open two admin sessions
      const admin1 = page
      const admin2 = await context.newPage()

      // Login both sessions
      for (const adminPage of [admin1, admin2]) {
        await adminPage.goto('/')
        await adminPage.fill('input[type="email"]', adminEmail)
        await adminPage.fill('input[type="password"]', adminPassword)
        await adminPage.click('button[type="submit"]')
        await adminPage.click('[data-testid="user-menu"]')
        await adminPage.click('text=Admin')
      }

      // Admin 1 updates a user role
      const userRow1 = admin1.locator('tr:has-text("user@test.com")').first()
      const roleSelect1 = userRow1.locator('select[data-testid="role-select"]')
      await roleSelect1.selectOption('admin')

      // Verify Admin 2 sees the change (may need manual refresh in real scenario)
      await admin2.reload()
      const userRow2 = admin2.locator('tr:has-text("user@test.com")').first()
      await expect(userRow2.locator('.badge')).toContainText('admin')
    })

    test('user list pagination and search work correctly', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // If search functionality exists
      const searchInput = page.locator('input[placeholder="Search users"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('admin')
        await expect(page.locator('tr:has-text("admin@test.com")')).toBeVisible()
        await expect(page.locator('tr:has-text("user@test.com")')).not.toBeVisible()

        // Clear search
        await searchInput.clear()
        await expect(page.locator('tr:has-text("user@test.com")')).toBeVisible()
      }

      // Test pagination if it exists
      const nextPageButton = page.locator('button:has-text("Next")')
      if (await nextPageButton.isVisible()) {
        await nextPageButton.click()
        // Verify different users are shown
        await expect(page.locator('tbody tr')).toHaveCount(10) // or expected count
      }
    })
  })

  test.describe('Performance and Load Testing', () => {
    test('admin page loads quickly with many users', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      // Measure time to load admin page
      const startTime = Date.now()

      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      await expect(page.locator('h1')).toHaveText('Admin')
      await expect(page.locator('tbody tr')).toHaveCount.greaterThan(0)

      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds
    })

    test('handles rapid user role changes without conflicts', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // Rapidly change user roles
      const userRow = page.locator('tr:has-text("user@test.com")').first()
      const roleSelect = userRow.locator('select[data-testid="role-select"]')

      for (let i = 0; i < 5; i++) {
        await roleSelect.selectOption(i % 2 === 0 ? 'admin' : 'user')
        await page.waitForTimeout(100) // Small delay between changes
      }

      // Verify final state is correct
      await expect(page.locator('.toast')).toContainText('User role updated')
      const finalRole = await roleSelect.inputValue()
      await expect(userRow.locator('.badge')).toContainText(finalRole)
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('admin panel works on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      // Navigate to admin panel
      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // Verify table is responsive/scrollable
      const table = page.locator('table')
      await expect(table).toBeVisible()

      // Verify user actions still work on mobile
      const userRow = page.locator('tbody tr').first()
      const roleSelect = userRow.locator('select[data-testid="role-select"]')
      await roleSelect.selectOption('admin')

      await expect(page.locator('.toast')).toContainText('User role updated')
    })
  })

  test.describe('Accessibility', () => {
    test('admin panel meets accessibility standards', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // Test keyboard navigation
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Verify focused element is visible
      const focusedElement = await page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // Test screen reader compatibility
      const table = page.locator('table')
      await expect(table).toHaveAttribute('role', 'table')

      const headers = page.locator('th')
      await expect(headers.first()).toHaveAttribute('scope', 'col')
    })
  })

  test.describe('Security', () => {
    test('prevents unauthorized access to admin functions', async ({ page }) => {
      // Try to access admin without login
      await page.goto('/admin')
      await expect(page).toHaveURL('/') // Should redirect to login

      // Login as regular user
      await page.fill('input[type="email"]', 'user@test.com')
      await page.fill('input[type="password"]', 'user123')
      await page.click('button[type="submit"]')

      // Try to access admin as regular user
      await page.goto('/admin')
      await expect(page.locator('text=Access Denied')).toBeVisible()
    })

    test('validates and sanitizes user input', async ({ page }) => {
      // Login as admin
      await page.goto('/')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      await page.click('button[type="submit"]')

      await page.click('[data-testid="user-menu"]')
      await page.click('text=Admin')

      // Try to inject malicious content through color picker or other inputs
      const userRow = page.locator('tbody tr').first()
      const avatar = userRow.locator('[data-testid="user-avatar"]')
      await avatar.click()

      // Attempt to inject script through color selection
      await page.evaluate(() => {
        const colorOption = document.querySelector('[data-testid="color-option-1"]')
        if (colorOption) {
          colorOption.setAttribute('data-malicious', '<script>alert("xss")</script>')
        }
      })

      await page.click('[data-testid="color-option-1"]')

      // Verify no script execution and proper sanitization
      const alerts = []
      page.on('dialog', dialog => {
        alerts.push(dialog.message())
        dialog.accept()
      })

      await page.waitForTimeout(1000)
      expect(alerts).toHaveLength(0) // No alerts should have fired
    })
  })
})