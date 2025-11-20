import { createContext, useEffect, useState } from 'react';
import {
  fetchMe,
  getStoredUser,
  loginUser,
  logoutUser,
  registerUser,
  saveUser,
} from '../services/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const current = await fetchMe();
        setUser(current);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (credentials) => {
    const authUser = await loginUser(credentials);
    setUser(authUser);
    return authUser;
  };

  const register = async (payload) => {
    await registerUser(payload);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const updateUser = (newUser) => {
    saveUser(newUser);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, register, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

