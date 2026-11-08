import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../auth/AuthContext';
import api, { getErrorMessage } from '../api';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('Teacher');
  const [adminExists, setAdminExists] = useState(true);
  const [checkingRoles, setCheckingRoles] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/auth/bootstrap-status')
      .then((response) => {
        if (!cancelled) setAdminExists(Boolean(response.data?.adminExists));
      })
      .catch(() => {
        if (!cancelled) setAdminExists(true);
      })
      .finally(() => {
        if (!cancelled) setCheckingRoles(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({ name, email, password, role });
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not create your account.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      footer={
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in instead</Link>
        </p>
      }
    >
      <div className="auth-form-head">
        <span className="auth-kicker">Join the sunshine</span>
        <h2>{adminExists ? 'Create your teacher account' : 'Set up Sunny Campus'}</h2>
        <p>
          {adminExists
            ? 'Teachers can register here. Administrator accounts are created by an existing admin.'
            : 'No administrator exists yet. Register the first Admin account, or start as a teacher.'}
        </p>
      </div>

      {checkingRoles ? (
        <p className="field-hint">Checking the available account options…</p>
      ) : adminExists ? (
        <div className="auth-note">
          <GraduationCap size={19} />
          <span>
            <strong>Teacher registration</strong>
            <small>Manage your sections, students and grade items.</small>
          </span>
        </div>
      ) : (
        <>
          <div className="role-picker" role="group" aria-label="Account role">
            <button
              type="button"
              className={`role-option ${role === 'Teacher' ? 'active' : ''}`}
              onClick={() => setRole('Teacher')}
            >
              <GraduationCap size={19} />
              <span>
                <strong>Teacher</strong>
                <small>Manage classes</small>
              </span>
            </button>
            <button
              type="button"
              className={`role-option ${role === 'Admin' ? 'active' : ''}`}
              onClick={() => setRole('Admin')}
            >
              <ShieldCheck size={19} />
              <span>
                <strong>First Admin</strong>
                <small>Set up the campus</small>
              </span>
            </button>
          </div>
          <p className="field-hint">
            The first administrator can create additional admin and teacher accounts.
          </p>
        </>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="field">
          <span className="field-label">Full name</span>
          <span className="input-shell">
            <UserRound size={17} className="input-icon" />
            <input
              type="text"
              autoComplete="name"
              placeholder="Maria Santos"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
          </span>
        </label>

        <label className="field">
          <span className="field-label">Email address</span>
          <span className="input-shell">
            <Mail size={17} className="input-icon" />
            <input
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={100}
            />
          </span>
        </label>

        <div className="field-grid">
          <label className="field">
            <span className="field-label">Password</span>
            <span className="input-shell">
              <Lock size={17} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          <label className="field">
            <span className="field-label">Confirm password</span>
            <span className="input-shell">
              <Lock size={17} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={6}
              />
            </span>
          </label>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting && <ArrowRight size={18} />}
        </button>
      </form>
    </AuthShell>
  );
}
