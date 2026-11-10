import express from 'express';
import { getRollsByProduct, getRollDetails } from '../controllers/rollController';

const router = express.Router();

// Get rolls by product
router.get('/product/:productId', getRollsByProduct);

// Get roll details
router.get('/:rollId', getRollDetails);

export default router; 