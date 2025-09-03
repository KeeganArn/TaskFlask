import mysql from 'mysql2/promise';

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flowbit',
  port: parseInt(process.env.DB_PORT || '3306'),
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
pool.on('connection', (connection) => {
  connection.on('error', (err) => {
    console.error('Unexpected error on database connection', err);
  });
});

export default pool;
