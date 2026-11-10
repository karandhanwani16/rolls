import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { customersAPI, paymentsInAPI } from "@/services/api";
import { getRegularCustomers, getWatavVendors } from "@/lib/partyTypes";
import {
  settlementClassName,
  settlementLabel,
} from "@/lib/watavSettlement";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableControls } from "@/hooks/useTableControls";
import { format } from "date-fns";
import {
  Loader2,
  Clock3,
  Search,
  FilterX,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const instrumentTypes = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

const PendingWatav = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [byWatav, setByWatav] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [vendorOpen, setVendorOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  const [receiptVendorId, setReceiptVendorId] = useState("");
  const [receiptAmount, setReceiptAmount] = useState(0);
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [receiptType, setReceiptType] = useState("cash");
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [allocationResult, setAllocationResult] = useState<any>(null);
  const [historyPayment, setHistoryPayment] = useState<any>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchPending();
  }, [startDate, endDate, selectedVendor, entryTypeFilter]);

  useEffect(() => {
    if (selectedVendor && !receiptVendorId) {
      setReceiptVendorId(selectedVendor);
    }
  }, [selectedVendor]);

  const fetchCustomers = async () => {
    try {
      const data = await customersAPI.getAll();
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await paymentsInAPI.getWatavReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        watavCustomerId: selectedVendor || undefined,
        collectionStatus: "PENDING",
        entryType: entryTypeFilter === "ALL" ? undefined : entryTypeFilter,
      });
      setTransactions(data.data || []);
      setByWatav(data.byWatav || []);
      setReceipts(data.receipts || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error("Error fetching pending watav:", error);
      toast({
        title: "Error",
        description: "Failed to fetch pending Watav entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const watavVendors = useMemo(() => getWatavVendors(customers), [customers]);

  const payingCustomers = useMemo(
    () => getRegularCustomers(customers),
    [customers]
  );

  const filteredVendorOptions = watavVendors.filter(
    (c) =>
      c.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      c.phone?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const filteredCustomerOptions = payingCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const selectedVendorName =
    customers.find((c) => c.id === selectedVendor)?.name || "All vendors";
  const selectedCustomerName =
    selectedCustomer === "__NONE__"
      ? "Standalone only (no customer)"
      : customers.find((c) => c.id === selectedCustomer)?.name || "All customers";

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((item) => {
      if (selectedCustomer) {
        if (selectedCustomer === "__NONE__") {
          if (item.entryType !== "STANDALONE" && item.actualCustomerId) return false;
        } else if (item.actualCustomerId !== selectedCustomer) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.watavCustomerName?.toLowerCase().includes(q) ||
        item.actualCustomerName?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q)
      );
    });
  }, [transactions, selectedCustomer, searchTerm]);

  const getEntriesSortValue = useMemo(
    () => (item: any, key: string) => {
      switch (key) {
        case "date":
          return item.date ? new Date(item.date) : null;
        case "vendor":
          return item.watavCustomerName;
        case "customer":
          return item.actualCustomerName;
        case "entryType":
          return item.entryType === "STANDALONE" ? "Standalone" : "Customer";
        case "status":
          return settlementLabel(item.collectionStatus);
        case "original":
          return item.originalAmount ?? item.receivedAmount ?? 0;
        case "settled":
          return item.totalSettledAmount || 0;
        case "remaining":
          return item.remainingAmount ?? item.receivedAmount ?? 0;
        default:
          return null;
      }
    },
    []
  );

  const getVendorSortValue = useMemo(
    () => (row: any, key: string) => {
      switch (key) {
        case "vendor":
          return row.watavCustomerName;
        case "entries":
          return row.pendingEntries ?? 0;
        case "receivable":
          return row.totalReceivable ?? row.pendingGross ?? 0;
        case "settled":
          return row.totalSettled || 0;
        case "pending":
          return row.currentPending ?? row.pendingNet ?? 0;
        case "unallocated":
          return row.unallocatedAmount || 0;
        default:
          return null;
      }
    },
    []
  );

  const getReceiptSortValue = useMemo(
    () => (receipt: any, key: string) => {
      switch (key) {
        case "date":
          return receipt.receipt_date ? new Date(receipt.receipt_date) : null;
        case "vendor":
          return receipt.vendor?.name;
        case "reference":
          return receipt.reference || receipt.type;
        case "received":
          return receipt.amount ?? 0;
        case "allocated":
          return (
            receipt.allocatedAmount ??
            (receipt.amount - (receipt.unallocated_amount || 0))
          );
        case "unallocated":
          return receipt.unallocatedAmount ?? (receipt.unallocated_amount || 0);
        default:
          return null;
      }
    },
    []
  );

  const {
    sort: entriesSort,
    toggleSort: toggleEntriesSort,
    rows: sortedEntries,
  } = useTableControls({
    data: filteredTransactions,
    getSortValue: getEntriesSortValue,
  });

  const {
    sort: vendorSort,
    toggleSort: toggleVendorSort,
    rows: sortedVendors,
  } = useTableControls({
    data: byWatav,
    getSortValue: getVendorSortValue,
  });

  const {
    sort: receiptsSort,
    toggleSort: toggleReceiptsSort,
    rows: sortedReceipts,
  } = useTableControls({
    data: receipts,
    getSortValue: getReceiptSortValue,
  });

  const filteredSummary = useMemo(() => {
    const rows = filteredTransactions;
    return {
      entries: rows.length,
      remaining: rows.reduce((s, r) => s + (r.remainingAmount ?? r.receivedAmount ?? 0), 0),
      settled: rows.reduce((s, r) => s + (r.totalSettledAmount || 0), 0),
      original: rows.reduce((s, r) => s + (r.originalAmount ?? r.receivedAmount ?? 0), 0),
      customerLinkedGross: rows
        .filter((r) => r.entryType === "CUSTOMER_PAYMENT")
        .reduce((s, r) => s + (r.remainingAmount ?? r.receivedAmount ?? 0), 0),
      standaloneGross: rows
        .filter((r) => r.entryType === "STANDALONE")
        .reduce((s, r) => s + (r.remainingAmount ?? r.receivedAmount ?? 0), 0),
      partial: rows.filter((r) => r.collectionStatus === "PARTIALLY_SETTLED").length,
      unallocated: summary?.unallocatedAmount || 0,
    };
  }, [filteredTransactions, summary]);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedVendor("");
    setSelectedCustomer("");
    setEntryTypeFilter("ALL");
    setSearchTerm("");
  };

  const hasActiveFilters =
    !!startDate ||
    !!endDate ||
    !!selectedVendor ||
    !!selectedCustomer ||
    entryTypeFilter !== "ALL" ||
    !!searchTerm;

  const handleReceive = async () => {
    if (!receiptVendorId) {
      toast({
        title: "Watav vendor required",
        description: "Select the vendor you received money from.",
        variant: "destructive",
      });
      return;
    }
    if (!receiptAmount || receiptAmount <= 0) {
      toast({
        title: "Amount required",
        description: "Enter the amount received from the vendor.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      const result = await paymentsInAPI.createWatavReceipt({
        vendor_id: receiptVendorId,
        amount: receiptAmount,
        receipt_date: receiptDate,
        type: receiptType,
        reference: receiptReference || undefined,
        description: receiptNotes || undefined,
      });
      setAllocationResult(result.data);
      setReceiptAmount(0);
      setReceiptReference("");
      setReceiptNotes("");
      toast({
        title: "Vendor receipt saved",
        description: "Amount was allocated against outstanding Watav payments (oldest first).",
      });
      await fetchPending();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to record vendor receipt",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Clock3 className="mr-2" /> Pending Watav
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Customer Watav payments are already paid. Record money received from the vendor to settle the vendor receivable.
            </p>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          <div>
            <h2 className="font-semibold">Receive from Watav Vendor</h2>
            <p className="text-sm text-muted-foreground">
              Saved receipts are allocated automatically against this vendor&apos;s oldest outstanding Watav payments.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Watav vendor <span className="text-red-500">*</span>
              </label>
              <Select value={receiptVendorId || undefined} onValueChange={setReceiptVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {watavVendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Amount <span className="text-red-500">*</span>
              </label>
              <CurrencyInput value={receiptAmount} onChange={setReceiptAmount} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Instrument</label>
              <Select value={receiptType} onValueChange={setReceiptType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {instrumentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reference</label>
              <Input
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                placeholder="Cheque / UTR / note"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full bg-brand-teal hover:bg-teal-700"
                disabled={saving}
                onClick={handleReceive}
              >
                {saving ? "Saving..." : "Save receipt"}
              </Button>
            </div>
          </div>
          <Textarea
            placeholder="Notes (optional)"
            value={receiptNotes}
            onChange={(e) => setReceiptNotes(e.target.value)}
          />
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">From date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">To date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Watav vendor</label>
              <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedVendorName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search vendor..."
                      value={vendorSearch}
                      onValueChange={setVendorSearch}
                    />
                    <CommandEmpty>No vendors found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedVendor("");
                          setVendorOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedVendor ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All vendors
                      </CommandItem>
                      {filteredVendorOptions.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          onSelect={() => {
                            setSelectedVendor(customer.id);
                            setReceiptVendorId(customer.id);
                            setVendorOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedVendor === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {customer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Customer</label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedCustomerName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search customer..."
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandEmpty>No customers found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setSelectedCustomer("");
                          setCustomerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedCustomer ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All customers
                      </CommandItem>
                      <CommandItem
                        onSelect={() => {
                          setSelectedCustomer("__NONE__");
                          setCustomerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCustomer === "__NONE__" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Standalone only (no customer)
                      </CommandItem>
                      {filteredCustomerOptions.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          onSelect={() => {
                            setSelectedCustomer(customer.id);
                            setCustomerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {customer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Entry type</label>
              <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Entry type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All entry types</SelectItem>
                  <SelectItem value="CUSTOMER_PAYMENT">Customer-linked</SelectItem>
                  <SelectItem value="STANDALONE">Standalone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Vendor, customer, notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <div className="text-sm text-muted-foreground">Outstanding entries</div>
            <div className="text-2xl font-semibold mt-1">{filteredSummary.entries}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {filteredSummary.partial} partially settled
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <div className="text-sm text-muted-foreground">Vendor receivable</div>
            <div className="text-2xl font-semibold mt-1">
              {formatAmount(filteredSummary.original)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <div className="text-sm text-muted-foreground">Settled</div>
            <div className="text-2xl font-semibold mt-1 text-green-700">
              {formatAmount(filteredSummary.settled)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <div className="text-sm text-muted-foreground">Pending collection</div>
            <div className="text-2xl font-bold mt-1 text-amber-900">
              {formatAmount(filteredSummary.remaining)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Customer {formatAmount(filteredSummary.customerLinkedGross)} · Standalone{" "}
              {formatAmount(filteredSummary.standaloneGross)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border">
            <div className="text-sm text-muted-foreground">Unallocated receipts</div>
            <div className="text-2xl font-semibold mt-1">
              {formatAmount(filteredSummary.unallocated)}
            </div>
          </div>
        </div>

        {!selectedVendor && byWatav.length > 0 && !searchTerm && !selectedCustomer && (
          <div className="rounded-md border overflow-hidden bg-white">
            <div className="bg-sidebar px-4 py-2 text-white text-sm font-medium">
              Pending by vendor
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Vendor"
                    sortKey="vendor"
                    sort={vendorSort}
                    onSort={toggleVendorSort}
                  />
                  <SortableHeader
                    label="Entries"
                    sortKey="entries"
                    sort={vendorSort}
                    onSort={toggleVendorSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Receivable"
                    sortKey="receivable"
                    sort={vendorSort}
                    onSort={toggleVendorSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Settled"
                    sortKey="settled"
                    sort={vendorSort}
                    onSort={toggleVendorSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Pending"
                    sortKey="pending"
                    sort={vendorSort}
                    onSort={toggleVendorSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Unallocated"
                    sortKey="unallocated"
                    sort={vendorSort}
                    onSort={toggleVendorSort}
                    align="right"
                    className="text-right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVendors.map((row) => (
                  <TableRow
                    key={row.watavCustomerId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedVendor(row.watavCustomerId);
                      setReceiptVendorId(row.watavCustomerId);
                    }}
                  >
                    <TableCell className="font-medium">{row.watavCustomerName}</TableCell>
                    <TableCell className="text-right">{row.pendingEntries}</TableCell>
                    <TableCell className="text-right">
                      {formatAmount(row.totalReceivable || row.pendingGross)}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {formatAmount(row.totalSettled || 0)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-800">
                      {formatAmount(row.currentPending || row.pendingNet)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(row.unallocatedAmount || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-md border overflow-hidden bg-white">
          {loading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Date"
                    sortKey="date"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                  />
                  <SortableHeader
                    label="Vendor"
                    sortKey="vendor"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                  />
                  <SortableHeader
                    label="Customer"
                    sortKey="customer"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                  />
                  <SortableHeader
                    label="Entry"
                    sortKey="entryType"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                  />
                  <SortableHeader
                    label="Original"
                    sortKey="original"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Settled"
                    sortKey="settled"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Remaining"
                    sortKey="remaining"
                    sort={entriesSort}
                    onSort={toggleEntriesSort}
                    align="right"
                    className="text-right"
                  />
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.length > 0 ? (
                  sortedEntries.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setHistoryPayment(item)}
                    >
                      <TableCell>
                        {format(new Date(item.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">{item.watavCustomerName}</TableCell>
                      <TableCell>
                        {item.actualCustomerName || (
                          <span className="italic text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.entryType === "STANDALONE" ? "Standalone" : "Customer"}
                      </TableCell>
                      <TableCell>
                        <span className={settlementClassName(item.collectionStatus)}>
                          {settlementLabel(item.collectionStatus)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAmount(item.originalAmount ?? item.receivedAmount)}
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatAmount(item.totalSettledAmount || 0)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatAmount(item.remainingAmount ?? item.receivedAmount)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">
                        {item.description || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No pending Watav entries match these filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {receipts.length > 0 && (
          <div className="rounded-md border overflow-hidden bg-white">
            <div className="bg-sidebar px-4 py-2 text-white text-sm font-medium">
              Vendor receipts
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    label="Date"
                    sortKey="date"
                    sort={receiptsSort}
                    onSort={toggleReceiptsSort}
                  />
                  <SortableHeader
                    label="Vendor"
                    sortKey="vendor"
                    sort={receiptsSort}
                    onSort={toggleReceiptsSort}
                  />
                  <SortableHeader
                    label="Reference"
                    sortKey="reference"
                    sort={receiptsSort}
                    onSort={toggleReceiptsSort}
                  />
                  <SortableHeader
                    label="Received"
                    sortKey="received"
                    sort={receiptsSort}
                    onSort={toggleReceiptsSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Allocated"
                    sortKey="allocated"
                    sort={receiptsSort}
                    onSort={toggleReceiptsSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableHeader
                    label="Unallocated"
                    sortKey="unallocated"
                    sort={receiptsSort}
                    onSort={toggleReceiptsSort}
                    align="right"
                    className="text-right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReceipts.map((receipt) => (
                  <TableRow
                    key={receipt.id}
                    className="cursor-pointer"
                    onClick={() => setAllocationResult(receipt)}
                  >
                    <TableCell>
                      {format(new Date(receipt.receipt_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{receipt.vendor?.name || "—"}</TableCell>
                    <TableCell>{receipt.reference || receipt.type || "—"}</TableCell>
                    <TableCell className="text-right">{formatAmount(receipt.amount)}</TableCell>
                    <TableCell className="text-right text-green-700">
                      {formatAmount(receipt.allocatedAmount ?? (receipt.amount - (receipt.unallocated_amount || 0)))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(receipt.unallocatedAmount ?? (receipt.unallocated_amount || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AllocationDialog
        receipt={allocationResult}
        onClose={() => setAllocationResult(null)}
      />
      <PaymentHistoryDialog
        payment={historyPayment}
        onClose={() => setHistoryPayment(null)}
      />
    </DashboardLayout>
  );
};

function AllocationDialog({
  receipt,
  onClose,
}: {
  receipt: any;
  onClose: () => void;
}) {
  if (!receipt) return null;
  const allocations = receipt.allocations || [];
  return (
    <Dialog open={!!receipt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Vendor receipt allocation</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Received</div>
            <div className="font-semibold">{formatAmount(receipt.amount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Allocated</div>
            <div className="font-semibold text-green-700">
              {formatAmount(receipt.allocatedAmount ?? (receipt.amount - (receipt.unallocated_amount || 0)))}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Unallocated</div>
            <div className="font-semibold">
              {formatAmount(receipt.unallocatedAmount ?? (receipt.unallocated_amount || 0))}
            </div>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length > 0 ? (
              allocations.map((row: any) => (
                <TableRow key={row.id || row.payment_in_id}>
                  <TableCell>
                    {row.paymentDate
                      ? format(new Date(row.paymentDate), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {row.actualCustomerName || (
                      <span className="italic text-muted-foreground">Standalone</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(row.allocated_amount ?? row.allocatedAmount)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No outstanding payments — entire amount is unallocated vendor credit
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentHistoryDialog({
  payment,
  onClose,
}: {
  payment: any;
  onClose: () => void;
}) {
  if (!payment) return null;
  const allocations = payment.allocations || payment.watav_allocations || [];
  return (
    <Dialog open={!!payment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Watav payment settlement</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Original</div>
            <div className="font-semibold">
              {formatAmount(payment.originalAmount ?? payment.receivedAmount)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Settled</div>
            <div className="font-semibold text-green-700">
              {formatAmount(payment.totalSettledAmount || 0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Remaining</div>
            <div className="font-semibold">
              {formatAmount(payment.remainingAmount ?? 0)}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Customer {payment.actualCustomerName || "None"} already has this amount as a completed payment.
          Vendor status: {settlementLabel(payment.collectionStatus || payment.settlementStatus)}.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.length > 0 ? (
              allocations.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.receiptDate
                      ? format(new Date(row.receiptDate), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>{row.receiptReference || "—"}</TableCell>
                  <TableCell className="text-right">
                    {formatAmount(row.allocatedAmount ?? row.allocated_amount)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No vendor receipts allocated yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PendingWatav;
