# Manual Testing Commands Guide

This guide shows you all the commands you can use to manually test your application in the terminal.

---

## Current student/parent parity status

The following cross-portal workflows are implemented and covered by focused tests:

- Teacher assignment publication → student visibility → written/PDF submission → teacher grading → published result.
- Student Results shows only teacher-published assignment marks and feedback.
- Student Fees shows student-scoped invoices, receipts, and online payment status.
- Student Health Record and Emotional Wellbeing show persisted school data, with truthful empty states instead of mock records.
- Students can submit and track complaints and view PTMs scheduled for them. PTM confirmation/rescheduling remains parent-only.

Focused verification commands are listed in the assignment and parity checklists below. The production frontend build also completes successfully with `npm run build`.

---

## Frontend Testing Commands

### 1. Basic Test Commands

```bash
# Navigate to frontend directory
cd "/media/koushik/New Volume/EEC-NIF/frontend"

# Run all tests once
npm test

# Run tests in watch mode (auto-rerun when files change)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### 2. Run Specific Tests

```bash
# Run a specific test file
npm test LoginForm.test.jsx

# Run tests matching a pattern in the name
npm test -- --testNamePattern="login"

# Run tests in a specific folder
npm test -- __tests__/components

# Run only tests that match a describe block
npm test -- --testNamePattern="Form Validation"
```

### 3. Verbose and Detailed Output

```bash
# Show more details about each test
npm test -- --verbose

# Show test names as they run
npm test -- --verbose --no-coverage

# Run with expanded error messages
npm test -- --expand

# Show all console.log outputs
npm test -- --verbose --silent=false
```

### 4. Watch Mode Options

```bash
# Start watch mode
npm run test:watch

# Once in watch mode, you can press:
# p - Filter by filename pattern
# t - Filter by test name pattern
# a - Run all tests
# f - Run only failed tests
# q - Quit watch mode
# Enter - Trigger a test run
```

### 5. Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage report in browser
# After running coverage, open:
# frontend/coverage/lcov-report/index.html
```

### 6. Debugging Tests

```bash
# Run tests with Node inspector (for debugging)
node --inspect-brk node_modules/.bin/jest --runInBand

# Run a single test file with detailed errors
npm test -- LoginForm.test.jsx --verbose --no-coverage
```

---

## Backend Testing Commands

### 1. Basic Test Commands

```bash
# Navigate to backend directory
cd "/media/koushik/New Volume/EEC-NIF/backend"

# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 2. Run Specific Tests

```bash
# Run a specific test file
npm test example.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="user"

# Run tests in a specific folder
npm test -- __tests__/api
```

### 3. Verbose Output

```bash
# Run with verbose output
npm test -- --verbose

# Show all test results
npm test -- --verbose --coverage
```

---

## Practical Examples

### Example 1: Run All Frontend Tests

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"
npm test
```

**Expected Output:**
```
 PASS  src/__tests__/example.test.jsx
 PASS  src/components/__tests__/LoginForm.test.jsx

Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        2.036 s
```

### Example 2: Run Only LoginForm Tests

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"
npm test LoginForm
```

**Expected Output:**
```
 PASS  src/components/__tests__/LoginForm.test.jsx
  LoginForm Component
    Rendering
      ✓ renders login form with all essential elements (45 ms)
      ✓ displays welcome message in login mode (12 ms)
    User Interactions
      ✓ allows user to type in username field (89 ms)
      ✓ toggles password visibility when eye icon is clicked (56 ms)
    ... more tests ...

Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
```

### Example 3: Run Tests with Coverage

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"
npm run test:coverage
```

**Expected Output:**
```
 PASS  src/components/__tests__/LoginForm.test.jsx
 PASS  src/__tests__/example.test.jsx

--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   78.5  |   65.2   |   82.1  |   79.3  |
 LoginForm.jsx      |   85.2  |   70.5   |   88.9  |   86.1  | 145-152,201-205
--------------------|---------|----------|---------|---------|-------------------

Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
```

### Example 4: Watch Mode (Interactive Testing)

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"
npm run test:watch
```

**You'll see an interactive prompt:**
```
Watch Usage
 › Press a to run all tests.
 › Press f to run only failed tests.
 › Press p to filter by a filename regex pattern.
 › Press t to filter by a test name regex pattern.
 › Press q to quit watch mode.
 › Press Enter to trigger a test run.
```

**Try this:**
1. Press `p` and type "Login" to run only LoginForm tests
2. Press `t` and type "validation" to run only validation tests
3. Make changes to your code and watch tests auto-run
4. Press `q` to quit

### Example 5: Run Only Failed Tests

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"

# First run all tests
npm test

# If some fail, run only failed ones
npm test -- --onlyFailures
```

### Example 6: Run Tests for a Specific Feature

```bash
# Run all tests related to "login"
npm test -- --testNamePattern="login"

# Run all tests in LoginForm describe blocks
npm test -- --testNamePattern="LoginForm"

# Run only validation tests
npm test -- --testNamePattern="validation"
```

### Example 7: Run Tests with Detailed Error Output

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"
npm test -- --verbose --expand
```

**This shows:**
- Each test name as it runs
- Full error stack traces
- Expanded object diffs
- All console.log outputs

### Example 8: Check a Single Test File Thoroughly

```bash
cd "/media/koushik/New Volume/EEC-NIF/frontend"
npm test -- LoginForm.test.jsx --verbose --coverage --expand
```

**This gives you:**
- Verbose output showing each test
- Coverage for that specific file
- Expanded error messages
- Detailed test results

---

## Understanding Test Output

### ✅ Passing Test Output
```
 PASS  src/components/__tests__/LoginForm.test.jsx
  LoginForm Component
    Rendering
      ✓ renders login form with all essential elements (45 ms)
```
- Green checkmark ✓ = test passed
- Time in parentheses = how long it took

### ❌ Failing Test Output
```
 FAIL  src/components/__tests__/LoginForm.test.jsx
  LoginForm Component
    Form Validation
      ✕ shows error when submitting with empty username (67 ms)

  ● LoginForm Component › Form Validation › shows error when submitting with empty username

    TestingLibraryElementError: Unable to find an element with the text: /User ID is required/i

      45 |       const submitButton = screen.getByRole('button', { name: /Sign In/i });
      46 |       await user.click(submitButton);
    > 47 |       expect(await screen.findByText(/User ID is required/i)).toBeInTheDocument();
         |                                                                 ^
```
- Red X ✕ = test failed
- Shows which test failed
- Shows the error message
- Shows the line where it failed

### 📊 Coverage Report Output
```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   78.5  |   65.2   |   82.1  |   79.3  |
 LoginForm.jsx      |   85.2  |   70.5   |   88.9  |   86.1  | 145-152,201-205
--------------------|---------|----------|---------|---------|-------------------
```

**What each column means:**
- **% Stmts** = Percentage of statements executed
- **% Branch** = Percentage of if/else branches tested
- **% Funcs** = Percentage of functions called
- **% Lines** = Percentage of lines executed
- **Uncovered Line #s** = Which lines weren't tested

---

## Quick Reference Commands

```bash
# Frontend - Most Used Commands
cd "/media/koushik/New Volume/EEC-NIF/frontend"

npm test                                    # Run all tests
npm test LoginForm                          # Run specific test file
npm run test:watch                          # Watch mode
npm run test:coverage                       # Coverage report
npm test -- --verbose                       # Detailed output
npm test -- --testNamePattern="validation"  # Filter by test name

# Backend - Most Used Commands
cd "/media/koushik/New Volume/EEC-NIF/backend"

npm test                    # Run all tests
npm test example.test.js    # Run specific file
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

---

## Tips for Manual Testing

### 1. Start with Watch Mode
Watch mode is great for development - it automatically reruns tests when you save files:
```bash
npm run test:watch
```

### 2. Run Specific Tests While Developing
Don't run all tests every time. Focus on what you're working on:
```bash
npm test LoginForm
```

### 3. Check Coverage Regularly
See which parts of your code aren't tested:
```bash
npm run test:coverage
```

### 4. Use Verbose Mode for Debugging
When a test fails and you need more info:
```bash
npm test -- --verbose --expand
```

### 5. Filter Tests by Name
Run only related tests:
```bash
# Only run form validation tests
npm test -- --testNamePattern="validation"

# Only run API-related tests
npm test -- --testNamePattern="API"
```

---

## Troubleshooting

### Tests are running slow?
```bash
# Run tests in parallel (default)
npm test

# Run tests sequentially (slower but easier to debug)
npm test -- --runInBand
```

### Can't see console.log outputs?
```bash
# Show all console outputs
npm test -- --verbose --silent=false
```

### Need to debug a specific test?
```bash
# Add this to your test file temporarily:
test.only('this specific test', () => {
  // your test
});

# Then run:
npm test
```

### Test is flaky (sometimes passes, sometimes fails)?
```bash
# Run the same test multiple times
npm test -- --testNamePattern="flaky test" --runInBand
```

---

## Interactive Testing Session Example

Here's a complete manual testing session:

```bash
# 1. Navigate to frontend
cd "/media/koushik/New Volume/EEC-NIF/frontend"

# 2. Run all tests to see current state
npm test

# 3. Check which test file you want to focus on
npm test -- --listTests

# 4. Run just the LoginForm tests
npm test LoginForm

# 5. Start watch mode to develop
npm run test:watch

# 6. In watch mode, press 'p' and type 'Login'
# Now only LoginForm tests run automatically as you code

# 7. When done, press 'q' to quit watch mode

# 8. Run final coverage check
npm run test:coverage

# 9. View detailed coverage in browser
# Open: frontend/coverage/lcov-report/index.html
```

---

## Multi-tenant Razorpay checklist

1. Set `PAYMENT_ENCRYPTION_KEY` to the output of `openssl rand -base64 32`, restart the backend, and run `cd backend && npm run payments:migrate` before `npm run payments:migrate:apply`.
2. Sign in as a school administrator on the school's tenant domain. Open **Settings → Payment Gateway** and confirm that invalid Test/Live key combinations cannot be saved.
3. Save valid Razorpay test credentials. Reload the page and confirm the Key ID remains visible while both secrets remain blank and cannot be recovered from API responses or logs.
4. Use **Test Connection**, then pay one due invoice from both the student and parent portals. Confirm the checkout Key ID is the school's key, the invoice/receipt updates once, and a retry does not duplicate the payment.
5. Send signed `payment.captured`, `payment.failed`, and `order.paid` test webhooks to `/api/payments/webhook`; repeat each delivery and confirm idempotency. Confirm an invalid signature returns 401.
6. Configure two test organizations with different Razorpay accounts. Confirm each tenant's order uses its own Key ID and that cross-tenant invoice IDs return 403/404.
7. As super admin, open **Organizations → Payment Status**. Confirm provider, enabled state, verification time, transaction totals, and subscription status are visible, but secrets are not.
8. Disconnect the gateway and confirm online checkout is blocked, credentials are removed, and prior receipts/audit records remain.

---

## Teacher assignment workflow checklist

Route checks:

- Manage and create assignments: `/teacher/classes/:classId/assignments/manage`
- Evaluate submissions: `/teacher/classes/:classId/assignments/evaluate`
- The legacy `/teacher/classes/:classId/assignments` route must redirect to the Manage route.

1. Sign in as a teacher and open **Assignments → Manage Assignments**. Confirm the URL ends in `/assignments/manage`, then create an active text assignment for one allocated class, section, subject, and active academic session. Select a published **Lesson Plan** and one of its **Chapters**; confirm plans from other classes, sections, subjects, or teachers are unavailable and that the saved assignment card/details show the chapter tag.
2. Sign in as a student in that class and section. Confirm the assignment appears, submit a written response, and confirm it becomes locked against editing or resubmission.
3. Sign in as a student in another class or section. Confirm the assignment is absent. Attempting to submit directly with the other assignment ID must return `403`.
4. Return as the teacher, open **Evaluate Submissions**, confirm the URL ends in `/assignments/evaluate`, select the submission, and confirm the complete submitted text is visible before marking. Refresh this URL and confirm the evaluation view remains selected. Repeat with a PDF-format assignment and confirm **Open submitted PDF** works.
5. Enter valid marks and feedback. Confirm marks above the assignment total are rejected and that a score of zero can be saved.
6. Before selecting **Publish Result**, return to the student portal and confirm the score and feedback remain hidden and the assignment says it is waiting for teacher review.
7. Select **Publish Result** as the teacher. Confirm the student receives a notification and can now see the score and feedback both on the assignment and under **Academics → Results → Published Assignment Results**.
8. Change a published grade. Confirm it becomes unpublished and must be explicitly published again before the revised result appears to the student.
9. Create a text essay with **Enable AI-assisted essay rubric review** and rubric criteria. Submit it as a student, then confirm the teacher sees the real persisted Ollama suggestion or a pending/failed status—never placeholder feedback or a fabricated confidence score.

Focused automated checks:

```bash
cd backend
npm test -- --runInBand --testPathPatterns=assignmentRoute.test.js

# Preview legacy active assignments missing an academic session; apply only after review.
npm run assignments:migrate-sessions
npm run assignments:migrate-sessions:apply

cd ../frontend
npm test -- --runInBand --runTestsByPath src/teachers/__tests__/AssignmentPortal.test.jsx src/components/__tests__/Assignment.test.jsx src/components/__tests__/ResultsView.test.jsx
```

---

## Student and parent portal parity checklist

1. Sign in as a student and open **Academics → Fees**. Confirm only that student's invoices and recent receipts appear. In Razorpay test mode, pay a partial amount and confirm the paid amount, balance, invoice status, and receipt update exactly once.
2. Open **Wellness → Health Record**. Confirm profile health fields come from the student's real record and that only teacher observations explicitly shared with the family are shown.
3. Open **Wellness → Emotional Wellbeing**. Confirm the latest school assessment appears, or a truthful empty state appears when none has been recorded; no sample/mock history should be displayed.
4. Open **Communication → Complaints**, submit a general complaint, and confirm it is assigned to School Admin. Submit an Academic complaint and confirm it is assigned to the class teacher when one is allocated.
5. Open **Communication → PTM Schedule**. Confirm only meetings for the signed-in student appear. A video meeting may expose its join link, but student controls must not confirm, decline, or reschedule the parent's meeting.
6. Sign in as a different student in the same school and verify they cannot see the first student's health record, wellbeing assessment, complaints, meetings, invoices, assignments, or results.

Focused automated checks:

```bash
cd backend
npm test -- --runInBand __tests__/studentPortalLogger.test.js __tests__/studentMeetingRoute.test.js __tests__/paymentLifecycleService.test.js

cd ../frontend
npm test -- --runInBand src/components/__tests__/StudentFamilyServices.test.jsx src/components/__tests__/StudentFees.test.jsx src/components/__tests__/Dashboard.test.jsx
```

---

## Summary

**Most Important Commands:**
1. `npm test` - Run all tests
2. `npm run test:watch` - Watch mode (auto-rerun)
3. `npm test LoginForm` - Run specific file
4. `npm run test:coverage` - See coverage
5. `npm test -- --verbose` - Detailed output

**Pro Tip:** Start with watch mode (`npm run test:watch`) when developing. It gives you instant feedback as you write code!
