
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-6">
        <h1 className="text-6xl font-bold text-brand-blue">404</h1>
        <p className="text-xl text-gray-600 max-w-md">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <Button 
          className="bg-brand-blue hover:bg-blue-800"
          onClick={() => navigate("/")}
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
