import mysql from 'mysql2/promise';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taskflask',
  port: parseInt(process.env.DB_PORT || '3306'),
  // Ensure client uses utf8mb4 for full Unicode support (emojis, etc.)
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
export const pool = mysql.createPool(dbConfig);

// Test database connection
pool.on('connection', () => {
  console.log('Connected to MySQL database');
});

// Handle connection errors
pool.on('connection', async (connection) => {
  try {
    // Explicitly set names/collation for this session
    await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  } catch (err) {
    console.error('Failed to set connection charset/collation', err);
  }
  connection.on('error', (err) => {
    console.error('Unexpected error on database connection', err);
  });
});

export default pool;
