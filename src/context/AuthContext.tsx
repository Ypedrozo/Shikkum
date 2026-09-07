import React, { createContext, useContext, useEffect, useState } from 'react';
import { SystemRole, SystemUser } from '../types';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: SystemUser | null;
  role: SystemRole | null;
  isActive: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<SystemUser>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SystemUser | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Suscribirse a cambios de sesión (tanto Firebase como estado interno)
    const unsubscribe = authService.subscribe((updatedUser) => {
      setUser(updatedUser);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string): Promise<SystemUser> => {
    setError(null);
    setIsLoading(true);
    try {
      const loggedUser = await authService.login(email, pass);
      setUser(loggedUser);
      setIsLoading(false);
      return loggedUser;
    } catch (err: any) {
      setIsLoading(false);
      const errMsg = err.message || 'Error al iniciar sesión';
      setError(errMsg);
      throw err;
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setError(null);
    await authService.resetPassword(email);
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    role: user?.role || null,
    isActive: user ? user.isActive : false,
    isLoading,
    login,
    logout,
    resetPassword,
    error,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
