import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../api';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('Teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from || '/';

  if (user) return <Navigate to={from} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password, role);
      navigate(from, { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not log in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      footer={
        <p className="auth-switch">
          New to Sunny Campus? <Link to="/register">Create an account</Link>
        </p>
      }
    >
      <div className="auth-form-head">
        <span className="auth-kicker">Welcome back</span>
        <h2>Sign in to your account</h2>
        <p>Choose your role, then enter your credentials.</p>
      </div>

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
            <strong>Admin</strong>
            <small>Run the campus</small>
          </span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
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
            />
          </span>
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <span className="input-shell">
            <Lock size={17} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
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

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <ArrowRight size={18} />}
        </button>
      </form>
    </AuthShell>
  );
}
