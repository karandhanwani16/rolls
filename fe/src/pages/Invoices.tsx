
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Plus, Search, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data
const invoices = [
  { 
    id: "INV-001", 
    customer: "Raj Enterprises", 
    date: "2023-05-15", 
    amount: 12500, 
    status: "Paid" 
  },
  { 
    id: "INV-002", 
    customer: "Gupta Traders", 
    date: "2023-05-18", 
    amount: 8750, 
    status: "Pending" 
  },
  { 
    id: "INV-003", 
    customer: "Sharma Industries", 
    date: "2023-05-20", 
    amount: 15000, 
    status: "Paid" 
  },
  { 
    id: "INV-004", 
    customer: "Kumar Retail", 
    date: "2023-05-22", 
    amount: 6300, 
    status: "Overdue" 
  },
  { 
    id: "INV-005", 
    customer: "Patel Distributions", 
    date: "2023-05-25", 
    amount: 9200, 
    status: "Paid" 
  },
  { 
    id: "INV-006", 
    customer: "Singh Automobiles", 
    date: "2023-05-28", 
    amount: 21450, 
    status: "Pending" 
  },
  { 
    id: "INV-007", 
    customer: "Joshi Pharma", 
    date: "2023-05-30", 
    amount: 5780, 
    status: "Paid" 
  },
  { 
    id: "INV-008", 
    customer: "Reddy Electronics", 
    date: "2023-06-02", 
    amount: 11200, 
    status: "Overdue" 
  },
];

const Invoices = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      invoice.customer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || invoice.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <FileText className="mr-2" /> Invoices
          </h1>
          <Button 
            onClick={() => navigate("/invoices/new")}
            className="bg-brand-teal hover:bg-teal-700"
          >
            <Plus className="mr-1 h-4 w-4" /> New Invoice
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.id}</TableCell>
                      <TableCell>{invoice.customer}</TableCell>
                      <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            invoice.status === "Paid" ? "bg-green-100 text-green-800" : 
                            invoice.status === "Pending" ? "bg-yellow-100 text-yellow-800" : 
                            "bg-red-100 text-red-800"
                          )}
                        >
                          {invoice.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
