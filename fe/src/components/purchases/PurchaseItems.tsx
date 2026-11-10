import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package } from 'lucide-react';
import PurchaseItemRow from './PurchaseItemRow';
import BulkProductAdder from './BulkProductAdder';
import { useTableInputNavigation } from '@/lib/formKeyboardNavigation';

interface PurchaseItemsProps {
    formData: any;
    setFormData: (data: any) => void;
    products: any[];
    handleItemChange: (index: number, field: string, value: any) => void;
    handleProductChange: (index: number, productId: string) => void;
    addItem: () => void;
    removeItem: (index: number) => void;
    handleBulkAdd: (productId: string, count: number) => void;
}

const ITEM_FIELDS = ['roll_no', 'shade', 'width', 'meters', 'price'];

const PurchaseItems = ({
    formData,
    setFormData,
    products,
    handleItemChange,
    handleProductChange,
    addItem,
    removeItem,
    handleBulkAdd,
}: PurchaseItemsProps) => {
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
                    Purchase Items
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
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Package className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">No items added yet</p>
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
                            <tbody>
                                {formData.items.map((item: any, index: number) => (
                                    <PurchaseItemRow
                                        key={index}
                                        item={item}
                                        index={index}
                                        products={products}
                                        handleItemChange={handleItemChange}
                                        handleProductChange={handleProductChange}
                                        removeItem={removeItem}
                                        setRef={setRef}
                                        createKeyDownHandler={createKeyDownHandler}
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

export default PurchaseItems;
