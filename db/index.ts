/**
 * DEPRECATED: This TypeScript database client is NOT used in production
 * 
 * This file was intended for TanStack Start integration but the project
 * uses a standard Vite + Express architecture instead.
 * 
 * ACTUAL DATABASE SETUP: See api-server.js
 * 
 * The api-server.js file contains the actual database initialization
 * and schema that's used in production. This file can be removed if not
 * needed for development reference.
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

dotenv.config();

// Get connection string from environment variables
const connectionString = process.env.DATABASE_URL as string;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize the database connection")
}

// Create postgres client
const client = postgres(connectionString);

// Create drizzle database instance
export const db = drizzle(client, { schema });