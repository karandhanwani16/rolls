
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Plus, Trash2, Save, ArrowLeft } from "lucide-react";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

const NewInvoice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", description: "", quantity: 1, rate: 0, amount: 0 }
  ]);
  const [customer, setCustomer] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${String(Date.now()).slice(-5)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  const addItem = () => {
    const newId = String(parseInt(items[items.length - 1].id) + 1);
    setItems([...items, { id: newId, description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast({
        title: "Cannot remove item",
        description: "Invoice must have at least one item",
        variant: "destructive",
      });
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Auto-calculate amount
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const gstRate = 0.18; // 18% GST
  const gstAmount = subTotal * gstRate;
  const total = subTotal + gstAmount;

  const handleSaveInvoice = () => {
    if (!customer) {
      toast({
        title: "Missing information",
        description: "Please select a customer",
        variant: "destructive",
      });
      return;
    }

    if (items.some(item => !item.description || item.amount === 0)) {
      toast({
        title: "Incomplete items",
        description: "Please fill in all item details",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Invoice saved",
      description: "Invoice has been created successfully",
    });
    navigate("/invoices");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <FileText className="mr-2" /> New Invoice
          </h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate("/invoices")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button 
              className="bg-brand-teal hover:bg-teal-700"
              onClick={handleSaveInvoice}
            >
              <Save className="mr-1 h-4 w-4" /> Save Invoice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select value={customer} onValueChange={setCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raj-enterprises">Raj Enterprises</SelectItem>
                      <SelectItem value="gupta-traders">Gupta Traders</SelectItem>
                      <SelectItem value="sharma-industries">Sharma Industries</SelectItem>
                      <SelectItem value="kumar-retail">Kumar Retail</SelectItem>
                      <SelectItem value="patel-distributions">Patel Distributions</SelectItem>
                      <SelectItem value="singh-automobiles">Singh Automobiles</SelectItem>
                      <SelectItem value="joshi-pharma">Joshi Pharma</SelectItem>
                      <SelectItem value="reddy-electronics">Reddy Electronics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input 
                    id="invoiceNumber" 
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input 
                    id="invoiceDate" 
                    type="date" 
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input 
                    id="dueDate" 
                    type="date" 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Select defaultValue="15">
                    <SelectTrigger id="paymentTerms">
                      <SelectValue placeholder="Select terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Net 7 days</SelectItem>
                      <SelectItem value="15">Net 15 days</SelectItem>
                      <SelectItem value="30">Net 30 days</SelectItem>
                      <SelectItem value="60">Net 60 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="Item description"
                        />
                      </TableCell>
                      <TableCell>
                        <CurrencyInput
                          allowDecimals={false}
                          value={item.quantity}
                          onChange={(n) => updateItem(item.id, "quantity", n || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <CurrencyInput
                          value={item.rate}
                          onChange={(n) => updateItem(item.id, "rate", n || 0)}
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <Button
              variant="outline"
              onClick={addItem}
              className="mt-4"
            >
              <Plus className="mr-1 h-4 w-4" /> Add Item
            </Button>

            <div className="mt-6 border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Subtotal:</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">GST (18%):</span>
                <span>{formatCurrency(gstAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => navigate("/invoices")}
          >
            Cancel
          </Button>
          <Button 
            className="bg-brand-teal hover:bg-teal-700"
            onClick={handleSaveInvoice}
          >
            <Save className="mr-1 h-4 w-4" /> Save Invoice
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NewInvoice;
