-- Database Initialization Script for Docker Compose
-- This script runs automatically when PostgreSQL container is first created
-- It creates the database and user if they don't exist

-- Note: This file is referenced in docker-compose.yml for automatic setup
-- For manual setup, run the schema.sql file instead

-- The database and user are typically created by environment variables in docker-compose.yml
-- This file can be used for additional initialization if needed

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- This script is intentionally minimal as the main schema is in schema.sql
-- and applied via migrations
