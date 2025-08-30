// src/config/db.config.ts
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iot_config',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool
export const pool = mysql.createPool(dbConfig);

// Test database connection
export const testDatabaseConnection = async (): Promise<void> => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully.');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

export default pool;