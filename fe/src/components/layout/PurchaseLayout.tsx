import { ReactNode } from "react";
import Sidebar from "./Sidebar";

type PurchaseLayoutProps = {
  children: ReactNode;
};

const PurchaseLayout = ({ children }: PurchaseLayoutProps) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50">
        {children}
      </main>
    </div>
  );
};

export default PurchaseLayout; 