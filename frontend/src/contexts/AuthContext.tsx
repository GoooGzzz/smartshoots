import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
      // Restore the name after a restart / while offline.
      try { const u = localStorage.getItem('auth_user'); if (u) setUser(JSON.parse(u)); } catch { /* ignore */ }
    }
  }, []);

  const login = async (username: string, password: string) => {
    // FIX: this used to call `axios.post('/api/...')` directly - a
    // relative URL, which only resolves correctly when the app is served
    // from the same origin as the backend (true for the desktop/Electron
    // build, NOT true for the Android build talking to a separate PC
    // over the LAN). Using the shared apiClient means login honors
    // whatever server address is configured in Settings, same as every
    // other request in the app.
    const response = await apiClient.post('/accounts/auth/login/', { username, password });
    const { token, user } = response.data;
    localStorage.setItem('auth_token', token);
    try { localStorage.setItem('auth_user', JSON.stringify(user)); } catch { /* ignore */ }
    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    apiClient.post('/accounts/auth/logout/').catch(() => {});
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('offline_cache')) localStorage.removeItem(k); }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
