import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { DEFAULT_QUANTITY_UNIT, getUnitMeta } from "@/lib/quantityUnits";

interface PurchaseItemRowProps {
  item: any;
  index: number;
  products: any[];
  handleItemChange: (index: number, field: string, value: any) => void;
  handleProductChange: (index: number, productId: string) => void;
  removeItem: (index: number) => void;
  setRef: (field: string, index: number) => (element: HTMLInputElement | null) => void;
  createKeyDownHandler: (
    index: number,
    field: string
  ) => (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const PurchaseItemRow = ({
  item,
  index,
  products,
  handleItemChange,
  handleProductChange,
  removeItem,
  setRef,
  createKeyDownHandler,
}: PurchaseItemRowProps) => {
  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    field: string
  ) => {
    createKeyDownHandler(index, field)(e);
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <Select
          value={item.product_id}
          onValueChange={(value) => handleProductChange(index, value)}
        >
          <SelectTrigger className="w-full focus:ring-brand-teal">
            <SelectValue placeholder="Select product..." />
          </SelectTrigger>
          <SelectContent>
            {products && Array.isArray(products) && products.length > 0 ? (
              products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No products available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Input
          ref={setRef("roll_no", index)}
          value={item.roll_no}
          onChange={(e) => handleItemChange(index, "roll_no", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "roll_no")}
          placeholder="Enter roll number"
          className="focus-visible:ring-brand-teal"
          required
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Input
          ref={setRef("shade", index)}
          value={item.shade || ""}
          onChange={(e) => handleItemChange(index, "shade", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "shade")}
          placeholder="Shade no."
          className="focus-visible:ring-brand-teal"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <Input
          ref={setRef("width", index)}
          value={item.width || ""}
          onChange={(e) => handleItemChange(index, "width", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "width")}
          placeholder="Width"
          className="focus-visible:ring-brand-teal min-w-[80px]"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <CurrencyInput
            ref={setRef("meters", index)}
            value={item.meters}
            onChange={(n) => handleItemChange(index, "meters", n || 0)}
            onKeyDown={(e) => handleKeyDown(e, "meters")}
            placeholder="0.00"
            className="focus-visible:ring-brand-teal min-w-[90px]"
            required
          />
          <span className="text-sm text-muted-foreground min-w-[2rem]">
            {getUnitMeta(item.unit || DEFAULT_QUANTITY_UNIT).abbr}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <CurrencyInput
          ref={setRef("price", index)}
          value={item.price}
          onChange={(n) => handleItemChange(index, "price", n || 0)}
          onKeyDown={(e) => handleKeyDown(e, "price")}
          placeholder="0.00"
          className="focus-visible:ring-brand-teal"
          required
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <CurrencyInput
          value={item?.total_price}
          readOnly
          className="bg-gray-50 font-medium text-brand-teal"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <Button
          type="button"
          onClick={() => removeItem(index)}
          variant="ghost"
          size="sm"
          className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
};

export default PurchaseItemRow;
