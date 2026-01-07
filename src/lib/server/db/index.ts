import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME } from '$env/static/private';

const poolConnection = mysql.createPool({
  host: DATABASE_HOST || 'localhost',
  port: parseInt(DATABASE_PORT || '3306'),
  user: DATABASE_USER || 'yakima',
  password: DATABASE_PASSWORD || '',
  database: DATABASE_NAME || 'yakima_events',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(poolConnection, { schema, mode: 'default' });

export * from './schema';
