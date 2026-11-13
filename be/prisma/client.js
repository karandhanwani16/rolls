require('dotenv').config();
const { applyDatabaseEnv } = require('../config/database');

applyDatabaseEnv();

const { PrismaClient } = require('@prisma/client');

// USB/SQLite interactive transactions often exceed Prisma's 5s default.
const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 15000,
    timeout: 60000,
  },
});

module.exports = prisma;
