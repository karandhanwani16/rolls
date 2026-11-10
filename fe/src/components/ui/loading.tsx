import { Loader2 } from "lucide-react";

interface LoadingProps {
  size?: number;
  className?: string;
}

export const Loading = ({ size = 40, className = "" }: LoadingProps) => {
  return (
    <div className="flex items-center justify-center">
      <Loader2 size={size} className={`animate-spin text-blue-500 ${className}`} />
    </div>
  );
};

export const FullPageLoading = () => {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loading size={40} />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}; 