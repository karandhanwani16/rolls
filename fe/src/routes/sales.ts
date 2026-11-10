import express from 'express';
import { getNextSalesNumber } from '../controllers/salesNumberController';

const router = express.Router();

// ... existing routes ...

// Get next sales number
router.get('/next-number', getNextSalesNumber);

export default router; 