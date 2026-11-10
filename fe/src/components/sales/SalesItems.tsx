import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package } from 'lucide-react';
import SalesItemRow from './SalesItemRow';
import BulkProductAdder from './BulkProductAdder';
import { useTableInputNavigation } from '@/lib/formKeyboardNavigation';

const ITEM_FIELDS = ['roll_no', 'shade', 'width', 'meters', 'price'];

interface SalesItemsProps {
    formData: any;
    setFormData: (data: any) => void;
    products: any[];
    handleItemChange: (index: number, field: string, value: any) => void;
    handleProductChange: (index: number, productId: string) => void;
    handleRollChange: (index: number, stockRollId: string) => void;
    addItem: () => void;
    removeItem: (index: number) => void;
    handleBulkAdd: (productId: string, count: number) => void;
    getAvailableRolls: (productId: string, index: number) => any[];
    onWidthBlur?: () => void;
    title?: string;
    defaultCustomRoll?: boolean;
}

const SalesItems = ({
    formData,
    setFormData,
    products,
    handleItemChange,
    handleProductChange,
    handleRollChange,
    addItem,
    removeItem,
    handleBulkAdd,
    getAvailableRolls,
    onWidthBlur,
    title = "Sale Items",
    defaultCustomRoll = false,
}: SalesItemsProps) => {
    const { setRef, createKeyDownHandler } = useTableInputNavigation({
        fields: ITEM_FIELDS,
        rowCount: formData.items.length,
        onAddRow: addItem,
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Package className="h-5 w-5 text-brand-teal" />
                    {title}
                </h2>
                <div>
                    <BulkProductAdder
                        products={products}
                        onAddBulk={handleBulkAdd}
                    />
                    <Button
                        type="button"
                        onClick={addItem}
                        variant="outline"
                        size="sm"
                        className="ml-4 border-brand-teal text-brand-teal hover:bg-teal-50"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                </div>
            </div>

            {formData.items.length === 0 ? (
                <Card className="shadow-sm border-dashed border-gray-300">
                    <CardContent className="flex flex-col justify-center items-center p-12 text-gray-500">
                        <Package className="h-12 w-12 text-gray-300 mb-3" />
                        <p>No items added yet</p>
                        <Button
                            type="button"
                            onClick={addItem}
                            variant="outline"
                            size="sm"
                            className="mt-4 border-brand-teal text-brand-teal hover:bg-teal-50"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add First Item
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shade</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Width</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {formData.items.map((item: any, index: number) => (
                                    <SalesItemRow
                                        key={item.sales_item_id || `new-${index}`}
                                        item={item}
                                        index={index}
                                        products={products}
                                        handleItemChange={handleItemChange}
                                        handleProductChange={handleProductChange}
                                        handleRollChange={handleRollChange}
                                        removeItem={removeItem}
                                        availableRolls={getAvailableRolls(item.product_id, index)}
                                        defaultCustomRoll={defaultCustomRoll}
                                        setRef={setRef}
                                        createKeyDownHandler={createKeyDownHandler}
                                        onWidthBlur={onWidthBlur}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesItems;
