import { Request, Response } from 'express';
import { prisma } from '../prisma';

export const getRollsByProduct = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        
        const rolls = await prisma.roll.findMany({
            where: {
                product_id: productId,
                available_meters: {
                    gt: 0
                }
            },
            select: {
                id: true,
                roll_no: true,
                available_meters: true,
                product: {
                    select: {
                        name: true,
                        price: true
                    }
                }
            },
            orderBy: {
                roll_no: 'asc'
            }
        });

        res.json(rolls);
    } catch (error) {
        console.error('Error fetching rolls:', error);
        res.status(500).json({ error: 'Failed to fetch rolls' });
    }
};

export const getRollDetails = async (req: Request, res: Response) => {
    try {
        const { rollId } = req.params;
        
        const roll = await prisma.roll.findUnique({
            where: {
                id: rollId
            },
            select: {
                id: true,
                roll_no: true,
                available_meters: true,
                product: {
                    select: {
                        name: true,
                        price: true
                    }
                }
            }
        });

        if (!roll) {
            return res.status(404).json({ error: 'Roll not found' });
        }

        res.json(roll);
    } catch (error) {
        console.error('Error fetching roll details:', error);
        res.status(500).json({ error: 'Failed to fetch roll details' });
    }
}; 