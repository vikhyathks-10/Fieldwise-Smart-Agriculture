# Fieldwise – System Architecture

## 1. Overview

Fieldwise is a smart agricultural advisory and resource management application. It provides separate administrative and farmer-facing portals and uses a hybrid data architecture: MySQL for structured application records and MongoDB for weather observations.

## 2. High-level architecture

The application is organized into the following layers:

- **Frontend:** React with Vite. The user interface includes authentication, an Admin Portal, and a Farmer Portal.
- **API/backend:** Node.js and Express. The backend exposes API routes under `/api`, applies authentication and error-handling middleware, and coordinates application services.
- **Business layer:** Services contain application workflows and validation logic.
- **Data-access layer:** Repositories and query modules communicate with the databases.
- **Relational database:** MySQL stores structured agricultural and application data.
- **Document database:** MongoDB stores farmer weather-observation documents.

## 3. Request flow

1. A user interacts with the React application.
2. The frontend calls the backend through the API service.
3. Express routes direct the request to the relevant controller.
4. Middleware handles authentication and request processing where required.
5. Controllers invoke business services.
6. Services use repositories to read or update MySQL or MongoDB.
7. The API returns a response for the frontend to display.

## 4. Database responsibilities

### MySQL

MySQL is the primary relational database for structured records such as farmers, farms, locations, crops, cultivation, and other agricultural management data. SQL scripts in `database/` define database objects and supporting operations.

### MongoDB

MongoDB is used for weather observations. The backend uses Mongoose models and repository/service modules for observation operations. Weather-observation routes are protected by the farmer authentication flow and check farm ownership before accessing a farmer's observations.

## 5. Main source folders

| Folder | Responsibility |
|---|---|
| `src/` | React application, pages, components, styles, and API client |
| `backend/application/` | Express controllers, routes, and middleware |
| `backend/business/` | Business services and validators |
| `backend/data-access/` | Mongoose models, SQL queries, and repositories |
| `backend/database/` | Database environment configuration and connections |
| `backend/utils/` | Shared backend utilities |
| `database/` | SQL schema, constraints, indexes, views, routines, triggers, and queries |
| `demo/` | Demonstration SQL queries and query guide |
| `scripts/` | Administrative and verification scripts |
| `shared/` | Shared application schema or definitions |
| `tests/` | Automated tests |

## 6. Security considerations

- Keep real `.env` files out of version control.
- Use `.env.example` only for variable names and placeholder values.
- Do not commit database passwords, JWT secrets, or MongoDB connection strings.
- Protect farmer-specific operations with authentication and ownership checks.
- Configure CORS origins for the intended deployment environment.

## 7. Scope and limitations

This document describes the architecture represented by the current project source. It does not claim that the application is deployed to production or that agricultural recommendations have been independently validated.
