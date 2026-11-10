import React, { useState, useEffect } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import { customersAPI } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, Download, FileText, FileSpreadsheet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Add type declaration for jsPDF autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const CustomerReport = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [customerType, setCustomerType] = useState<string>("");
  const [salesAndPayments, setSalesAndPayments] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customerOpen, setCustomerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomers.length > 0) {
      fetchSalesAndPayments(selectedCustomers);
    }
  }, [selectedCustomers, startDate, endDate, customerType]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await customersAPI.getAll();
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesAndPayments = async (customerIds: string[]) => {
    try {
      const data = await customersAPI.getSalesAndPayments({
        customerIds,
        startDate,
        endDate,
        customerType: customerType === "all" ? undefined : customerType
      });
      setSalesAndPayments(data);
    } catch (error) {
      console.error("Error fetching sales and payments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch sales and payments data",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Phone", "City", "Type", "Description", "Created Date", "Total Sales", "Total Payments", "Balance"];
    const csvContent = [
      headers.join(","),
      ...salesAndPayments.map((item) => {
        return [
          `"${item.customer.name || ''}"`,
          `"${item.customer.phone || ''}"`,
          `"${item.customer.city || ''}"`,
          `"${item.customer.type || ''}"`,
          `"${item.customer.description || ''}"`,
          format(new Date(item.customer.created_at), "yyyy-MM-dd"),
          item.totalSales,
          item.totalPayments,
          item.balance
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Customer Report", 10, 10);
    doc.text(`From: ${format(new Date(startDate), 'dd/MM/yyyy')} To: ${format(new Date(endDate), 'dd/MM/yyyy')}`, 10, 20);
    
    doc.autoTable({
      head: [["Name", "Phone", "City", "Type", "Total Sales", "Total Payments", "Balance"]],
      body: salesAndPayments.map((item) => [
        item.customer.name,
        item.customer.phone || "-",
        item.customer.city || "-",
        item.customer.type || "-",
        item.totalSales,
        item.totalPayments,
        item.balance
      ]),
    });
    doc.save(`customer_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ReportLayout
      title="Customer Report"
      description="View and export customer information"
    >
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[180px]"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[180px]"
            />
            <Select
              onValueChange={(value) => setCustomerType(value)}
              value={customerType}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Customer Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="watav">Watav</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="w-[240px] justify-between"
                >
                  {selectedCustomers.length > 0
                    ? `${selectedCustomers.length} customer(s) selected`
                    : "Select customers..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput 
                    placeholder="Search customers..." 
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandEmpty>No customers found.</CommandEmpty>
                  <CommandGroup>
                    {filteredCustomers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        onSelect={() => {
                          setSelectedCustomers((current) =>
                            current.includes(customer.id)
                              ? current.filter((id) => id !== customer.id)
                              : [...current, customer.id]
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCustomers.includes(customer.id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {customer.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-sidebar">
                <TableRow>
                  <TableHead className="text-white rounded-tl-lg">Name</TableHead>
                  <TableHead className="text-white">Phone</TableHead>
                  <TableHead className="text-white">City</TableHead>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-white">Total Sales</TableHead>
                  <TableHead className="text-white">Total Payments</TableHead>
                  <TableHead className="text-white rounded-tr-lg">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesAndPayments.length > 0 ? (
                  salesAndPayments.map((item) => (
                    <TableRow key={item.customer.id} className="hover:bg-sidebar/10">
                      <TableCell className="font-medium">{item.customer.name}</TableCell>
                      <TableCell>{item.customer.phone || "-"}</TableCell>
                      <TableCell>{item.customer.city || "-"}</TableCell>
                      <TableCell>{item.customer.type || "-"}</TableCell>
                      <TableCell>{item.totalSales}</TableCell>
                      <TableCell>{item.totalPayments}</TableCell>
                      <TableCell>{item.balance}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </ReportLayout>
  );
};

export default CustomerReport; 