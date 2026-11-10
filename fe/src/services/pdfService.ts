// import { jsPDF } from 'jspdf';
// import autoTable from 'jspdf-autotable';

// Correct plugin setup
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { format } from 'date-fns';
import { salesAPI } from './api';


// Declare the jsPDF types with autotable plugin
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

class PdfService {
  // Generate a sales invoice PDF
  async generateSalesInvoice(saleId: string): Promise<Blob> {
    try {
      // Fetch sale data
      const response = await salesAPI.getById(saleId);
      const sale = response;
      if (!sale) throw new Error('Sale not found');

      // Create new PDF document
      const doc = new jsPDF();
      // doc.autoTable({ head: [['Column 1', 'Column 2']], body: [['Data 1', 'Data 2']] });

      // Initialize autoTable
      // autoTable(doc, {});

      // Ensure autoTable is properly loaded
      if (typeof doc.autoTable !== 'function') {
        console.error('autoTable plugin not properly loaded');
        throw new Error('PDF generation failed: autoTable plugin not available');
      }

      const pageWidth = doc.internal.pageSize.width;

      // Add header
      doc.setFontSize(20);
      doc.text('SALES INVOICE', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.text('T. A. TEX', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(10);
      doc.text('ULHASNAGAR 421005', pageWidth / 2, 35, { align: 'center' });
      doc.text('Phone: +91 9876543210', pageWidth / 2, 40, { align: 'center' });

      // Add horizontal line
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(14, 45, pageWidth - 14, 45);

      // Invoice details
      doc.setFontSize(11);
      doc.text(`Invoice No: ${sale.sales_no || '-'}`, 14, 55);
      doc.text(`Date: ${format(new Date(sale.date), 'dd/MM/yyyy')}`, pageWidth - 14, 55, { align: 'right' });

      // Customer details
      doc.setFontSize(11);
      doc.text('Customer Details:', 14, 65);
      doc.text(`Name: ${sale.customer_name || '-'}`, 14, 71);
      const firmName = sale.customer?.description || sale.customer?.customer_description;
      const customerCity = sale.customer?.city || sale.customer?.customer_city;
      let customerDetailY = 77;
      if (firmName) {
        doc.text(`Firm: ${firmName}`, 14, customerDetailY);
        customerDetailY += 6;
      }
      if (customerCity) {
        doc.text(`City: ${customerCity}`, 14, customerDetailY);
      }

      // Invoice items table
      const tableColumn = ["S.No", "Product", "Roll No.", "Shade", "Qty", "Price", "Total"];
      const tableRows: any[] = [];

      // Add items to table
      sale.items.forEach((item: any, index: number) => {
        const tableRow = [
          index + 1,
          item.product_name || '-',
          item.roll_no || '-',
          item.shade || '-',
          `${item.meters.toFixed(2)}`,
          item.price.toFixed(2),
          (item.total ?? item.total_price).toFixed(2)
        ];
        tableRows.push(tableRow);
      });

      // Use try-catch specifically for autoTable to catch any issues
      try {
        doc.autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 90,
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          columnStyles: {
            0: { cellWidth: 10 },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' }
          },
          didDrawPage: (data) => {
            doc.text('Page ' + data.pageNumber, pageWidth - 20, doc.internal.pageSize.height - 10);
          }
        });
      } catch (tableError) {
        console.error('Error generating table:', tableError);
        throw new Error('Failed to generate PDF table: ' + tableError.message);
      }

      // Calculate the Y position after the table
      const finalY = (doc as any).lastAutoTable?.finalY + 10 || 120;

      // Summary section
      doc.setFontSize(10);
      doc.text(`Total Amount: ₹ ${sale.total.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' });

      // Additional details
      let additionalY = finalY + 15;
      if (sale.description) {
        doc.text(`Notes: ${sale.description}`, 14, additionalY);
        additionalY += 6;
      }

      // Footer
      doc.setFontSize(9);
      doc.text('Thank you for your business', pageWidth / 2, doc.internal.pageSize.height - 20, { align: 'center' });

      // Return the PDF as a Blob
      return new Blob([doc.output('blob')], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error generating sales invoice PDF:', error);
      throw error;
    }
  }

  // Helper method to format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }
}

export default new PdfService();
