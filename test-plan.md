# Test Plan: Job and User Management System

**1. Authentication and Authorization**

*   **1.1. New User Registration:**
    *   **Test Case:** A new user signs up.
    *   **Expected Result:** The user is created with a `pending` role. They should see a "Pending Approval" page and have no access to the dashboard.
*   **1.2. Admin Approval:**
    *   **Test Case:** An admin approves a `pending` user.
    *   **Expected Result:** The user's role is changed to `user`. They should now have access to the dashboard.
*   **1.3. User Login/Logout:**
    *   **Test Case:** A registered user logs in and out.
    *   **Expected Result:** The user can successfully log in and out.
*   **1.4. Role-Based Access Control (RBAC):**
    *   **Test Case:** A `user` role tries to access admin-only features (e.g., approving users).
    *   **Expected Result:** The user is denied access.
    *   **Test Case:** An `admin` role accesses admin-only features.
    *   **Expected Result:** The admin can successfully access the features.

**2. Job Management**

*   **2.1. Create Job:**
    *   **Test Case:** A user creates a new job, specifying a venue, job ID, and collaborators.
    *   **Expected Result:** The job is created successfully. The creator is automatically added as a collaborator and set as the owner.
*   **2.2. View Jobs:**
    *   **Test Case:** A user navigates to the dashboard.
    *   **Expected Result:** The user can see a list of all jobs they are a collaborator on.
*   **2.3. View Job Details:**
    *   **Test Case:** A user clicks on a job in the dashboard.
    *   **Expected Result:** The user is navigated to the job details page.
*   **2.4. Update Job:**
    *   **Test Case:** A user with ownership or admin rights updates a job's details (e.g., status).
    *   **Expected Result:** The job is updated successfully.
*   **2.5. Delete Job:**
    *   **Test Case:** A user with ownership or admin rights deletes a job.
    *   **Expected Result:** The job is deleted successfully.
*   **2.6. Transfer Ownership:**
    *   **Test Case:** A user with ownership or admin rights transfers ownership of a job to another user.
    *   **Expected Result:** The ownership is transferred successfully. The new owner is automatically added as a collaborator if they are not already.

**3. User Management (Admin)**

*   **3.1. View Users:**
    *   **Test Case:** An admin navigates to the user management page.
    *   **Expected Result:** The admin can see a list of all users, including their roles and statuses.
*   **3.2. Update User Role:**
    *   **Test Case:** An admin changes a user's role (e.g., from `user` to `admin`).
    *   **Expected Result:** The user's role is updated successfully.
*   **3.3. Update User Color:**
    *   **Test Case:** An admin changes a user's color.
    *   **Expected Result:** The user's color is updated successfully.

**4. Real-time Updates**

*   **4.1. Job Creation:**
    *   **Test Case:** A user creates a new job.
    *   **Expected Result:** The new job appears in the dashboard of all collaborators in real-time.
*   **4.2. Job Updates:**
    *   **Test Case:** A user updates a job's status.
    *   **Expected Result:** The job's status is updated in the dashboard of all collaborators in real-time.
*   **4.3. User Updates:**
    *   **Test Case:** An admin approves a new user.
    *   **Expected Result:** The new user's status is updated in the user management list in real-time.

**5. UI/UX**

*   **5.1. Dashboard Layout:**
    *   **Test Case:** A user views the dashboard.
    *   **Expected Result:** The dashboard is laid out correctly, with the combined "Venue / Job ID" column and the "Creator" column hidden.
*   **5.2. Create Job Modal:**
    *   **Test Case:** A user opens the "Create New Job" modal.
    *   **Expected Result:** The modal is the correct width, the collaborator list has no border, and the user initials are displayed correctly. The collaborator selection is a toggle, and the owner can be set in one step.
*   **5.3. Clickable Rows:**
    *   **Test Case:** A user clicks on a job row in the dashboard.
    *   **Expected Result:** The user is navigated to the job details page.
*   **5.4. Delete Job Icon:**
    *   **Test Case:** A user hovers over a job row.
    *   **Expected Result:** A trashcan icon appears for deleting the job.
