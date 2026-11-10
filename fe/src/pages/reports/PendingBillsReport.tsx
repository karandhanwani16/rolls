import { useCallback, useEffect, useMemo, useState } from "react";
import ReportLayout from "@/components/reports/ReportLayout";
import {
  customersAPI,
  pendingBillsAPI,
  suppliersAPI,
} from "@/services/api";
import { getRegularCustomers } from "@/lib/partyTypes";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import {
  Check,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  downloadReportPdf,
  formatPdfAmount,
  formatPdfDate,
  formatPdfPeriod,
} from "@/lib/reportPdf";
import { cn } from "@/lib/utils";

type PendingBillsVariant = "customer" | "supplier";

interface PendingApplication {
  type: "PAYMENT" | "RETURN" | string;
  id?: string | null;
  reference?: string | null;
  description?: string | null;
  date?: string | null;
  amount: number;
  source?: string | null;
}

interface PendingBill {
  id: string;
  bill_no: string;
  date: string;
  credit_days: number;
  due_date?: string | null;
  elapsed_days?: number;
  overdue_days?: number;
  bill_total: number;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: string;
  applications: PendingApplication[];
}

interface PendingPartyGroup {
  party_id: string;
  party_name: string;
  party_phone?: string | null;
  party_city?: string | null;
  bill_count: number;
  total_bill_amount: number;
  total_paid: number;
  total_outstanding: number;
  bills: PendingBill[];
}

interface PendingBillsData {
  summary: {
    party_count: number;
    bill_count: number;
    total_bill_amount: number;
    total_paid: number;
    total_outstanding: number;
  };
  groups: PendingPartyGroup[];
}

interface PartyOption {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
}

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return "—";
  }
};

const getFinancialYearStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

const statusBadgeVariant = (status: string) => {
  if (status === "PARTIAL") return "secondary" as const;
  return "destructive" as const;
};

const sourceLabel = (source?: string | null, type?: string) => {
  if (type === "RETURN") {
    if (source === "LINKED_RETURN") return "Linked return";
    if (source === "UNLINKED_RETURN") return "Return (settlement)";
    if (source === "RETURN_OVERFLOW") return "Return overflow";
    return "Return";
  }
  if (source === "BILL_PAYMENT") return "Bill payment";
  if (source === "PAYMENT_OVERFLOW") return "Payment overflow";
  if (source === "SETTLEMENT") return "Settlement allocation";
  return type === "PAYMENT" ? "Payment" : "Credit";
};

interface PendingBillsReportProps {
  variant: PendingBillsVariant;
}

const PendingBillsReport = ({ variant }: PendingBillsReportProps) => {
  const isCustomer = variant === "customer";
  const [data, setData] = useState<PendingBillsData | null>(null);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartyIds, setSelectedPartyIds] = useState<string[]>([]);
  const [partyOpen, setPartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(getFinancialYearStart());
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<"all" | "overdue">("all");
  const [openParties, setOpenParties] = useState<string[]>([]);
  const [openBills, setOpenBills] = useState<string[]>([]);
  const { toast } = useToast();

  const title = isCustomer ? "Customer Pending Bills" : "Supplier Pending Bills";
  const description = isCustomer
    ? "Unpaid and partially paid sales invoices by customer, with payment breakdowns"
    : "Unpaid and partially paid purchase bills by supplier, with payment breakdowns";
  const partyLabel = isCustomer ? "Customer" : "Supplier";
  const partyLabelPlural = isCustomer ? "Customers" : "Suppliers";
  const billLabel = isCustomer ? "Sales" : "Purchase";

  const fetchParties = useCallback(async () => {
    try {
      if (isCustomer) {
        const response = await customersAPI.getAll();
        setParties(
          getRegularCustomers(response || []).map((customer: any) => ({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            city: customer.city,
          }))
        );
      } else {
        const response = await suppliersAPI.getAll();
        setParties(
          (response || []).map((supplier: any) => ({
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone,
            city: supplier.city,
          }))
        );
      }
    } catch (error) {
      console.error(`Error fetching ${partyLabelPlural.toLowerCase()}:`, error);
      toast({
        title: "Error",
        description: `Failed to fetch ${partyLabelPlural.toLowerCase()}`,
        variant: "destructive",
      });
    }
  }, [isCustomer, partyLabelPlural, toast]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = isCustomer
        ? await pendingBillsAPI.getCustomerPendingBills({
            partyIds: selectedPartyIds,
          })
        : await pendingBillsAPI.getSupplierPendingBills({
            partyIds: selectedPartyIds,
          });
      setData(response.data || { summary: null, groups: [] });
    } catch (error) {
      console.error("Error fetching pending bills:", error);
      toast({
        title: "Error",
        description: `Failed to fetch ${title.toLowerCase()}`,
        variant: "destructive",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isCustomer, selectedPartyIds, title, toast]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPartyOptions = useMemo(() => {
    const query = partySearch.trim().toLowerCase();
    if (!query) return parties;
    return parties.filter(
      (party) =>
        party.name.toLowerCase().includes(query) ||
        party.phone?.toLowerCase().includes(query) ||
        party.city?.toLowerCase().includes(query)
    );
  }, [parties, partySearch]);

  const filteredGroups = useMemo(() => {
    const groups = data?.groups || [];
    const query = searchQuery.trim().toLowerCase();
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return groups
      .map((group) => {
        const bills = group.bills.filter((bill) => {
          const billDate = new Date(bill.date);
          const inDateRange = billDate >= start && billDate <= end;
          const overdueMatch =
            viewMode === "all" || (bill.overdue_days || 0) > 0;
          const searchMatch =
            !query ||
            (bill.bill_no || "").toLowerCase().includes(query) ||
            group.party_name.toLowerCase().includes(query) ||
            group.party_phone?.toLowerCase().includes(query) ||
            group.party_city?.toLowerCase().includes(query);
          return inDateRange && overdueMatch && searchMatch;
        });

        if (!bills.length) return null;

        const total_bill_amount = bills.reduce(
          (sum, bill) => sum + (bill.bill_total || 0),
          0
        );
        const total_paid = bills.reduce(
          (sum, bill) => sum + (bill.paid_amount || 0),
          0
        );
        const total_outstanding = bills.reduce(
          (sum, bill) => sum + (bill.outstanding_amount || 0),
          0
        );

        return {
          ...group,
          bills,
          bill_count: bills.length,
          total_bill_amount,
          total_paid,
          total_outstanding,
        };
      })
      .filter(Boolean) as PendingPartyGroup[];
  }, [data?.groups, searchQuery, startDate, endDate, viewMode]);

  const summary = useMemo(
    () =>
      filteredGroups.reduce(
        (acc, group) => {
          acc.party_count += 1;
          acc.bill_count += group.bill_count;
          acc.total_bill_amount += group.total_bill_amount;
          acc.total_paid += group.total_paid;
          acc.total_outstanding += group.total_outstanding;
          return acc;
        },
        {
          party_count: 0,
          bill_count: 0,
          total_bill_amount: 0,
          total_paid: 0,
          total_outstanding: 0,
        }
      ),
    [filteredGroups]
  );

  const flatBills = useMemo(
    () =>
      filteredGroups.flatMap((group) =>
        group.bills.map((bill) => ({
          party_name: group.party_name,
          ...bill,
        }))
      ),
    [filteredGroups]
  );

  const overdueCount = useMemo(
    () => flatBills.filter((bill) => (bill.overdue_days || 0) > 0).length,
    [flatBills]
  );

  const selectedPartyNames =
    selectedPartyIds.length > 0
      ? parties
          .filter((party) => selectedPartyIds.includes(party.id))
          .map((party) => party.name)
          .join(", ")
      : `All ${partyLabelPlural}`;

  const toggleParty = (partyId: string) => {
    setSelectedPartyIds((prev) =>
      prev.includes(partyId)
        ? prev.filter((id) => id !== partyId)
        : [...prev, partyId]
    );
  };

  const exportToPDF = () => {
    const billNoHeader = isCustomer ? "Sales No" : "Purchase No";
    const slug = isCustomer ? "customer_pending_bills" : "supplier_pending_bills";

    downloadReportPdf({
      title,
      filename: `${slug}_${format(new Date(startDate), "yyyyMMdd")}_to_${format(new Date(endDate), "yyyyMMdd")}.pdf`,
      orientation: "landscape",
      meta: [
        { label: partyLabelPlural, value: selectedPartyNames },
        { label: "Period", value: formatPdfPeriod(startDate, endDate) },
        {
          label: "View",
          value: viewMode === "overdue" ? "Overdue Only" : "All Pending",
        },
      ],
      summary: [
        {
          label: "Total Outstanding",
          value: formatPdfAmount(summary.total_outstanding),
          emphasize: true,
        },
        { label: "Paid so far", value: formatPdfAmount(summary.total_paid) },
        { label: "Pending Bills", value: String(summary.bill_count) },
        { label: "Overdue Bills", value: String(overdueCount) },
      ],
      columns: [
        { header: billNoHeader, width: 26, align: "center" },
        { header: partyLabel, align: "left" },
        { header: "Date", width: 24, align: "center" },
        { header: "Due Date", width: 24, align: "center" },
        { header: "Credit Days", width: 22, align: "center" },
        { header: "Bill Total", width: 28, align: "right" },
        { header: "Paid", width: 26, align: "right" },
        { header: "Outstanding", width: 30, align: "right" },
        { header: "Overdue", width: 20, align: "center" },
        { header: "Status", width: 24, align: "center" },
      ],
      rows: flatBills.map((bill) => [
        bill.bill_no || "—",
        bill.party_name || "—",
        formatPdfDate(bill.date),
        bill.due_date ? formatPdfDate(bill.due_date) : "—",
        String(bill.credit_days || 0),
        formatPdfAmount(bill.bill_total, { prefix: false }),
        formatPdfAmount(bill.paid_amount, { prefix: false }),
        formatPdfAmount(bill.outstanding_amount, { prefix: false }),
        String(bill.overdue_days || 0),
        bill.payment_status || "UNPAID",
      ]),
      foot: [
        "",
        "",
        "",
        "",
        "Total",
        formatPdfAmount(summary.total_bill_amount, { prefix: false }),
        formatPdfAmount(summary.total_paid, { prefix: false }),
        formatPdfAmount(summary.total_outstanding, { prefix: false }),
        "",
        "",
      ],
    });
  };

  const exportToCSV = () => {
    const billNoHeader = isCustomer ? "Sales No" : "Purchase No";
    const slug = isCustomer ? "customer_pending_bills" : "supplier_pending_bills";
    const headers = [
      billNoHeader,
      partyLabel,
      "Date",
      "Due Date",
      "Credit Days",
      "Bill Total",
      "Paid",
      "Outstanding",
      "Overdue Days",
      "Status",
    ];
    const csvContent = [
      headers.join(","),
      ...flatBills.map((bill) =>
        [
          `"${bill.bill_no || ""}"`,
          `"${bill.party_name || ""}"`,
          bill.date ? format(new Date(bill.date), "yyyy-MM-dd") : "",
          bill.due_date ? format(new Date(bill.due_date), "yyyy-MM-dd") : "",
          bill.credit_days || 0,
          bill.bill_total ?? 0,
          bill.paid_amount ?? 0,
          bill.outstanding_amount ?? 0,
          bill.overdue_days || 0,
          `"${bill.payment_status || "UNPAID"}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${slug}_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ReportLayout title={title} description={description}>
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap items-center gap-3">
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
            value={viewMode}
            onValueChange={(value: "all" | "overdue") => setViewMode(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pending</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
            </SelectContent>
          </Select>
          <Popover open={partyOpen} onOpenChange={setPartyOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={partyOpen}
                className="w-[240px] justify-between"
              >
                {selectedPartyIds.length > 0
                  ? `${selectedPartyIds.length} ${partyLabel.toLowerCase()}(s) selected`
                  : `All ${partyLabelPlural.toLowerCase()}`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={`Search ${partyLabelPlural.toLowerCase()}...`}
                  value={partySearch}
                  onValueChange={setPartySearch}
                />
                <CommandEmpty>No {partyLabelPlural.toLowerCase()} found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {filteredPartyOptions.map((party) => (
                    <CommandItem
                      key={party.id}
                      value={party.id}
                      onSelect={() => toggleParty(party.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedPartyIds.includes(party.id)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="truncate">{party.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedPartyIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPartyIds([])}
              className="h-9 px-2 text-muted-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              Clear filter
            </Button>
          )}
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
          <div className="relative w-full max-w-md sm:ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${partyLabel.toLowerCase()} or bill no...`}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="sticky top-0 z-10 bg-background pb-2">
              <div className="bg-sidebar/5 rounded-lg p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    {partyLabelPlural}
                  </span>
                  <span className="font-medium">{summary.party_count}</span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Pending Bills
                  </span>
                  <span className="font-medium">{summary.bill_count}</span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">Paid so far</span>
                  <span className="font-medium text-emerald-700">
                    {formatAmount(summary.total_paid)}
                  </span>
                </div>
                <div className="flex justify-between items-center md:flex-col md:items-start md:gap-1">
                  <span className="text-sm text-muted-foreground">
                    Total Outstanding
                  </span>
                  <span className="font-semibold text-red-600">
                    {formatAmount(summary.total_outstanding)}
                  </span>
                </div>
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
                No pending bills found
              </div>
            ) : (
              <Accordion
                type="multiple"
                value={openParties}
                onValueChange={setOpenParties}
                className="space-y-3"
              >
                {filteredGroups.map((group) => (
                  <AccordionItem
                    key={group.party_id}
                    value={group.party_id}
                    className="rounded-lg border border-sidebar/15 bg-white shadow-sm overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-sidebar/5 [&[data-state=open]]:bg-sidebar/5">
                      <div className="flex flex-1 flex-col gap-2 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate">
                            {group.party_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {group.bill_count} pending{" "}
                            {group.bill_count === 1 ? "bill" : "bills"}
                            {group.party_city ? ` · ${group.party_city}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span className="text-muted-foreground">
                            Paid{" "}
                            <span className="font-medium text-emerald-700">
                              {formatAmount(group.total_paid)}
                            </span>
                          </span>
                          <span className="rounded-md bg-red-50 px-2 py-1 font-semibold text-red-700">
                            Due {formatAmount(group.total_outstanding)}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-1">
                      <Accordion
                        type="multiple"
                        value={openBills}
                        onValueChange={setOpenBills}
                        className="space-y-2"
                      >
                        {group.bills.map((bill) => (
                          <AccordionItem
                            key={bill.id}
                            value={bill.id}
                            className="rounded-md border border-sidebar/10 bg-sidebar/[0.03]"
                          >
                            <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-sidebar/5">
                              <div className="flex flex-1 flex-col gap-2 pr-2 text-left lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-gray-800">
                                      {billLabel} #{bill.bill_no || "—"}
                                    </span>
                                    <Badge
                                      variant={statusBadgeVariant(
                                        bill.payment_status
                                      )}
                                    >
                                      {bill.payment_status || "UNPAID"}
                                    </Badge>
                                    {(bill.overdue_days || 0) > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="border-red-200 text-red-700"
                                      >
                                        {bill.overdue_days}d overdue
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(bill.date)}
                                    {bill.due_date
                                      ? ` · Due ${formatDate(bill.due_date)}`
                                      : ""}
                                    {typeof bill.elapsed_days === "number"
                                      ? ` · ${bill.elapsed_days}d elapsed`
                                      : ""}
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm">
                                  <div className="text-right">
                                    <div className="text-muted-foreground">
                                      Bill
                                    </div>
                                    <div className="font-medium">
                                      {formatAmount(bill.bill_total)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-muted-foreground">
                                      Paid
                                    </div>
                                    <div className="font-medium text-emerald-700">
                                      {formatAmount(bill.paid_amount)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-muted-foreground">
                                      Remaining
                                    </div>
                                    <div className="font-semibold text-red-600">
                                      {formatAmount(bill.outstanding_amount)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3">
                              <div className="rounded-md border bg-white overflow-hidden">
                                <div className="bg-sidebar px-3 py-2 text-xs font-medium text-white flex justify-between">
                                  <span>
                                    Payment transactions against this bill
                                  </span>
                                  <span>
                                    Remaining{" "}
                                    {formatAmount(bill.outstanding_amount)}
                                  </span>
                                </div>
                                {bill.applications?.length ? (
                                  <div className="divide-y">
                                    {bill.applications.map((app, index) => (
                                      <div
                                        key={`${bill.id}-${app.id || "x"}-${index}`}
                                        className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-gray-800">
                                              {app.type === "RETURN"
                                                ? "Return"
                                                : "Payment"}
                                              {app.reference
                                                ? ` · ${app.reference}`
                                                : ""}
                                            </span>
                                            <span
                                              className={cn(
                                                "rounded px-1.5 py-0.5 text-[11px]",
                                                app.type === "RETURN"
                                                  ? "bg-amber-50 text-amber-800"
                                                  : "bg-sky-50 text-sky-800"
                                              )}
                                            >
                                              {sourceLabel(app.source, app.type)}
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {formatDate(app.date)}
                                            {app.description
                                              ? ` · ${app.description}`
                                              : ""}
                                          </div>
                                        </div>
                                        <div className="text-sm font-semibold text-emerald-700 sm:text-right">
                                          −{formatAmount(app.amount)}
                                        </div>
                                      </div>
                                    ))}
                                    <div className="flex items-center justify-between bg-sidebar/5 px-3 py-2 text-sm">
                                      <span className="font-medium text-gray-700">
                                        Still outstanding
                                      </span>
                                      <span className="font-semibold text-red-600">
                                        {formatAmount(bill.outstanding_amount)}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                                    No payments or returns applied yet — full
                                    bill amount is outstanding.
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </ReportLayout>
  );
};

export default PendingBillsReport;
