import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { format } from 'date-fns';

export const getNextSalesNumber = async (req: Request, res: Response) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const saleDate = new Date(date as string);
        const financialYear = getFinancialYear(saleDate);
        
        // Get the last sale number for this financial year
        const lastSale = await prisma.sale.findFirst({
            where: {
                date: {
                    gte: new Date(financialYear.start),
                    lte: new Date(financialYear.end)
                }
            },
            orderBy: {
                sales_no: 'desc'
            }
        });

        let nextNumber = 1;
        if (lastSale) {
            // Extract the number from the last sales_no (format: FY23-24/001)
            const lastNumber = parseInt(lastSale.sales_no.split('/')[1]);
            nextNumber = lastNumber + 1;
        }

        // Format: FY23-24/001
        const salesNo = `FY${financialYear.start.getFullYear().toString().slice(-2)}-${financialYear.end.getFullYear().toString().slice(-2)}/${nextNumber.toString().padStart(3, '0')}`;

        res.json({ sales_no: salesNo });
    } catch (error) {
        console.error('Error generating sales number:', error);
        res.status(500).json({ error: 'Failed to generate sales number' });
    }
};

function getFinancialYear(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Financial year starts from April (month 3)
    if (month >= 3) {
        return {
            start: new Date(year, 3, 1), // April 1st
            end: new Date(year + 1, 2, 31) // March 31st next year
        };
    } else {
        return {
            start: new Date(year - 1, 3, 1), // April 1st previous year
            end: new Date(year, 2, 31) // March 31st current year
        };
    }
} 