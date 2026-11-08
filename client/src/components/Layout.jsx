import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CalendarCheck2,
  ClipboardList,
  Columns3,
  GraduationCap,
  LayoutDashboard,
  Layers3,
  Library,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Academics',
    items: [
      { to: '/courses', label: 'Courses', icon: BookOpen },
      { to: '/subjects', label: 'Subjects', icon: Library },
      { to: '/course-subjects', label: 'Course Subjects', icon: Layers3 },
      { to: '/sections', label: 'Sections', icon: Columns3 },
      { to: '/section-subjects', label: 'Section Subjects', icon: UserCheck },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Students', icon: Users },
      { to: '/teachers', label: 'Teachers', icon: GraduationCap, roles: ['Admin'] },
      { to: '/admins', label: 'Admins', icon: ShieldCheck, roles: ['Admin'] },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/assessments', label: 'Grade Items', icon: ClipboardList },
      { to: '/scores', label: 'Student Grades', icon: Award },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/logs', label: 'Audit Logs', icon: ScrollText, roles: ['Admin'] }],
  },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/courses': 'Courses',
  '/subjects': 'Subjects',
  '/course-subjects': 'Course Subjects',
  '/sections': 'Sections',
  '/section-subjects': 'Section Subjects',
  '/students': 'Students',
  '/teachers': 'Teachers',
  '/admins': 'Admins',
  '/assessments': 'Grade Items',
  '/scores': 'Student Grades',
  '/attendance': 'Attendance',
  '/logs': 'Audit Logs',
};

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.roles || item.roles.includes(user?.role),
        ),
      })).filter((group) => group.items.length > 0),
    [user?.role],
  );

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-sun">
            <GraduationCap size={23} strokeWidth={2.3} />
          </span>
          <span className="sidebar-brand-text">
            <strong>Sunny Campus</strong>
            <small>Student management</small>
          </span>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span>{item.label}</span>
                    <span className="nav-dot" aria-hidden="true" />
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar">{initials(user?.name)}</span>
            <span className="sidebar-user-text">
              <strong>{user?.name}</strong>
              <small>{user?.role} account</small>
            </span>
          </div>
          <button type="button" className="logout-button" onClick={handleLogout}>
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className="topbar-title">
            <span>{PAGE_TITLES[location.pathname] || 'Sunny Campus'}</span>
            <small>{today}</small>
          </div>

          <div className="topbar-user">
            <span className="topbar-role">{user?.role}</span>
            <span className="avatar avatar-small">{initials(user?.name)}</span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
