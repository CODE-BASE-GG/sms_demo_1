import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck2,
  ClipboardList,
  Columns3,
  FileClock,
  GraduationCap,
  Layers3,
  Library,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth/AuthContext';

const ADMIN_SPOTLIGHT = [
  {
    key: 'students',
    label: 'Students',
    caption: 'Enrolled learners',
    icon: Users,
    to: '/students',
    tone: 'sun',
  },
  {
    key: 'teachers',
    label: 'Teachers',
    caption: 'Faculty accounts',
    icon: GraduationCap,
    to: '/teachers',
    tone: 'honey',
  },
  {
    key: 'courses',
    label: 'Courses',
    caption: 'Degree programs',
    icon: BookOpen,
    to: '/courses',
    tone: 'cream',
  },
  {
    key: 'sections',
    label: 'Sections',
    caption: 'Active class groups',
    icon: Columns3,
    to: '/sections',
    tone: 'gold',
  },
];

const TEACHER_SPOTLIGHT = [
  {
    key: 'students',
    label: 'My students',
    caption: 'Learners you handle',
    icon: Users,
    to: '/students',
    tone: 'sun',
  },
  {
    key: 'sections',
    label: 'My sections',
    caption: 'Class groups assigned to you',
    icon: Columns3,
    to: '/sections',
    tone: 'honey',
  },
  {
    key: 'assessments',
    label: 'Grade items',
    caption: 'Graded work for your subjects',
    icon: ClipboardList,
    to: '/assessments',
    tone: 'cream',
  },
  {
    key: 'scores',
    label: 'Student grades',
    caption: 'Grades you have recorded',
    icon: Award,
    to: '/scores',
    tone: 'gold',
  },
];

const ADMIN_MINI_STATS = [
  { key: 'subjects', label: 'Subjects', icon: Library, to: '/subjects' },
  { key: 'courseSubjects', label: 'Course subjects', icon: Layers3, to: '/course-subjects' },
  { key: 'admins', label: 'Admins', icon: ShieldCheck, to: '/admins' },
  {
    key: 'sectionSubjects',
    label: 'Section subjects',
    icon: UserCheck,
    to: '/section-subjects',
  },
  { key: 'assessments', label: 'Grade items', icon: ClipboardList, to: '/assessments' },
  { key: 'scores', label: 'Student grades', icon: Award, to: '/scores' },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck2, to: '/attendance' },
  { key: 'logs', label: 'Audit logs', icon: ScrollText, to: '/logs' },
];

const TEACHER_MINI_STATS = [
  { key: 'courses', label: 'Courses', icon: BookOpen, to: '/courses' },
  { key: 'subjects', label: 'Subjects', icon: Library, to: '/subjects' },
  { key: 'courseSubjects', label: 'Course subjects', icon: Layers3, to: '/course-subjects' },
  {
    key: 'sectionSubjects',
    label: 'My assignments',
    icon: UserCheck,
    to: '/section-subjects',
  },
  { key: 'assessments', label: 'Grade items', icon: ClipboardList, to: '/assessments' },
  { key: 'scores', label: 'Student grades', icon: Award, to: '/scores' },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck2, to: '/attendance' },
];

const ATTENDANCE_TONE = {
  Present: 'success',
  Absent: 'danger',
  Late: 'warning',
  Excused: 'info',
};

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function Stars() {
  return (
    <span className="banner-stars" aria-hidden="true">
      <Sparkles size={20} />
      <Sparkles size={13} />
      <Sparkles size={17} />
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = data?.stats || {};
  const isAdmin = user?.role === 'Admin';
  const spotlight = isAdmin ? ADMIN_SPOTLIGHT : TEACHER_SPOTLIGHT;
  const miniStats = isAdmin ? ADMIN_MINI_STATS : TEACHER_MINI_STATS;
  const pendingReviews = Number(stats.pendingReviews || 0);
  const attendanceTotal = useMemo(
    () =>
      (data?.attendanceBreakdown || []).reduce(
        (sum, item) => sum + Number(item.Total || 0),
        0,
      ),
    [data],
  );
  const maxCourseStudents = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.studentsByCourse || []).map((course) => Number(course.Total || 0)),
      ),
    [data],
  );

  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div className="banner-orb orb-one" />
        <div className="banner-orb orb-two" />
        <Stars />

        <div className="welcome-copy">
          <span className="welcome-eyebrow">
            <Sun size={16} /> {greeting()}, {user?.name?.split(' ')[0] || 'friend'}
          </span>
          <h1>Your campus is looking bright today.</h1>
          <p>
            A quick look at the people, classes and records that keep Sunny Campus moving.
          </p>
          <div className="welcome-actions">
            <Link to="/students" className="btn btn-dark">
              Manage students
              <ArrowRight size={17} />
            </Link>
            <Link to="/attendance" className="btn btn-soft">
              <CalendarCheck2 size={17} />
              Take attendance
            </Link>
          </div>
        </div>

        <div className="welcome-badge">
          <span className="welcome-badge-icon">
            <Sun size={30} />
          </span>
          <span>
            <small>Signed in as</small>
            <strong>{user?.role}</strong>
          </span>
        </div>
      </section>

      {error && (
        <div className="alert alert-error">
          <XCircle size={17} />
          <span>{error}</span>
          <button type="button" className="alert-action" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {isAdmin && pendingReviews > 0 && (
        <div className="review-banner">
          <span className="review-banner-icon">
            <FileClock size={21} />
          </span>
          <div className="review-banner-copy">
            <strong>
              {pendingReviews} reason{pendingReviews === 1 ? '' : 's'} waiting for review
            </strong>
            <span>Teachers submitted reasons for sensitive changes. Review them in the audit log.</span>
          </div>
          <Link to="/logs" className="btn btn-dark">
            Review now
            <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {loading && !data ? (
        <div className="dashboard-loading">
          <Loader2 size={28} className="spin" />
          <p>Gathering the latest numbers…</p>
        </div>
      ) : (
        <>
          <div className="spotlight-grid">
            {spotlight.map((item) => {
              const Icon = item.icon;
              return (
                <Link to={item.to} className={`spotlight-card tone-${item.tone}`} key={item.key}>
                  <span className="spotlight-icon">
                    <Icon size={23} />
                  </span>
                  <span className="spotlight-number">{stats[item.key] ?? 0}</span>
                  <span className="spotlight-label">{item.label}</span>
                  <span className="spotlight-caption">{item.caption}</span>
                  <span className="spotlight-arrow">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mini-grid">
            {miniStats.map((item) => {
              const Icon = item.icon;
              return (
                <Link to={item.to} className="mini-stat" key={item.key}>
                  <span className="mini-icon">
                    <Icon size={17} />
                  </span>
                  <span className="mini-number">{stats[item.key] ?? 0}</span>
                  <span className="mini-label">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="dashboard-columns">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">
                    <FileClock size={15} /> Recent activity
                  </span>
                  <h2>{isAdmin ? 'What changed lately' : 'Your latest changes'}</h2>
                </div>
                {isAdmin && (
                  <Link to="/logs" className="text-link">
                    View all <ArrowRight size={15} />
                  </Link>
                )}
              </div>

              {data?.recentLogs?.length ? (
                <ul className="activity-list">
                  {data.recentLogs.map((log) => (
                    <li key={log.LogID} className="activity-item">
                      <span className="activity-avatar">{initials(log.ActorName)}</span>
                      <div className="activity-copy">
                        <p>{log.Reason}</p>
                        <span>
                          {log.ActorName} · {timeAgo(log.Timestamp)}
                        </span>
                      </div>
                      <span
                        className={`badge badge-${
                          log.Status === 'Approved'
                            ? 'success'
                            : log.Status === 'Rejected'
                              ? 'danger'
                              : 'warning'
                        }`}
                      >
                        {log.Status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="panel-empty">
                  <ScrollText size={26} />
                  <p>No activity recorded yet. Changes will appear here automatically.</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">
                    <CalendarCheck2 size={15} /> Attendance
                  </span>
                  <h2>Attendance mix</h2>
                </div>
                <span className="count-pill">{attendanceTotal} records</span>
              </div>

              {attendanceTotal > 0 ? (
                <div className="breakdown">
                  {data.attendanceBreakdown.map((item) => {
                    const total = Number(item.Total || 0);
                    const percent = Math.round((total / attendanceTotal) * 100);
                    return (
                      <div className="breakdown-row" key={item.Status}>
                        <div className="breakdown-top">
                          <span className={`badge badge-${ATTENDANCE_TONE[item.Status] || 'neutral'}`}>
                            {item.Status}
                          </span>
                          <span className="breakdown-value">
                            {total} <small>({percent}%)</small>
                          </span>
                        </div>
                        <div className="progress-track">
                          <span
                            className={`progress-fill fill-${ATTENDANCE_TONE[item.Status] || 'neutral'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="panel-empty">
                  <CalendarCheck2 size={26} />
                  <p>No attendance has been recorded yet.</p>
                  <Link to="/attendance" className="btn btn-soft">
                    Add attendance
                  </Link>
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">
                  <Users size={15} /> Enrollment
                </span>
                <h2>Students by course</h2>
              </div>
              <Link to="/students" className="text-link">
                Manage students <ArrowRight size={15} />
              </Link>
            </div>

            {data?.studentsByCourse?.length ? (
              <div className="course-bars">
                {data.studentsByCourse.map((course) => {
                  const total = Number(course.Total || 0);
                  const width = Math.max(4, Math.round((total / maxCourseStudents) * 100));
                  return (
                    <div className="course-bar-row" key={course.CourseName}>
                      <div className="course-bar-head">
                        <span>{course.CourseName}</span>
                        <strong>{total}</strong>
                      </div>
                      <div className="progress-track">
                        <span className="progress-fill fill-sun" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel-empty">
                <BookOpen size={26} />
                <p>No courses yet. Add a course to start enrolling students.</p>
              </div>
            )}
          </section>
        </>
      )}

      {loading && data && (
        <button type="button" className="floating-refresh" onClick={load} aria-label="Refresh">
          <RefreshCw size={17} />
        </button>
      )}
    </div>
  );
}
