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