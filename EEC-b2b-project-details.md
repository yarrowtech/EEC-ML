# EEC ML — Project Details

## Project summary

**Project name:** EEC ML (Electronic Educare)

EEC ML is a multi-tenant school-management and AI-assisted learning platform. It combines the daily operational needs of a school—student records, attendance, academics, examinations, fees, staff, parent communication, reporting, and administration—with an AI learning environment grounded in teacher-approved educational material.

The product is designed as one connected system for six principal user roles:

- Students
- Parents and guardians
- Teachers
- School administrators
- Principals and school leaders
- Platform super administrators

Each role receives a protected portal with tools and information appropriate to its responsibilities. The platform preserves school and organization boundaries through tenant-aware authentication and data isolation, allowing multiple educational organizations to use the same application securely.

The AI layer is more than a general chatbot. Teachers can upload curriculum material, which is extracted, processed, embedded, and stored for retrieval. Students can then receive contextual explanations, homework guidance, quizzes, summaries, notes, flashcards, mind maps, language feedback, and other learning support based on the material authorized for their school, class, section, subject, and academic session.

### Main project areas

| Project area | Purpose |
|---|---|
| School Management System | Manages academic, administrative, financial, staffing, and communication workflows. |
| Student Learning Portal | Gives students access to lessons, assignments, results, attendance, wellbeing tools, practice activities, and AI learning support. |
| Teacher Portal | Supports teaching preparation, classroom management, assessment, student monitoring, and parent communication. |
| Parent Portal | Gives families a consolidated view of their children’s progress, attendance, fees, health, meetings, and school communication. |
| Leadership and Administration | Provides operational controls, school-wide analytics, finance views, reports, settings, and audit history. |
| AI Learning Services | Processes school content and provides retrieval-grounded tutoring, content generation, assessment, language, speech, and visual-learning services. |
| Multi-Tenant SaaS Foundation | Isolates organizations, schools, campuses, users, data, branding, subscriptions, and payment settings. |

## Features

### 1. Role-based access and portals

- Secure login and protected routes for students, parents, teachers, school administrators, principals, and super administrators.
- Role-specific navigation, dashboards, permissions, and workflows.
- JWT-based authentication with organization, school, and campus context.
- Session handling, logout controls, profile management, and role-aware redirects.
- Tenant-specific branding, titles, themes, logos, and domain behavior.

### 2. Student learning experience

- Student dashboard with academic and personal progress information.
- Smart-learning courses and an AI tutor connected to approved school material.
- Assignments, academic journals, exams, results, attendance, routines, holidays, and notices.
- Practice papers, quizzes, question generation, class notes, summaries, flashcards, and mind maps.
- Mastery, learning-path, weak-topic, and error-analysis views.
- Reading, writing, speaking, pronunciation, grammar, vocabulary, and language-practice support.
- Achievements, educational games, wellness, health, wellbeing, complaints, meetings, chat, and excuse-letter workflows.
- Notifications and teacher-feedback tools.

### 3. AI tutor and content intelligence

- Retrieval-augmented generation using content uploaded by teachers or administrators.
- Metadata-filtered retrieval by organization, school, class, section, academic year, subject, chapter, topic, and subtopic.
- Document ingestion for PDF, DOCX, and PPTX learning material.
- Text-first document extraction with OCR fallback for scanned documents.
- Chunking, embedding generation, vector storage, and contextual retrieval.
- Multiple learning modes, including explanation, Socratic homework help, quizzes, notes, summaries, flashcards, and mind maps.
- Visual-learning and STEM-support services for suitable educational content.
- Language assessment with structured feedback on reading and writing.
- Speech transcription and pronunciation-analysis foundations.
- Student language-memory support for more consistent, personalized language guidance.
- AI answer verification and source-aware behavior intended to reduce unsupported responses.

### 4. Teacher tools

- Teacher dashboard, profile, workload information, routine, and holiday views.
- Attendance recording and student achievement management.
- Student analytics, progress monitoring, weak-student identification, and observation records.
- Health and wellbeing updates for students.
- Smart-teaching tools and lesson-plan builders.
- Upload and organization of teaching resources by class, section, subject, chapter, and academic year.
- Assignments, evaluations, practice questions, class notes, examinations, and result management.
- AI-assisted learning-path creation with teacher review and control.
- Parent meetings, chat, feedback, and excuse-letter review.

### 5. Parent and guardian portal

- Dashboard showing information for linked children.
- Child growth analytics covering academic and wellbeing indicators.
- Attendance, academic reports, results, achievements, class routines, and holidays.
- Responsive fee dashboard with child selection, session-level totals, invoices, dues, overdue indicators, installment information, payment actions, fee-card downloads, and receipts.
- Health and wellness reports.
- Direct chat and parent–teacher meeting workflows.
- Complaints, parent observations, notifications, and excuse letters.
- Mobile-friendly layouts for access from phones and tablets.

### 6. School administration

- School dashboard and operational analytics.
- Student admission records, profiles, promotion, leave, archiving, and attendance.
- Teacher and parent management.
- Academic-year, class, section, subject, timetable, room, floor, and campus setup.
- Examination, result, report-card, lesson-plan, and notice management.
- Fees structures, invoices, collections, discounts, payment records, dashboards, and reports.
- Razorpay gateway configuration with school-specific credentials and payment modes.
- QR-based fee collection and receipt generation.
- Human-resources and support modules.
- School settings, branding, activity logs, security events, and audit trails.

### 7. Principal and leadership tools

- School-wide overview of key performance indicators.
- Academic, student, attendance, staff, and financial analytics.
- Facilities and infrastructure views.
- Reports for academic, attendance, operational, and financial review.
- Communication directory, announcements, notifications, urgent matters, and school calendar.
- Decision-support views for monitoring performance and identifying areas requiring intervention.

### 8. Super-administration and multi-tenancy

- Organization and school creation, configuration, activation, suspension, and subscription management.
- Subdomain and custom-domain support.
- Organization-level branding and configuration.
- Strict tenant isolation across database operations and authenticated requests.
- School and campus hierarchy beneath the organization boundary.
- Tenant-aware Socket.IO communication and payment settings.
- Migration tools for converting existing school data to the multi-tenant structure.

### 9. Communication and notifications

- Real-time chat using Socket.IO.
- Parent–teacher meeting scheduling and management.
- Notices, announcements, complaints, feedback, observations, and excuse letters.
- In-application notifications and web-push foundations.
- Redis support for Socket.IO across multiple backend workers.
- Email support for workflows that require outbound communication.

### 10. Security, quality, and observability

- Password hashing, JWT authentication, and role-based authorization.
- Tenant, school, and campus scoping for sensitive records.
- Helmet security headers, rate limiting, MongoDB query sanitization, CORS controls, and input sanitization.
- Encryption support for student-sensitive data and payment-gateway secrets.
- Structured logging, security-event logging, activity history, and audit trails.
- Swagger/OpenAPI generation for backend API documentation.
- Jest and Testing Library suites for frontend behavior.
- Jest and Supertest suites for backend APIs.
- Security attack-suite scripts and migration dry-run workflows.

## Target audience

### Primary users

#### Students

School-age learners who need one place for academic work, practice, school information, communication, and personalized learning support. The interface is intended to support both independent learning and teacher-directed activities.

#### Teachers

Classroom teachers, subject teachers, coordinators, and academic support staff who need to prepare lessons, manage learning material, assign and assess work, monitor students, communicate with families, and provide interventions.

#### Parents and guardians

Families who want a clear and convenient view of attendance, progress, results, fees, health information, meetings, achievements, and school communication for one or more children.

#### School administrators

Administrative and operations teams responsible for admissions, student and staff records, academic setup, examinations, fees, reports, notices, facilities, and school configuration.

#### Principals and school leaders

Decision-makers who need school-wide visibility into academic performance, attendance, staffing, finance, facilities, communication, and operational risks.

#### Platform super administrators

The organization operating the SaaS platform, including staff who create tenants, manage subscriptions and domains, supervise schools, and maintain platform-level configuration.

### Secondary users

- Academic coordinators and department heads.
- Finance and accounts teams.
- HR and support staff.
- School counsellors and wellbeing teams, subject to appropriate permissions and human oversight.
- Education networks operating multiple schools or campuses.
- Researchers or quality teams evaluating educational outcomes, where data access is properly governed.

## Goals

### Product goals

1. **Unify school operations:** Replace disconnected administrative and learning tools with a connected platform shared across the school community.
2. **Improve learning support:** Give students timely explanations, practice, feedback, and alternative learning formats based on approved curriculum content.
3. **Keep teachers in control:** Use AI to assist teachers while preserving teacher approval, academic authority, and responsibility for important decisions.
4. **Strengthen family engagement:** Make academic, attendance, fee, health, and communication information easier for parents to access and act upon.
5. **Support evidence-based decisions:** Convert school data into clear dashboards, reports, alerts, and intervention workflows for teachers and leaders.
6. **Reduce repetitive workload:** Automate or streamline content preparation, reporting, fee administration, notifications, and routine record management.
7. **Protect student and tenant data:** Enforce organization boundaries, role permissions, secure authentication, encryption, and auditable actions.
8. **Scale across organizations:** Support multiple education organizations, schools, and campuses without mixing data or configuration.
9. **Remain accessible across devices:** Provide responsive web experiences suitable for desktops, laptops, tablets, and mobile phones.
10. **Measure educational value:** Progress from feature delivery to measurable outcomes such as improved mastery, retention, engagement, intervention effectiveness, and teacher efficiency.

### AI-development goals

- Complete the connection between assessments, error classification, mastery updates, and weak-topic detection.
- Build stronger knowledge-graph relationships among curriculum, concepts, learning outcomes, questions, and student mastery.
- Improve long-term student learning memory while maintaining privacy and appropriate retention controls.
- Add hybrid retrieval, stronger source verification, and evaluation processes for AI-generated answers.
- Generate learning recommendations only after mastery and gap-detection evidence is reliable.
- Expand teacher review and editing controls for AI-generated questions and learning paths.
- Measure fairness, safety, accuracy, and educational impact across different student groups.
- Keep sensitive wellbeing and learning-support decisions under qualified human oversight.

### Operational goals

- Maintain reliable tenant isolation and auditability.
- Support production deployment behind a reverse proxy with TLS.
- Scale real-time communication through Redis-backed Socket.IO workers.
- Maintain documented setup, migrations, manual checks, automated tests, and security validation.
- Introduce repeatable containerized deployment and monitoring as the product moves toward production maturity.

## Platform

**Platform type:** Responsive web application, REST API, real-time communication service, and AI microservice platform.

The product is browser-based and is intended to work on desktop, laptop, tablet, and mobile devices. It is not currently documented as a native Android, iOS, Windows, or macOS application. Its responsive web architecture allows the same application to serve all supported roles without requiring separate native clients.

### Technology platform

| Layer | Technologies | Responsibility |
|---|---|---|
| Web frontend | React, Vite, Tailwind CSS, React Router | Role-based portals, responsive interfaces, charts, forms, learning tools, and user workflows. |
| Backend API | Node.js, Express | Authentication, business logic, APIs, tenant enforcement, payments, notifications, reporting, and integrations. |
| Primary database | MongoDB with Mongoose | Users, schools, academics, fees, assessments, communications, settings, and operational records. |
| AI services | Python and FastAPI | Document processing, retrieval, tutoring, evaluation, language services, speech, STEM support, and orchestration. |
| Vector database | Qdrant | Embeddings, curriculum chunks, semantic retrieval, and language-memory records. |
| Local AI runtime | Ollama-compatible language and embedding models | Text generation and embedding generation where locally hosted models are configured. |
| File and media handling | Multer and Cloudinary | Upload and storage workflows for learning resources and other managed files. |
| Real-time services | Socket.IO with optional Redis adapter | Chat, live updates, notifications, and multi-worker message delivery. |
| Payments | Razorpay integration | Online fee orders, verification, QR collection, receipts, and tenant-specific gateway configuration. |
| Reporting | jsPDF, spreadsheet utilities, charts | Receipts, fee structures, reports, exports, analytics, and printable documents. |
| Testing and quality | Jest, Testing Library, Supertest, ESLint | Component behavior, API validation, regression checks, linting, and coverage. |

### Application architecture

```text
Browser / Responsive Web Client
              |
              v
     React role-based portals
              |
       REST + Socket.IO
              |
              v
       Express application
        /      |       \
       v       v        v
   MongoDB   External   FastAPI AI services
             services          |
                               v
                      OCR / parsers / embeddings
                               |
                         Qdrant + LLM runtime
```

### Supported environments

- Local development through Vite, Node.js, and the Python AI service.
- LAN testing so mobile devices can access the development server on the same network.
- Production-style hosting behind Nginx or another reverse proxy.
- Multi-tenant deployment using organization subdomains and optional custom domains.
- Horizontal real-time scaling using Redis when multiple backend workers are used.

## Project outcome

EEC ML aims to become a secure, scalable education operating system that connects school management, teaching, learning, family engagement, and AI assistance. Its value comes from joining these areas into continuous workflows: school-approved content supports student learning; student activity informs teachers; teacher actions and school records inform parents and leaders; and every organization remains isolated within the shared SaaS platform.
