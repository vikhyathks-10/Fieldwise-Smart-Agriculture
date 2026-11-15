# Fieldwise – Developer Setup Guide

## 1. Prerequisites

Install the following before running the project:

- Node.js (use a current LTS release)
- npm
- MySQL 8
- MongoDB Atlas account or a reachable MongoDB instance
- Git

You also need database credentials and a MongoDB connection string for your own development environment.

## 2. Get the source code

Clone the repository:

```bash
git clone https://github.com/vikhyathks-10/Fieldwise-Smart-Agriculture.git
cd Fieldwise-Smart-Agriculture
```

## 3. Install dependencies

The root `package.json` contains the frontend and backend dependencies:

```bash
npm install
```

## 4. Configure environment variables

Create a local `.env` file in the project root using `.env.example` as a reference. Fill in the values for your own environment.

Do not commit `.env`. Do not put real passwords, JWT secrets, or database connection strings in `.env.example`.

The backend loads environment configuration through `backend/database/config/env.js`. Check that file and the database connection modules to confirm the exact variable names expected by the current source before configuring the local `.env`.

## 5. Configure databases

### MySQL

1. Start MySQL.
2. Create/configure the database using the SQL scripts in `database/`.
3. Review the scripts and execute them in the intended sequence.
4. Configure the MySQL connection variables expected by `backend/database/connection/pool.js`.

### MongoDB

1. Make a MongoDB database available.
2. Configure the MongoDB connection string expected by `backend/database/connection/mongodb.js`.
3. Ensure the connection string is stored only in your local `.env`.

The project has used the MongoDB database `fieldwise_nosql` and collection `weather_observations`.

## 6. Run the application

Start the backend and frontend together:

```bash
npm start
```

Or run them separately in two terminals:

Terminal 1 – backend:

```bash
npm run server
```

Terminal 2 – frontend:

```bash
npm run dev
```

The backend defaults to port `4000`. The Vite development server commonly uses port `5173`. Confirm the actual frontend URL shown in your terminal and configure the backend CORS origin accordingly.

## 7. Run tests and build

Run the available Node.js test suite:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

## 8. Useful scripts

The root `package.json` also defines:

```bash
npm run verify:crud:rollback
npm run bootstrap:admin
```

Review each script before running it, especially scripts that create or modify database records.

## 9. Troubleshooting

- If MySQL connection fails, check that MySQL is running and the configured host, port, database, username, and password are correct.
- If MongoDB connection fails, check the URI, network access rules, and database user permissions.
- If browser API requests fail, verify the backend is running and the configured CORS origin matches the frontend origin.
- If dependencies are missing, run `npm install` from the repository root.
- Never resolve configuration problems by committing real credentials.

## 10. Security

Keep local `.env` files private. The repository should contain only placeholder configuration in `.env.example`.
