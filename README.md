Fieldwise -- Smart Agricultural Advisory and Resource Management System

A full-stack agricultural management application that brings together
farmer and farm records, cultivation information, weather data, and
administrative workflows through dedicated Admin and Farmer portals.

Team Members

  Name                     SRN



  Vikhyath Bharadwaj K S   PES2UG24CS586
  Yaseen Mulla             PES2UG24CS607

Project Overview

Fieldwise is designed to support the management of agricultural
information through a web-based application. It provides separate
interfaces for administrators and farmers, uses MySQL for structured
relational data, and integrates MongoDB for weather observations.

The project demonstrates the use of relational database concepts
alongside a document-oriented NoSQL database in a full-stack
application.

Key Features





Admin Portal: Interface for managing and viewing agricultural
records.



Farmer Portal: Farmer-facing dashboard and farm-related
information.



Authentication: Login and role-based access flows for the
portals.



Farm and cultivation management: Access to farm and cultivation
records.



Weather information: Displays relational weather information and
MongoDB weather observations.



Weather observation operations: Backend routes support creating,
viewing, updating, and deleting farmer weather observations, with
farm ownership checks.



Database implementation: SQL scripts for tables, constraints,
indexes, views, stored procedures, functions, triggers, and sample
queries.



Testing utilities: Automated tests and scripts for selected
application and database workflows.



Technology Stack

  Area                                Technologies



  Frontend                            React, Vite, JavaScript, CSS
  Backend                             Node.js, Express
  Relational database                 MySQL
  NoSQL database                      MongoDB, Mongoose
  API communication                   Axios
  Authentication/security libraries   bcryptjs, JWT utilities, CORS
  Testing                             Node.js test runner

Repository Structure

Fieldwise-Smart-Agriculture/
├── backend/
│   ├── application/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── routes/
│   ├── business/
│   │   ├── services/
│   │   └── validators/
│   ├── data-access/
│   │   ├── models/
│   │   ├── queries/
│   │   └── repositories/
│   ├── database/
│   │   ├── config/
│   │   └── connection/
│   ├── utils/
│   └── server.js
├── database/       # MySQL schema, routines, triggers, migrations and queries
├── demo/           # Demonstration SQL queries and guide
├── docs/           # Architecture, database and setup documentation
├── scripts/        # Administrative and verification scripts
├── shared/         # Shared schema definitions
├── src/            # React frontend
├── tests/          # Automated tests
├── package.json
└── vite.config.js



Prerequisites

Install the following tools before running the project:





Node.js and npm



MySQL 8



A MongoDB instance or MongoDB Atlas account



Git



Setup and Installation



1. Clone the repository

git clone https://github.com/vikhyathks-10/Fieldwise-Smart-Agriculture.git
cd Fieldwise-Smart-Agriculture



2. Install dependencies

Frontend and backend dependencies are declared in the root
package.json.

npm install



3. Configure environment variables

Create a local .env file in the project root, using .env.example as
a reference.

Configure the values required by your local environment, including:





Application port and frontend CORS origin



MySQL host, port, username, password, and database name



JWT secret



MongoDB connection URI

Use your own credentials. Never commit the real .env file or publish
database passwords, tokens, or connection strings.

4. Configure the databases

MySQL





Start your MySQL server.



Review the SQL files in database/.



Create and configure the database by executing the scripts in their

intended order.



Check the scripts before applying migrations to an existing

database, and take a backup first.

MongoDB





Make a MongoDB instance available.



Configure the MongoDB connection URI in your local environment.



Ensure the database user and network access settings permit the

application to connect.

The application uses MongoDB for weather observations. The project
documentation and backend model describe the observation fields and
data-access implementation.

5. Run the application

Start the backend and frontend together:

npm start

Or start them separately in two terminals:

Terminal 1 -- Backend

npm run server

Terminal 2 -- Frontend

npm run dev

The backend defaults to port 4000. Vite normally serves the frontend
at http://localhost:5173; use the actual address printed by the
development server.

Testing and Build

Run the automated tests:

npm test

Build the frontend:

npm run build

Additional project scripts are available in package.json, including:

npm run verify:crud:rollback
npm run bootstrap:admin

Review scripts and understand their database effects before running them
against important data.

Database Concepts Demonstrated

The SQL implementation includes examples of:





Data Definition Language (DDL)



Data Manipulation Language (DML)



Data Query Language (DQL)



Primary and foreign keys and integrity constraints



Indexes and views



Joins, subqueries, and set operations



Stored procedures and functions



Triggers



Transaction control

The MongoDB integration demonstrates document storage and farm-scoped
weather-observation operations. Refer to the SQL scripts and backend
source for the exact implementation.

Documentation

Additional project documentation is available in the docs/ directory:





ARCHITECTURE.md -- application architecture and request flow



DATABASE.md -- relational and NoSQL database overview



SETUP.md -- developer setup instructions



Security Notes





Keep .env files private and out of Git.



Commit only placeholder values in .env.example.



Do not publish passwords, API keys, JWT secrets, or database
connection strings.



Use appropriate database permissions and configure CORS for the
intended environment.



Project Repository

Fieldwise -- Smart Agricultural Advisory and Resource Management
System



Academic Project
Developed by Vikhyath Bharadwaj K S and Yaseen Mulla.
