import { salesAPI } from "@/services/api";

export type SaleDocumentType = "bill" | "challan";

export type PrintSaleDocumentOptions = {
  showInterestNote?: boolean;
};

/**
 * Opens the challan/sales bill HTML in a new window and shows the browser print dialog.
 */
export async function printSaleDocument(
  id: string,
  _salesNo: string,
  type: SaleDocumentType,
  options: PrintSaleDocumentOptions = {}
) {
  const htmlResponse = await salesAPI.getInvoiceHTML(id, type, {
    showInterestNote: options.showInterestNote,
  });
  if (!htmlResponse.success || !htmlResponse.data) {
    throw new Error("Failed to get document HTML");
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Please allow popups to print the document");
  }

  printWindow.document.open();
  printWindow.document.write(htmlResponse.data);
  printWindow.document.close();

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    if (printWindow.document.readyState === "complete") {
      done();
      return;
    }
    printWindow.onload = done;
    // Fallback if onload does not fire
    setTimeout(done, 500);
  });

  // Let layout settle before opening the print dialog
  await new Promise((resolve) => setTimeout(resolve, 200));

  printWindow.focus();
  printWindow.print();
}

/** @deprecated use printSaleDocument */
export const downloadSalePdf = printSaleDocument;
