# Fieldwise – Database Design and Implementation

## 1. Overview

Fieldwise uses two database technologies:

- **MySQL** for structured relational application and agricultural records.
- **MongoDB** for weather-observation documents.

The SQL implementation is organized as numbered scripts in the `database/` directory.

## 2. MySQL implementation

The SQL scripts cover the following areas:

| Script | Purpose |
|---|---|
| `01_create_database.sql` | Creates the application database |
| `02_create_tables.sql` | Creates relational tables |
| `03_constraints.sql` | Defines integrity constraints |
| `04_indexes.sql` | Adds indexes |
| `05_views.sql` | Defines views |
| `06_stored_procedures.sql` | Defines stored procedures |
| `07_functions.sql` | Defines stored functions |
| `08_triggers.sql` | Defines triggers |
| `09_sample_queries.sql` | Provides sample SQL queries |
| `10_auth_farmer_portal.sql` | Supports authentication and farmer-portal database changes |
| `11_*_migration.sql` and `12_*_migration.sql` | Apply additional database migrations |
| `11_*_recovery.sql` and `12_*_recovery.sql` | Provide corresponding recovery scripts |

Run scripts in the intended order and review migration/recovery scripts before executing them against an existing database. Take a database backup before applying schema changes to important data.

## 3. Relational database concepts demonstrated

The project SQL scripts and implementation cover relational database concepts including:

- DDL operations for database objects.
- DML operations for inserting, updating, and deleting records.
- DQL queries for retrieving data.
- Primary keys, foreign keys, and other constraints.
- Indexes and views.
- Joins, subqueries, set operations, and filtering.
- Stored procedures, functions, and triggers.
- Transaction control using commit and rollback.

The exact objects and definitions are maintained in the SQL files; consult those files as the source of truth.

## 4. MongoDB implementation

MongoDB stores weather observations in the `fieldwise_nosql` database, in the `weather_observations` collection.

The observation model includes fields for:

- `farmId`
- `temperature`
- `humidity`
- `rainfall`
- `windSpeed`
- `condition`
- `sensorReadings`
- `recordedAt`

Mongoose is used by the backend. The project includes a compound index on `{ farmId: 1, recordedAt: -1 }` to support farm-scoped, time-ordered observation retrieval.

## 5. Data access and ownership

The backend separates database access into repository modules and application workflows into services. Farmer weather-observation operations validate that the requested farm belongs to the authenticated farmer before accessing its MongoDB observations.

## 6. Database configuration

Connection settings are supplied through environment variables. Use `.env.example` as a template and provide your own local values in an untracked `.env` file. Never publish actual credentials.

## 7. Important note

Database names, table definitions, column types, constraints, and routine bodies should be verified against the SQL scripts and model files in this repository. This document is an overview, not a replacement for the executable database definitions.
