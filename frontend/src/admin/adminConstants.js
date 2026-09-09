import {
  Home,
  BarChart3,
  Users,
  GraduationCap,
  UserCheck,
  Calendar,
  ClipboardList,
  FileText,
  IndianRupee,
  Briefcase,
  Brain,
  Settings,
  Receipt,
  UserSearch,
  BarChart4,
  Layers,
  Building2,
  Shield,
  UserRound,
  LifeBuoy,
  Bell,
  ArrowUpCircle,
  CalendarDays,
  CreditCard,
  Plus,
  Eye,
  Activity
} from 'lucide-react';

export const ADMIN_MENU_ITEMS = [
  {
    icon: Home,
    label: 'Dashboard',
    path: '/admin/dashboard',
    active: true
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    path: '/admin/analytics'
  },
  {
    icon: Activity,
    label: 'Activity Log',
    path: '/admin/activity-log'
  },
  {
    icon: IndianRupee,
    label: 'Fees Management',
    path: '/admin/fees/collection',
    hasSubmenu: true,
    submenu: [
      {
        icon: Layers,
        label: 'Fees Manage',
        path: '/admin/fees/manage'
      },
      {
        icon: Receipt,
        label: 'Fees Collection',
        path: '/admin/fees/collection'
      },
      {
        icon: BarChart4,
        label: 'Fees Dashboard',
        path: '/admin/fees/dashboard'
      }
    ]
  },
  {
    icon: Bell,
    label: 'Notices',
    path: '/admin/notices',
    hasSubmenu: true,
    submenu: [
      {
        icon: Eye,
        label: 'View Notices',
        path: '/admin/notices/view'
      },
      {
        icon: Plus,
        label: 'Post Notice',
        path: '/admin/notices/post'
      }
    ]
  },
  {
    icon: CalendarDays,
    label: 'Holiday List',
    path: '/admin/holidays'
  },
  {
    icon: GraduationCap,
    label: 'Students',
    path: '/admin/students'
  },
  {
    icon: ArrowUpCircle,
    label: 'Promotion & Leave',
    path: '/admin/promotion'
  },
  {
    icon: ClipboardList,
    label: 'Student Attendance',
    path: '/admin/attendance'
  },
  // {
  //   icon: Brain,
  //   label: 'Student Wellbeing',
  //   path: '/admin/wellbeing'
  // },
  {
    icon: Users,
    label: 'Teachers Management',
    path: '/admin/teachers'
  },
  {
    icon: UserSearch,
    label: 'Teacher Feedback',
    path: '/admin/teacher-feedback'
  },
  {
    icon: Calendar,
    label: 'Routine Management',
    path: '/admin/routines',
  },
  {
    icon: UserCheck,
    label: 'Parents',
    path: '/admin/parents'
  },
  {
    icon: Layers,
    label: 'Academic Setup',
    path: '/admin/academics'
  },
  {
    icon: Building2,
    label: 'Floor & Rooms',
    path: '/admin/floor-rooms'
  },
  {
    icon: Calendar,
    label: 'Exam Management',
    path: '/admin/examination'
  },
  {
    icon: FileText,
    label: 'Result Management',
    path: '/admin/result'
  },
  {
    icon: FileText,
    label: 'Report Cards',
    path: '/admin/report-cards'
  },
  {
    icon: Briefcase,
    label: 'HR',
    path: '/admin/hr'
  },
  {
    icon: LifeBuoy,
    label: 'Support',
    path: '/admin/support'
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/admin/settings',
    scope: 'school',
    hasSubmenu: true,
    submenu: [
      { icon: UserRound, label: 'Profile & School', path: '/admin/settings' },
      { icon: CreditCard, label: 'Payment Gateway', path: '/admin/settings/payment-gateway' }
    ]
  },
  {
    icon: Building2,
    label: 'Schools',
    path: '/admin/schools',
    scope: 'super'
  },
  {
    icon: Shield,
    label: 'School Admins',
    path: '/admin/school-admins',
    scope: 'super'
  },
];

// School-admin sidebar layout: ordered sections, each a list of item labels.
// Labels resolve against ADMIN_MENU_ITEMS (top-level items and submenu children).
export const ADMIN_MENU_SECTIONS = [
  { items: ['Dashboard'] },
  { section: 'OVERVIEW', items: ['Analytics', 'Activity Log'] },
  {
    section: 'ACADEMIC MANAGEMENT',
    items: ['Academic Setup', 'Teachers Management', 'Teacher Feedback', 'Routine Management', 'Exam Management', 'Result Management', 'Report Cards'],
  },
  { section: 'STUDENTS', items: ['Students', 'Parents', 'Promotion & Leave'] },
  { section: 'FEES MANAGEMENT', items: ['Fees Dashboard', 'Fees Manage', 'Fees Collection'] },
  { section: 'COMMUNICATION', items: ['Notices', 'Holiday List'] },
  { section: 'CAMPUS', items: ['Floor & Rooms'] },
  { section: 'HUMAN RESOURCES', items: ['HR'] },
  { section: 'SUPPORT', items: ['Support'] },
  { section: 'SETTINGS', items: ['Profile & School', 'Payment Gateway'] },
];
