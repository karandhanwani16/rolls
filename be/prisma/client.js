require('dotenv').config();
const { applyDatabaseEnv } = require('../config/database');

applyDatabaseEnv();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
