const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'nms',
    user:     process.env.DB_USER     || 'nms',
    password: process.env.DB_PASS     || 'nms_secret',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err.message);
});

module.exports = pool;
