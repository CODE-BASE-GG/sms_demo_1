import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Sun } from 'lucide-react';

export function FullPageLoader({ label = 'Warming things up…' }) {
  return (
    <div className="splash-screen">
      <div className="splash-sun">
        <Sun size={38} strokeWidth={2.2} />
      </div>
      <p>{label}</p>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return children;
}
