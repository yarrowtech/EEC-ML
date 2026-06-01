# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Common Commands](#common-commands)
5. [Key Architecture Patterns](#key-architecture-patterns)
6. [Development Conventions](#development-conventions)
7. [Testing](#testing)

---

## Project Overview

**Project Name:** EEC (Electronic Educare)

**Purpose:** Multi-role educational management system supporting students, parents, teachers, administrators, principals, and super administrators.

**Core Modules:** Academic management, attendance, financial management (payments via Razorpay), real-time chat, notifications, AI tutoring, lesson planning, timetable management, and reporting.

**Type:** Full-stack React + Node.js/Express application with MongoDB and Socket.IO for real-time features.

---

## Tech Stack

**Frontend:** React 18, Vite, TailwindCSS, React Router, Hooks + Context API, Socket.IO, Chart.js, Recharts, Three.js, Quill editor

**Backend:** Node.js, Express 5, MongoDB (Mongoose), JWT auth, bcryptjs, Socket.IO, Nodemailer, Multer, Cloudinary, Razorpay, Pino logging

**Testing:** Jest (both frontend and backend), Supertest for API testing, @testing-library/react

---

## Directory Structure

### Key Backend Paths
- **Routes:** `/backend/routes/` (47 role-based route files)
- **Models:** `/backend/models/` (57 Mongoose schemas for all entities)
- **Middleware:** `/backend/middleware/` (role-based auth, logging, rate limiting)
- **Utilities:** `/backend/utils/` (logger, mailer, payments, file uploads, notifications)
- **Tests:** `/backend/__tests__/`

### Key Frontend Paths
- **Shared components:** `/frontend/src/components/`
- **Role portals:** `/frontend/src/{admin,teachers,parents,principal,Super Admin}/`
- **Theme context:** `/frontend/src/contexts/ThemeContext.jsx`
- **Custom hooks:** `/frontend/src/hooks/` (notifications, feedback)
- **Tests:** `/frontend/src/__tests__/`

### Documentation
- `/docs/` - API endpoint maps for each role
- `TESTING_GUIDE.md` - Test writing standards
- `AGENTS.md` - Developer conventions

---

## Common Commands

### Backend (`cd backend`)
```bash
npm run dev              # Development server (auto-reload via nodemon)
npm start               # Production server
npm test                # Run all tests
npm run test:watch      # Watch mode for tests
npm test -- path/to/file.test.js  # Run single test file
npm run test:coverage   # Coverage report
npm run swagger:gen     # Generate API docs (http://localhost:5000/api/docs)
npm run security:suite  # Security testing
npm run push:keys       # Generate VAPID keys for web push notifications
```

### Frontend (`cd frontend`)
```bash
npm run dev             # Dev server (port 5173, Vite)
npm run build           # Production build (outputs to dist/)
npm run preview         # Preview production build
npm run lint            # ESLint
npm test                # Run all tests
npm run test:watch      # Watch mode for tests
npm test -- path/to/Component.test.jsx  # Run single test file
npm run test:coverage   # Coverage report
```

---

## Configuration

### Backend `.env` (essential variables)
```env
MONGODB_URL=mongodb+srv://[user]:[password]@cluster.mongodb.net/
JWT_SECRET=<32-char hex key>
JWT_EXPIRES_IN=24H
PORT=5000
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
CORS_ORIGINS=http://localhost:5173,...
```

### Frontend `.env` (Vite variables prefixed with `VITE_`)
```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

Note: Never commit `.env` files; keep them locally only.

---

## Development Conventions

### Naming & Style
- **Frontend components:** PascalCase (e.g., `StudentDashboard.jsx`)
- **Frontend hooks:** camelCase with `use` prefix (e.g., `useAdminAuth.js`)
- **Backend routes:** `resourceRoute.js` or `resourceRoutes.js`
- **Backend models:** PascalCase (e.g., `StudentUser.js`)
- **Backend middleware:** Descriptive names (e.g., `authStudent.js`)
- **General:** Use `const`, arrow functions, async/await, template literals

### Git Workflow
- **Branch naming:** `feature/name`, `fix/description`, `hotfix/critical-issue`
- **Commits:** Use imperative mood ("Add feature" not "Added"), 50-char first line, reference issues

### Authentication & Authorization
The system uses **role-based JWT authentication** with role-specific middleware:
- Routes are protected by middleware: `authStudent`, `authTeacher`, `authParent`, `adminAuth`, `principalAuth`, `superAdminAuth`
- JWT tokens contain: `userId`, `role` (student|teacher|parent|admin|principal|superadmin), `schoolId`
- Every protected route has auth middleware that populates `req.userId` and `req.schoolId`

### Database Conventions
- **Collections:** Pluralized PascalCase (e.g., `StudentUsers`)
- **Fields:** camelCase (e.g., `firstName`)
- **References:** Use Mongoose ObjectId with `ref` for relationships
- **Indexes:** Add unique indexes for usernames/emails, compound indexes for frequent queries

### Logging Strategy
- Use **Pino** (structured JSON logging) via `/backend/utils/logger.js`
- Separate loggers: `securityEventLogger`, `authEventLogger`, `businessEventLogger`, `studentPortalLogger`
- Log security events (unauthorized access, failed logins); never log passwords/tokens
- All requests include correlation IDs for tracing

---

## Key Architecture Patterns

### API Route Base Paths
```
/api/admin/auth        - Admin authentication
/api/admin/users       - Admin user management
/api/admin/feedback    - Admin feedback handling
/api/student/auth      - Student authentication
/api/student           - Student-specific operations
/api/teacher/auth      - Teacher authentication
/api/teacher/dashboard - Teacher dashboard
/api/parent/auth       - Parent authentication
/api/principal/auth    - Principal authentication
/api/principal         - Principal dashboard
/api/auth              - Unified auth (cross-role)
/api/attendance        - Attendance tracking
/api/exam              - Exam management
/api/assignment        - Assignments
/api/chat              - Real-time chat
/api/notifications     - Push notifications
/api/fees              - Fee management
/api/timetable         - Timetable management
/api/lesson-plans      - Lesson planning
/api/docs              - Swagger UI documentation
```

### Request Flow
```
Request → Auth middleware (validates JWT, sets req.userId/schoolId)
        → Route handler
        → Database query via Mongoose
        → Response { success: bool, data, message }
```

Protected routes require corresponding middleware: `router.get('/path', authStudent, handler)`

### Frontend State Management
- **Auth:** JWT stored in `localStorage`, managed via custom hooks per role portal
- **Theme:** Global theme via `ThemeContext.jsx`
- **UI state:** Component-level hooks (useState, useEffect)
- **API calls:** Axios with interceptor that redirects to login on 401

### Real-time Communication (Socket.IO)
- **Server:** Listens for socket events and broadcasts to joined rooms (e.g., chat threads)
- **Client:** Emits events like `join_chat`, `send_message`; listens for `new_message` to update UI
- Both use connection URL from `process.env.VITE_API_URL`

### File Uploads
- **Local:** Multer stores files in `/backend/uploads/`
- **Cloud:** Cloudinary integration via `/backend/utils/cloudinaryUpload.js`

### Payment Processing (Razorpay)
- **Backend:** Create order with `razorpay.orders.create()`, convert amount to paise (multiply by 100)
- **Frontend:** Pass order details to Razorpay widget, handle response callback

### Error Handling
- **Backend:** Centralized error middleware + try-catch in async routes
- **Frontend:** Axios response interceptor for global error handling (401 → redirect to login)

---

## Testing

### Running Tests
```bash
# Backend
cd backend && npm test
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Frontend
cd frontend && npm test
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### Test File Locations
- Backend tests: `/backend/__tests__/` (API tests use Supertest)
- Frontend tests: `/frontend/src/**/__tests__/` (Components use Testing Library)

### Coverage Targets
- General code: 70-80%
- Critical paths (auth, payments, data): 90%+

See `TESTING_GUIDE.md` for detailed patterns and examples.

---

## API Response Format

All API responses follow this structure:
```json
{
  "success": true|false,
  "data": { ... },
  "message": "Optional string"
}
```

**Common headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Swagger docs:** `http://localhost:5000/api/docs` (auto-generated from code annotations)

---

## Additional Resources

- **API Maps:** `/docs/` (student, teacher, admin, super-admin endpoint documentation)
- **Testing Guides:** `TESTING_GUIDE.md`, `TEACHER_PORTAL_TESTING_GUIDE.md`, `MANUAL_TESTING_COMMANDS.md`
- **Developer Conventions:** `AGENTS.md`

---

**Last Updated:** 2026-05-26
