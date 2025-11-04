import { AuthProvider } from '@refinedev/core';

export const authProvider: AuthProvider = {
  login: async ({ token }) => {
    if (token) {
      localStorage.setItem('jwt', token);
      return { success: true, redirectTo: '/' };
    }
    return {
      success: false,
      error: {
        name: 'Login Error',
        message: 'Invalid token',
      },
    };
  },

  logout: async () => {
    localStorage.removeItem('jwt');
    return { success: true, redirectTo: '/login' };
  },

  check: async () => {
    const token = localStorage.getItem('jwt');
    if (!token) {
      return { authenticated: false, redirectTo: '/login' };
    }

    try {
      // Decode JWT to check expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('jwt');
        return { authenticated: false, redirectTo: '/login' };
      }

      return { authenticated: true };
    } catch {
      return { authenticated: false, redirectTo: '/login' };
    }
  },

  getIdentity: async () => {
    const token = localStorage.getItem('jwt');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.sub,
        name: payload.name || payload.email,
        email: payload.email,
      };
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    if (error?.status === 401) {
      return { logout: true, redirectTo: '/login' };
    }
    return {};
  },
};
