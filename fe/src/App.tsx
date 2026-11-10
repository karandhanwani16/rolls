import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import NewInvoice from "./pages/NewInvoice";
import Customers from "./pages/Customers";
import WatavVendors from "./pages/WatavVendors";
import Suppliers from "./pages/Suppliers";
import Godowns from "./pages/Godowns";
import Products from "./pages/Products";
import Transactions from "./pages/Transactions";
import PaymentsIn from "./pages/PaymentsIn";
import PaymentsOut from "./pages/PaymentsOut";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Purchases from "./pages/Purchases";
import PurchaseForm from "@/components/purchases/PurchaseForm";
import Sales from "./pages/Sales";
import BillToBillPayment from "./pages/BillToBillPayment";
import CustomerReport from "./pages/reports/CustomerReport";
import SupplierReport from "./pages/reports/SupplierReport";
import PaymentInReport from "./pages/reports/PaymentInReport";
import PaymentOutReport from "./pages/reports/PaymentOutReport";
import SalesReport from "./pages/reports/SalesReport";
import PurchaseReport from "./pages/reports/PurchaseReport";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FullPageLoading } from "@/components/ui/loading";
import SalesForm from "./components/sales/SalesForm";
import StockReport from "./pages/StockReport";
import SalesReturns from "./pages/SalesReturns";
import PurchaseReturns from "./pages/PurchaseReturns";
import ReturnForm from "./components/returns/ReturnForm";
import SalesReturnReport from "./pages/reports/SalesReturnReport";
import PurchaseReturnReport from "./pages/reports/PurchaseReturnReport";
import WatavReport from "./pages/reports/WatavReport";
import PendingWatav from "./pages/PendingWatav";
import OutstandingReport from "./pages/reports/OutstandingReport";
import PurchaseOutstandingReport from "./pages/reports/PurchaseOutstandingReport";
import PendingBillsReport from "./pages/reports/PendingBillsReport";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        // Only redirect to login if not already on login page
        if (location.pathname !== '/login') {
          navigate('/login', { state: { from: location.pathname } });
        }
      }
    }
  }, [isAuthenticated, loading, navigate, location]);

  if (loading) {
    return <FullPageLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

function useFileProtocolRouter() {
  return (
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" || Boolean(window.electronAPI))
  );
}

const AppRoutes = () => (
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/invoices" element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          } />
          <Route path="/invoices/new" element={
            <ProtectedRoute>
              <NewInvoice />
            </ProtectedRoute>
          } />
          <Route path="/customers" element={
            <ProtectedRoute>
              <Customers />
            </ProtectedRoute>
          } />
          <Route path="/watav-vendors" element={
            <ProtectedRoute>
              <WatavVendors />
            </ProtectedRoute>
          } />
          <Route path="/suppliers" element={
            <ProtectedRoute>
              <Suppliers />
            </ProtectedRoute>
          } />
          <Route path="/godowns" element={
            <ProtectedRoute>
              <Godowns />
            </ProtectedRoute>
          } />
          <Route path="/products" element={
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          } />
          <Route path="/payments-in" element={
            <ProtectedRoute>
              <PaymentsIn />
            </ProtectedRoute>
          } />
          <Route path="/watav-pending" element={
            <ProtectedRoute>
              <PendingWatav />
            </ProtectedRoute>
          } />
          <Route path="/payments-out" element={
            <ProtectedRoute>
              <PaymentsOut />
            </ProtectedRoute>
          } />
          <Route path="/purchases" element={
            <ProtectedRoute>
              <Purchases />
            </ProtectedRoute>
          } />
          <Route path="/purchases/new" element={
            <ProtectedRoute>
              <PurchaseForm />
            </ProtectedRoute>
          } />
          <Route path="/purchases/edit/:id" element={
            <ProtectedRoute>
              <PurchaseForm />
            </ProtectedRoute>
          } />
          <Route path="/sales" element={
            <ProtectedRoute>
              <Sales />
            </ProtectedRoute>
          } />
          <Route path="/sales/new" element={
            <ProtectedRoute>
              <SalesForm />
            </ProtectedRoute>
          } />
          <Route path="/sales/edit/:id" element={
            <ProtectedRoute>
              <SalesForm />
            </ProtectedRoute>
          } />
          <Route path="/sales-returns" element={
            <ProtectedRoute>
              <SalesReturns />
            </ProtectedRoute>
          } />
          <Route path="/sales-returns/new" element={
            <ProtectedRoute>
              <ReturnForm mode="sales" />
            </ProtectedRoute>
          } />
          <Route path="/sales-returns/edit/:id" element={
            <ProtectedRoute>
              <ReturnForm mode="sales" />
            </ProtectedRoute>
          } />
          <Route path="/purchase-returns" element={
            <ProtectedRoute>
              <PurchaseReturns />
            </ProtectedRoute>
          } />
          <Route path="/purchase-returns/new" element={
            <ProtectedRoute>
              <ReturnForm mode="purchase" />
            </ProtectedRoute>
          } />
          <Route path="/purchase-returns/edit/:id" element={
            <ProtectedRoute>
              <ReturnForm mode="purchase" />
            </ProtectedRoute>
          } />
          <Route path="/bill-to-bill" element={
            <ProtectedRoute>
              <BillToBillPayment />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />

          {/* Report Routes */}
          <Route path="/reports/stock" element={
            <ProtectedRoute>
              <StockReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/customers" element={
            <ProtectedRoute>
              <CustomerReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/suppliers" element={
            <ProtectedRoute>
              <SupplierReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/payments-in" element={
            <ProtectedRoute>
              <PaymentInReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/payments-out" element={
            <ProtectedRoute>
              <PaymentOutReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/sales" element={
            <ProtectedRoute>
              <SalesReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/purchases" element={
            <ProtectedRoute>
              <PurchaseReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/sales-returns" element={
            <ProtectedRoute>
              <SalesReturnReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/purchase-returns" element={
            <ProtectedRoute>
              <PurchaseReturnReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/watav" element={
            <ProtectedRoute>
              <WatavReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/outstanding" element={
            <ProtectedRoute>
              <OutstandingReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/purchase-outstanding" element={
            <ProtectedRoute>
              <PurchaseOutstandingReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/customer-pending-bills" element={
            <ProtectedRoute>
              <PendingBillsReport variant="customer" />
            </ProtectedRoute>
          } />
          <Route path="/reports/supplier-pending-bills" element={
            <ProtectedRoute>
              <PendingBillsReport variant="supplier" />
            </ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
);

const AppContent = () => {
  const Router = useFileProtocolRouter() ? HashRouter : BrowserRouter;
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
