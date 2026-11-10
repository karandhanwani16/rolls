import { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { authAPI, profileAPI } from "@/services/api";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "user-data";
const AUTH_TOKEN_KEY = "auth-token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const persistUser = (userData: User | null) => {
    if (userData) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      setIsAuthenticated(true);
      setUser(userData);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      
      if (!token) {
        clearAuth();
        setLoading(false);
        return;
      }

      try {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
        }

        // const profileData = await profileAPI.getProfile();
        // persistUser(profileData.user);
        // navigate("/dashboard");
      } catch (error: any) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          clearAuth();
        }
        toast({
          title: "Authentication Error",
          description: "Please log in again",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [navigate, toast]);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await authAPI.login(email, password);
      localStorage.setItem(AUTH_TOKEN_KEY, data.session.access_token);
      persistUser(data.user);
      
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.response?.data?.error || "An error occurred during login",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      clearAuth();
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.response?.data?.error || "An error occurred during logout",
        variant: "destructive",
      });
      clearAuth();
      return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
