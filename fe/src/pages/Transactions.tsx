import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { CreditCard, Plus, Edit, Trash2 } from "lucide-react";
import { transactionsAPI } from "@/services/api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTableControls, uniqueOptions } from "@/hooks/useTableControls";

// Form schema
const transactionSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  customer_id: z.string().optional(),
  supplier_id: z.string().optional(),
  amount: z.coerce.number().min(0),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const Transactions = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<any>(null);

  const queryClient = useQueryClient();

  // Load data
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await transactionsAPI.getAll();
      return response;
    }
  });

  // Mutations
  const addTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormValues) => transactionsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: "Transaction Added",
        description: "Transaction has been successfully added.",
      });
      setIsAddDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error adding transaction:", error);
      toast({
        title: "Error",
        description: "Failed to add transaction.",
        variant: "destructive",
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionFormValues }) => 
      transactionsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: "Transaction Updated",
        description: "Transaction has been successfully updated.",
      });
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error updating transaction:", error);
      toast({
        title: "Error",
        description: "Failed to update transaction.",
        variant: "destructive",
      });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => transactionsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: "Transaction Deleted",
        description: "Transaction has been successfully deleted.",
      });
    },
    onError: (error) => {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to delete transaction.",
        variant: "destructive",
      });
    },
  });

  // Form
  const addForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "",
      description: "",
      customer_id: "",
      supplier_id: "",
      amount: 0,
    },
  });

  const editForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "",
      description: "",
      customer_id: "",
      supplier_id: "",
      amount: 0,
    },
  });

  const searchFns = useMemo(
    () => [
      (t: any) => t.description,
      (t: any) => t.type,
      (t: any) => t.customer?.name,
      (t: any) => t.supplier?.name,
    ],
    []
  );

  const getSortValue = useMemo(
    () => (t: any, key: string) => {
      switch (key) {
        case "type":
          return t.type;
        case "description":
          return t.description;
        case "party":
          return t.customer?.name || t.supplier?.name;
        case "amount":
          return t.amount ?? 0;
        case "created_at":
          return t.created_at ? new Date(t.created_at) : null;
        default:
          return null;
      }
    },
    []
  );

  const filters = useMemo(
    () => [
      {
        key: "type",
        label: "Type",
        options: uniqueOptions((transactionsData || []).map((t: any) => t.type), (v) =>
          v.charAt(0).toUpperCase() + v.slice(1)
        ),
        predicate: (t: any, value: string) => t.type === value,
      },
    ],
    [transactionsData]
  );

  const {
    searchTerm,
    setSearchTerm,
    sort,
    toggleSort,
    setFilter,
    clearFilters,
    hasActiveFilters,
    filterDefs,
    rows,
  } = useTableControls({
    data: transactionsData,
    searchFns,
    getSortValue,
    filters,
    defaultSort: { key: "created_at", direction: "desc" },
  });

  // Handle edit button click
  const handleEdit = (transaction: any) => {
    setCurrentTransaction(transaction);
    editForm.reset({
      type: transaction.type,
      description: transaction.description || "",
      customer_id: transaction.customer_id || "",
      supplier_id: transaction.supplier_id || "",
      amount: transaction.amount,
    });
    setIsEditDialogOpen(true);
  };

  // Format currency
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
            <CreditCard className="mr-2" /> Transactions
          </h1>
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-brand-teal hover:bg-teal-700"
          >
            <Plus className="mr-1 h-4 w-4" /> New Transaction
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <TableToolbar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search transactions..."
            filters={filterDefs}
            onFilterChange={setFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Description" sortKey="description" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Customer / Supplier" sortKey="party" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Amount" sortKey="amount" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Date" sortKey="created_at" sort={sort} onSort={toggleSort} />
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTransactions ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="capitalize">{transaction.type}</TableCell>
                      <TableCell>{transaction.description || "-"}</TableCell>
                      <TableCell>
                        {transaction.customer?.name || transaction.supplier?.name || "-"}
                      </TableCell>
                      <TableCell className={cn(
                        "font-medium",
                        transaction.type === "incoming" ? "text-green-600" : "text-red-600"
                      )}>
                        {transaction.type === "incoming" ? "+" : "-"}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this transaction?")) {
                                deleteTransactionMutation.mutate(transaction.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
          </DialogHeader>
          
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => addTransactionMutation.mutate(data))}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={addForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="incoming">Incoming</SelectItem>
                          <SelectItem value="outgoing">Outgoing</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter transaction description" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={addTransactionMutation.isPending}>
                  {addTransactionMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => 
              updateTransactionMutation.mutate({ id: currentTransaction.id, data })
            )}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="incoming">Incoming</SelectItem>
                          <SelectItem value="outgoing">Outgoing</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter transaction description" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={updateTransactionMutation.isPending}>
                  {updateTransactionMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Transactions;
