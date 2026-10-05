import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSecureItem, removeSecureItem, setSecureItem } from '../api/client';

type AuthContextType = {
  user: any;
  loading: boolean;
  login: (userData: any, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const bootstrappingSessionStorageNode = async () => {
      try {
        const storedUser = await getSecureItem('userInfo');
        const accessToken = await getSecureItem('accessToken');
        if (storedUser && accessToken) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('SESSION BOOTSTRAPPING ERROR:', err);
      } finally {
        setLoading(false);
      }
    };
    bootstrappingSessionStorageNode();
  }, []);

  const login = async (userData: any, accessToken: string, refreshToken: string) => {
    const processedUser = {
      ...userData,
      role: userData.role?.toUpperCase(),
    };

    await setSecureItem('accessToken', accessToken);
    await setSecureItem('refreshToken', refreshToken);
    await setSecureItem('userInfo', JSON.stringify(processedUser));

    setUser(processedUser);
  };

  const logout = async () => {
    try {
      await removeSecureItem('accessToken');
      await removeSecureItem('refreshToken');
      await removeSecureItem('userInfo');
      setUser(null);
    } catch (err) {
      console.error('LOGOUT ERROR:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthMock = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthMock must be called inside an AuthProvider wrapper element.');
  }
  return context;
};