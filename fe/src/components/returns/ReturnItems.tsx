import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, X } from "lucide-react";
import { useCallback } from "react";
import { useTableInputNavigation } from "@/lib/formKeyboardNavigation";
import QuantityUnitSelect from "@/components/ui/quantity-unit-select";
import { DEFAULT_QUANTITY_UNIT, formatQuantity } from "@/lib/quantityUnits";

interface ReturnItemsProps {
  mode: "sales" | "purchase";
  formData: any;
  products: any[];
  handleItemChange: (index: number, field: string, value: any) => void;
  handleProductChange: (index: number, productId: string) => void;
  addCustomItem?: () => void;
  removeItem: (index: number) => void;
}

const ReturnItems = ({
  mode,
  formData,
  products,
  handleItemChange,
  handleProductChange,
  addCustomItem,
  removeItem,
}: ReturnItemsProps) => {
  const isPurchase = mode === "purchase";
  const hasBill = isPurchase ? formData.purchase_id : formData.sale_id;
  const hasParty = isPurchase ? formData.supplier_id : formData.customer_id;
  const canAddCustom = isPurchase && Boolean(hasParty);

  const getFieldsForRow = useCallback(
    (rowIndex: number) => {
      const item = formData.items[rowIndex];
      return item?.is_custom ? ["roll_no", "meters", "price"] : ["meters", "price"];
    },
    [formData.items]
  );

  const { setRef, createKeyDownHandler } = useTableInputNavigation({
    fields: ["roll_no", "meters", "price"],
    rowCount: formData.items.length,
    getFieldsForRow,
  });

  const emptyMessage = () => {
    if (!hasParty) {
      return isPurchase
        ? "Select a supplier to add returned rolls"
        : "Select a customer and sales bill to load rolls";
    }
    if (isPurchase && !hasBill) {
      return "Add custom rolls to return, or select a purchase bill to load its rolls";
    }
    if (hasBill) {
      return "This bill has no rolls";
    }
    return `Select a ${isPurchase ? "supplier and purchase bill" : "customer and sales bill"} to load rolls`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="h-5 w-5 text-brand-teal" />
          Returned Rolls
        </h2>
        {canAddCustom && addCustomItem && (
          <Button
            type="button"
            onClick={addCustomItem}
            variant="outline"
            size="sm"
            className="border-brand-teal text-brand-teal hover:bg-teal-50"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Custom Roll
          </Button>
        )}
      </div>

      {formData.items.length === 0 ? (
        <Card className="shadow-sm border-dashed border-gray-300">
          <CardContent className="flex flex-col justify-center items-center p-12 text-gray-500">
            <Package className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-center max-w-md">{emptyMessage()}</p>
            {canAddCustom && addCustomItem && (
              <Button
                type="button"
                onClick={addCustomItem}
                variant="outline"
                size="sm"
                className="mt-4 border-brand-teal text-brand-teal hover:bg-teal-50"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Custom Roll
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bill Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Returned Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price/Meter
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  {isPurchase && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.items.map((item: any, index: number) => {
                  const isCustom = Boolean(item.is_custom);
                  return (
                    <tr key={item.row_key || `${item.purchase_item_id || "custom"}-${index}`}>
                      <td className="px-4 py-3">
                        {isCustom ? (
                          <Select
                            value={item.product_id}
                            onValueChange={(value) => handleProductChange(index, value)}
                          >
                            <SelectTrigger className="w-full min-w-[180px]">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="font-medium text-gray-800">
                            {item.product_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isCustom ? (
                          <div className="space-y-1">
                            <Input
                              type="text"
                              ref={setRef("roll_no", index)}
                              value={item.roll_no || ""}
                              onChange={(e) =>
                                handleItemChange(index, "roll_no", e.target.value)
                              }
                              onKeyDown={createKeyDownHandler(index, "roll_no")}
                              placeholder="Custom roll no"
                              disabled={!item.product_id}
                            />
                            <Badge variant="outline" className="text-xs">
                              Custom
                            </Badge>
                          </div>
                        ) : (
                          <span className="font-medium">{item.roll_no || "-"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {isCustom
                          ? "—"
                          : formatQuantity(item.original_meters || 0, item.unit)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CurrencyInput
                            ref={setRef("meters", index)}
                            value={item.meters ?? 0}
                            onChange={(n) =>
                              handleItemChange(index, "meters", n || 0)
                            }
                            onKeyDown={createKeyDownHandler(index, "meters")}
                            placeholder="0"
                            className="min-w-[90px]"
                          />
                          <QuantityUnitSelect
                            value={item.unit || DEFAULT_QUANTITY_UNIT}
                            onChange={(unit) => handleItemChange(index, "unit", unit)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyInput
                          ref={setRef("price", index)}
                          value={item.price ?? 0}
                          onChange={(n) =>
                            handleItemChange(index, "price", n || 0)
                          }
                          onKeyDown={createKeyDownHandler(index, "price")}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <CurrencyInput
                          value={item.total_price || 0}
                          readOnly
                          className="bg-gray-50"
                        />
                      </td>
                      {isPurchase && (
                        <td className="px-4 py-3 text-right">
                          {isCustom ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnItems;
