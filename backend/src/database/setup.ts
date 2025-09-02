import { Pool } from 'pg';

// Database setup configuration
const setupConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default postgres database first
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
};

const setupDatabase = async () => {
  console.log('Setting up database...');
  
  // Connect to default postgres database
  const pool = new Pool(setupConfig);
  
  try {
    // Create the flowbit database if it doesn't exist
    await pool.query(`
      SELECT 'CREATE DATABASE flowbit'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'flowbit')
    `);
    
    console.log('Database setup completed');
    console.log('Next steps:');
    console.log('   1. Run your schema.sql file to create tables');
    console.log('   2. Set up environment variables in .env file');
    console.log('   3. Start your application');
    
  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

export default setupDatabase;
