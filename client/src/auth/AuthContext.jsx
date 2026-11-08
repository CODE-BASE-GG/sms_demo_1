import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY, USER_KEY } from '../api';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [initializing, setInitializing] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setInitializing(false);
      return undefined;
    }

    api
      .get('/auth/me')
      .then((response) => {
        if (cancelled) return;
        const nextUser = response.data.user;
        setUser(nextUser);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function persist(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function login(email, password, role) {
    const response = await api.post('/auth/login', { email, password, role });
    persist(response.data);
    return response.data.user;
  }

  async function register(payload) {
    const response = await api.post('/auth/register', payload);
    persist(response.data);
    return response.data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, token, initializing, login, register, logout }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.');
  return context;
}
