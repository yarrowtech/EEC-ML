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
- **State management:** `/frontend/src/contexts/` (React Context API)
- **Hooks:** `/frontend/src/hooks/`
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
npm test -- --watch    # Watch mode for tests
npm run test:coverage   # Coverage report
npm run swagger:gen     # Generate API docs (http://localhost:5000/api/docs)
npm run security:suite  # Security testing
```

### Frontend (`cd frontend`)
```bash
npm run dev             # Dev server (port 5173, Vite)
npm run build           # Production build (outputs to dist/)
npm run preview         # Preview production build
npm run lint            # ESLint
npm test                # Run tests
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

### API Routes & Request Flow
```
Request → Auth middleware (validates JWT, sets req.userId/schoolId)
        → Route handler
        → Database query via Mongoose
        → Response { success: bool, data, message }
```

Protected routes require corresponding middleware: `router.get('/path', authStudent, handler)`

### Frontend State Management
- **Auth context:** Stored in `localStorage` under token, managed via React Context
- **UI state:** Hooks (useState, useEffect) + Context API for global state
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
npm run test:coverage

# Frontend
cd frontend && npm test
npm run test:coverage
```

### Test Pattern (Arrange-Act-Assert)
```javascript
describe('Feature', () => {
  it('should do X', async () => {
    // Arrange: setup test data
    const data = { ... };

    // Act: execute code
    const result = await action(data);

    // Assert: verify result
    expect(result).toBe(expected);
  });
});
```

### Backend Testing (Jest + Supertest)
Test API endpoints using Supertest. Example:
```javascript
const request = require('supertest');
const app = require('../index');

it('should login student', async () => {
  const response = await request(app)
    .post('/api/student/login')
    .send({ username: 'test', password: 'Test@123' });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
});
```

### Frontend Testing (Jest + @testing-library/react)
Test React components. Example:
```javascript
import { render, screen } from '@testing-library/react';

it('should render login form', () => {
  render(<LoginForm />);
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
});
```

### Coverage Targets
- General code: 70-80%
- Critical paths (auth, payments, data): 90%+

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

**Last Updated:** 2026-05-25
