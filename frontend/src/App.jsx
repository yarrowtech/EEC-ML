import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthSessionManager from "./components/AuthSessionManager";
import FloatingGamesButton from "./components/FloatingGamesButton";

const LoginForm = lazy(() => import("./components/LoginForm"));
const SignupForm = lazy(() => import("./components/SignupForm"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const ComplaintManagementSystem = lazy(() =>
  import("./parents/ComplaintManagementSystem"),
);
const AdminApp = lazy(() => import("./admin/AdminApp"));
const PrincipalDashboard = lazy(() => import("./principal/PrincipalDashboard"));
const ProfileUpdate = lazy(() => import("./components/ProfileUpdate"));
const ParentPortal = lazy(() => import("./parents/ParentPortal"));
const TeacherPortal = lazy(() => import("./teachers/TeacherPortal"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const FeedbackThankYou = lazy(() => import("./pages/FeedbackThankYou"));
const MeetTheDeveloper = lazy(() => import("./pages/MeetTheDeveloper"));
const SchoolRegistrationForm = lazy(() =>
  import("./components/SchoolRegistrationForm"),
);
const SchoolRegistrationSuccess = lazy(() =>
  import("./components/SchoolRegistrationSuccess"),
);
const GamesPage = lazy(() => import("./games/GamesPage"));
const SuperAdminApp = lazy(() => import("./Super Admin/SuperAdminApp"));
const ArchivedStudents = lazy(() => import("./admin/ArchivedStudents"));
const AdminFeeQrDisplay = lazy(() =>
  import("./admin/pages/AdminFeeQrDisplay"),
);

const ROLES = Object.freeze({
  STUDENT: "Student",
  PARENT: "Parent",
  TEACHER: "Teacher",
  SCHOOL_ADMIN: "Admin",
  PRINCIPAL: "Principal",
  SUPER_ADMIN: "SuperAdmin",
});

const withAuth = (allowedRoles, element) => (
  <ProtectedRoute allowedRoles={allowedRoles}>{element}</ProtectedRoute>
);
const AUTHENTICATED_ROLES = Object.values(ROLES);

const studentSections = [
  "home",
  "smart-learning",
  "smart-learning/*",
  "smart-learning-courses",
  "smart-learning-courses-reference",
  "smart-learning-tutor",
  "academics",
  "assignments",
  "assignments-journal",
  "assignments-academic-alcove",
  "results",
  "schedule",
  "exams",
  "holidays",
  "routine",
  "attendance",
  "health",
  "complaints",
  "meetings",
  "communication",
  "chat",
  "teacherfeedback",
  "excuse-letter",
  "noticeboard",
  "wellness",
  "wellbeing",
  "achievements",
  "profile",
  "themecustomizer",
  "my-paths",
  "notifications",
  "learning-path-map",
  "mastery",
  "error-analysis",
];

const studentBasePaths = ["/student", "/dashboard"];
const studentDashboardPaths = studentBasePaths.flatMap((basePath) => [
  basePath,
  ...studentSections.map((section) => `${basePath}/${section}`),
  `${basePath}/*`,
]);

function App() {
  return (
    <BrowserRouter>
      <AuthSessionManager />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center" role="status">
            <span className="sr-only">Loading page</span>
          </div>
        }
      >
        <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginForm />} />
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/complaint" element={<ComplaintManagementSystem />} />
        <Route
          path="/profile"
          element={withAuth(AUTHENTICATED_ROLES, <ProfileUpdate />)}
        />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/feedback/thank-you" element={<FeedbackThankYou />} />
        <Route
          path="/school-registration"
          element={<SchoolRegistrationForm />}
        />
        <Route
          path="/school-registration/success"
          element={<SchoolRegistrationSuccess />}
        />
        <Route path="/meet-the-developer" element={<MeetTheDeveloper />} />

        {/* Student module - More specific routes first */}
        <Route
          path="/student/games"
          element={withAuth([ROLES.STUDENT], <GamesPage />)}
        />
        <Route
          path="/student/games/:gameKey"
          element={withAuth([ROLES.STUDENT], <GamesPage />)}
        />
        <Route
          path="/dashboard/games"
          element={withAuth([ROLES.STUDENT], <GamesPage />)}
        />
        <Route
          path="/dashboard/games/:gameKey"
          element={withAuth([ROLES.STUDENT], <GamesPage />)}
        />
        {/* General student dashboard routes */}
        {studentDashboardPaths.map((path) => (
          <Route
            key={path}
            path={path}
            element={withAuth([ROLES.STUDENT], <Dashboard />)}
          />
        ))}
        {/* School admin module - More specific routes first */}
        <Route
          path="/admin/archived-students"
          element={withAuth([ROLES.SCHOOL_ADMIN], <ArchivedStudents />)}
        />
        {/* Chrome-free "second screen" QR display — deliberately outside
            AdminLayout so it renders with no sidebar/header, just the QR. */}
        <Route
          path="/admin/fees/qr-display"
          element={withAuth([ROLES.SCHOOL_ADMIN], <AdminFeeQrDisplay />)}
        />
        <Route
          path="/admin/*"
          element={withAuth([ROLES.SCHOOL_ADMIN], <AdminApp />)}
        />
        <Route
          path="/school-admin/*"
          element={withAuth([ROLES.SCHOOL_ADMIN], <AdminApp />)}
        />
        <Route
          path="/principal/*"
          element={withAuth([ROLES.PRINCIPAL], <PrincipalDashboard />)}
        />
        <Route
          path="/super-admin/*"
          element={withAuth([ROLES.SUPER_ADMIN], <SuperAdminApp />)}
        />

        {/* Parent module */}
        <Route
          path="/parents/*"
          element={withAuth([ROLES.PARENT], <ParentPortal />)}
        />
        <Route
          path="/parent/*"
          element={withAuth([ROLES.PARENT], <ParentPortal />)}
        />

        {/* Teacher module */}
        <Route
          path="/teachers/*"
          element={withAuth([ROLES.TEACHER], <TeacherPortal />)}
        />
        <Route
          path="/teacher/*"
          element={withAuth([ROLES.TEACHER], <TeacherPortal />)}
        />

        </Routes>
      </Suspense>

      <FloatingGamesButton />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
        }}
      />
    </BrowserRouter>
  );
}

export default App;
