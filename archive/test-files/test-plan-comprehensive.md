# Comprehensive User Acceptance Test Plan

## Test Environment
- URL: https://8080-firebase-parsley-1757521220142.cluster-thle3dudhffpwss7zs5hxaeu2o.cloudworkstations.dev
- Current Admin User: 70ba730a-d711-42ce-8eb0-19a5be20df7c (ian.klopper@gmail.com)

## Test User Scenarios

### Test User 1: Anonymous (Unauthenticated)
**Role**: None (not logged in)
**Expected Access**: Public pages only, redirected to login for protected content

### Test User 2: Pending User  
**Role**: pending
**Expected Access**: Limited access, cannot perform most actions

### Test User 3: Regular User
**Role**: user  
**Expected Access**: Standard user features, no admin functions

### Test User 4: Admin User
**Role**: admin
**Expected Access**: Full access to all features including user management

---

## Test Cases

### TC001: Page Access Control
| Page | Anonymous | Pending | User | Admin | Expected Result |
|------|-----------|---------|------|-------|----------------|
| `/` | ✓ | ✓ | ✓ | ✓ | Public landing page |
| `/jobs` | ❌ | ❌ | ✓ | ✓ | Jobs listing |
| `/job` | ❌ | ❌ | ✓ | ✓ | Create new job |
| `/admin` | ❌ | ❌ | ❌ | ✓ | Admin panel |
| `/logs` | ❌ | ❌ | ❌ | ✓ | Activity logs |

### TC002: Authentication Flow
| Test | Action | Expected Result |
|------|--------|----------------|
| TC002.1 | Visit protected page while unauthenticated | Redirect to auth |
| TC002.2 | Sign in with Google | Redirect to appropriate page based on role |
| TC002.3 | Sign out | Return to public page |

### TC003: User Profile Management  
| Test | Role | Action | Expected Result |
|------|------|--------|----------------|
| TC003.1 | user | View own profile | Show profile data |
| TC003.2 | user | Edit own profile | Save changes successfully |
| TC003.3 | user | View other user profiles | Restricted/no access |
| TC003.4 | admin | View all user profiles | Full access |
| TC003.5 | admin | Edit other user profiles | Full access |

### TC004: Job Management
| Test | Role | Action | Expected Result |
|------|------|--------|----------------|
| TC004.1 | user | View jobs list | Show user's jobs + collaborations |
| TC004.2 | user | Create new job | Success, user as creator |
| TC004.3 | user | Edit own job | Success |
| TC004.4 | user | Edit other's job | Fail/restricted |
| TC004.5 | admin | View all jobs | Show all jobs in system |
| TC004.6 | admin | Edit any job | Success |

### TC005: Admin Functions - User Management
| Test | Action | Expected Result |
|------|--------|----------------|
| TC005.1 | View admin panel | Load user list successfully |
| TC005.2 | Change user role (pending → user) | Update successful, show confirmation |
| TC005.3 | Change user role (user → admin) | Update successful, show confirmation |
| TC005.4 | Change user role (admin → user) | Update successful, show confirmation |
| TC005.5 | Change own admin role | Should be disabled/blocked |
| TC005.6 | Change user color | Update successful, reflect immediately |
| TC005.7 | View user details | Show complete user information |

### TC006: Admin Functions - Activity Logs  
| Test | Action | Expected Result |
|------|--------|----------------|
| TC006.1 | View activity logs page | Load all system activity |
| TC006.2 | Filter logs by user | Show filtered results |
| TC006.3 | Filter logs by action | Show filtered results |
| TC006.4 | View log details | Show complete log information |

### TC007: Database Operations Testing
| Test | Table | Operation | Role | Expected Result |
|------|-------|-----------|------|----------------|
| TC007.1 | users | SELECT own | user | Success |
| TC007.2 | users | SELECT others | user | Limited/filtered |
| TC007.3 | users | SELECT all | admin | Success |
| TC007.4 | users | UPDATE own | user | Success |
| TC007.5 | users | UPDATE others | user | Fail |
| TC007.6 | users | UPDATE others | admin | Success |
| TC007.7 | activity_logs | SELECT own | user | Success |
| TC007.8 | activity_logs | SELECT all | admin | Success |
| TC007.9 | jobs | CREATE | user | Success |
| TC007.10 | jobs | UPDATE own | user | Success |
| TC007.11 | jobs | UPDATE others | user | Fail |
| TC007.12 | jobs | UPDATE any | admin | Success |

### TC008: User Interface Testing
| Test | Component | Action | Expected Result |
|------|-----------|--------|----------------|
| TC008.1 | User avatar | Display initials | Show correct initials |
| TC008.2 | User avatar | Display color | Show assigned color |
| TC008.3 | Role badge | Display role | Show correct role with proper styling |
| TC008.4 | Navigation | Show admin links | Only for admin users |
| TC008.5 | Forms | Role dropdown | Populated with valid options |
| TC008.6 | Forms | Color picker | Show color spectrum |

### TC009: Error Handling
| Test | Scenario | Expected Result |
|------|----------|----------------|
| TC009.1 | Network error during role change | Show error message, don't update UI |
| TC009.2 | Unauthorized action attempt | Show permission denied message |
| TC009.3 | Invalid data submission | Show validation errors |
| TC009.4 | Session timeout | Redirect to login |
| TC009.5 | Database connection failure | Show appropriate error state |

### TC010: Security Testing
| Test | Scenario | Expected Result |
|------|----------|----------------|
| TC010.1 | Direct URL access to admin page (non-admin) | Block access |
| TC010.2 | API call to admin endpoint (non-admin) | Return 403/401 |
| TC010.3 | Attempt to modify other user's data | Blocked by RLS |
| TC010.4 | SQL injection in forms | Blocked/sanitized |
| TC010.5 | XSS attempt in user input | Blocked/sanitized |

---

## Test Execution Status

### Current Status: ❌ NOT STARTED
**Reason**: Need to execute each test case systematically

### Test Environment Setup
- [ ] Database tables exist and accessible
- [ ] Admin user properly configured  
- [ ] Test users created for different roles
- [ ] Application running and accessible

### Execution Notes
Will document actual results vs expected for each test case.

---

## Test Data Setup Required

### Users Needed for Testing:
1. **Admin User**: 70ba730a-d711-42ce-8eb0-19a5be20df7c (existing)
2. **Regular User**: To be created
3. **Pending User**: To be created  

### Jobs Needed:
1. Job created by admin
2. Job created by regular user
3. Job with collaborators

### Activity Logs:
1. User role changes
2. Job creation/updates  
3. User profile updates