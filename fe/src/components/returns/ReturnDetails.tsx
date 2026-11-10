import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import SearchableSelect from "@/components/ui/searchable-select";
import { useFormSectionNavigation } from "@/lib/formKeyboardNavigation";

interface ReturnDetailsProps {
  mode: "sales" | "purchase";
  formData: any;
  setFormData: (data: any) => void;
  parties: any[];
  bills: any[];
  billsLoading?: boolean;
  onPartyChange: (partyId: string) => void;
  onBillChange: (billId: string) => void;
}

const ReturnDetails = ({
  mode,
  formData,
  setFormData,
  parties,
  bills,
  billsLoading = false,
  onPartyChange,
  onBillChange,
}: ReturnDetailsProps) => {
  const { containerRef, onKeyDownCapture } = useFormSectionNavigation();

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isSales = mode === "sales";
  const partyId = isSales ? formData.customer_id : formData.supplier_id;
  const billId = isSales ? formData.sale_id : formData.purchase_id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-teal" />
          {isSales ? "Sales Return Details" : "Purchase Return Details"}
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={containerRef}
        onKeyDownCapture={onKeyDownCapture}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="return_no">Return No</Label>
            <Input
              id="return_no"
              value={formData.return_no}
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="return_date">Date</Label>
            <Input
              id="return_date"
              type="date"
              value={formData.return_date}
              onChange={(e) => handleChange("return_date", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{isSales ? "Customer" : "Supplier"}</Label>
            <SearchableSelect
              options={parties.map((party) => ({
                id: party.id,
                label: party.name,
              }))}
              value={partyId}
              onChange={onPartyChange}
              placeholder={isSales ? "Select customer" : "Select supplier"}
              searchPlaceholder={
                isSales ? "Search customers..." : "Search suppliers..."
              }
              emptyText={isSales ? "No customers found" : "No suppliers found"}
            />
          </div>

          <div className="space-y-2">
            <Label>
              {isSales ? "Sales Bill" : "Purchase Bill"}
              {!isSales && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              )}
            </Label>
            <SearchableSelect
              options={bills}
              value={billId}
              onChange={onBillChange}
              placeholder={
                !partyId
                  ? isSales
                    ? "Select a customer first"
                    : "Select a supplier first"
                  : billsLoading
                    ? "Loading bills..."
                    : isSales
                      ? "Search sales bills"
                      : "Search purchase bills (optional)"
              }
              searchPlaceholder="Search bills..."
              emptyText={
                partyId
                  ? isSales
                    ? "No bills found for this party"
                    : "No purchase bills found — you can still add custom rolls"
                  : "Select a party first"
              }
              disabled={!partyId || billsLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Enter any additional details"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ReturnDetails;
