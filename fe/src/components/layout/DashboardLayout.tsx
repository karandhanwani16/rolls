import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { FullPageLoading } from "@/components/ui/loading";

type DashboardLayoutProps = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Redirect to login if not authenticated and not loading
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <FullPageLoading />;
  }

  // Will redirect in the useEffect if no user
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
