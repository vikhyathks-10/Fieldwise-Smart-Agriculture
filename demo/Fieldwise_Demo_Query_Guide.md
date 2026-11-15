# Fieldwise MySQL Demonstration Query Guide

This guide accompanies [`Fieldwise_Demo_Queries.sql`](Fieldwise_Demo_Queries.sql). The queries use the schema and objects defined by the project's database scripts. The scripts select `smartagriculturedb`, which is the schema name used by the checked-in SQL. Use the matching spelling configured for your MySQL installation.

Queries 1–9 and 12 are read-only apart from session variables used to select real IDs for the procedure/function examples. Query 10 inserts a uniquely named temporary Farmer so the trigger can fire, checks the audit row, and rolls both rows back. Run the **entire Query 10 block at once** through its final `ROLLBACK`. Query 11 temporarily updates an existing Farm and rolls the update back. Neither transaction is intended to leave a data change.

## Query 1 — Basic Farmer Details

- **Concept:** `SELECT`, `WHERE`, `ORDER BY`.
- **Tables:** `Farmer`.
- **What to say:** “I am selecting the farmer columns, filtering out rows without a name, and sorting alphabetically by name. Farmer ID is the second sort key so equal names are stable.”
- **What the output proves:** The query returns actual Farmer table rows and supports filtering and ordering.
- **Expected output:** One row per farmer whose `Name` is not `NULL`, including contact and address columns.

## Query 2 — Farmer and Farm Details

- **Concept:** `INNER JOIN` using the Farmer primary key and Farm foreign key.
- **Tables:** `Farmer`, `Farm` (`Farm.Farmer_ID` references `Farmer.Farmer_ID`).
- **What to say:** “The join matches every farm to its owning farmer by Farmer_ID. An inner join returns only matching farmer/farm pairs.”
- **What the output proves:** Relational data from two tables can be combined through their key relationship.
- **Expected output:** One row for each farm that has a matching farmer, with owner, farm name, area, and soil type.

## Query 3 — Farmer, Farm and Location

- **Concept:** Multiple-table join; `INNER JOIN` and `LEFT JOIN`.
- **Tables:** `Farmer`, `Farm`, `Location` (`Farm.Location_ID` references `Location.Location_ID`).
- **What to say:** “The inner join requires an owner for each farm. The left join keeps the farm even if its optional location has not been recorded.”
- **What the output proves:** The schema can combine farmer, farm, and location fields while preserving farms with no matching location.
- **Expected output:** One row per farm; location fields may be `NULL`.

## Query 4 — Totals and Cultivated Farm Area

- **Concept:** `COUNT`, `SUM`, `COALESCE`, scalar subqueries, and correlated `EXISTS`.
- **Tables:** `Farmer`, `Farm`, `Cultivation`.
- **What to say:** “The scalar queries count farmers and farms. The area total adds each farm once if at least one Cultivation row exists; `EXISTS` prevents multiple crop cycles from multiplying the farm area.”
- **What the output proves:** Aggregate summaries can be calculated in SQL, including an existence-based filter across related tables.
- **Expected output:** A single row with farmer count, farm count, and total area of farms having at least one cultivation record. The area uses the units stored in `Farm.Area`.

## Query 5 — Farm Count by Farmer

- **Concept:** `INNER JOIN`, `GROUP BY`, `HAVING`, `COUNT`, and `SUM`.
- **Tables:** `Farmer`, `Farm`.
- **What to say:** “I group the joined rows by farmer, count their farms, and use `HAVING` to filter groups after aggregation.”
- **What the output proves:** `GROUP BY` forms a summary per farmer, and `HAVING` filters the grouped result.
- **Expected output:** One row for each farmer with at least one farm, showing count and total area.

## Query 6 — Farmers Above Average Farm Area

- **Concept:** Aggregate `SUM`, `AVG`, grouped results, and a subquery in `HAVING`.
- **Tables:** `Farmer`, `Farm`.
- **What to say:** “The outer query totals farm area per farmer. The subquery calculates the average area of one farm. `HAVING` returns farmers whose combined area is greater than that database-wide average.”
- **What the output proves:** A subquery result can be used to filter grouped aggregate results.
- **Expected output:** Farmers whose total area exceeds the average area of one Farm row. The farmer total and comparison average are both displayed.

## Query 7 — Farmer/Farm Summary View

- **Concept:** Selecting from a database view.
- **Tables:** `Farmer_Farm_Summary` view; internally uses `Farmer`, `Farm`, and `Location`.
- **What to say:** “This reads the reusable Farmer_Farm_Summary view. The view joins related tables and uses left joins so farmers without farms are retained.”
- **What the output proves:** The view is a database object that packages a useful relational query for reuse.
- **Expected output:** Farmer, farm, and location summary rows. A farmer without a farm may have `NULL` farm fields.
- **Setup note:** Run `database/05_views.sql` before the demonstration if the view is not installed.

## Query 8 — GetFarmerDetails Procedure

- **Concept:** Calling a stored procedure with a parameter selected from existing data.
- **Tables:** `Farmer`; procedure `GetFarmerDetails`.
- **What to say:** “The session variable gets an existing Farmer_ID, then `CALL` passes it to the stored procedure. The procedure executes its SELECT in MySQL.”
- **What the output proves:** Stored logic is installed and can be invoked with a real database value.
- **Expected output:** Farmer details for the selected farmer. If Farmer is empty, the procedure returns no matching rows rather than inventing an ID.
- **Setup note:** Run `database/06_stored_procedures.sql` on a fresh schema before this query. Do not rerun it over existing routine names; inspect them first.

## Query 9 — GetTotalFarmArea Function

- **Concept:** Calling a user-defined scalar function in a `SELECT` statement.
- **Tables:** `Farmer`, `Farm`; function `GetTotalFarmArea`.
- **What to say:** “I select an existing farmer ID and pass it to the function. The function sums that farmer's farm areas and returns zero if there are no matching farms.”
- **What the output proves:** A database function can return an aggregate value for an input parameter.
- **Expected output:** One row containing the chosen Farmer_ID and the function result.
- **Setup note:** Run `database/07_functions.sql` on a fresh schema before this query. Do not rerun over an existing function name without checking it.

## Query 10 — AFTER INSERT Trigger and Audit (Rollback)

- **Concept:** Trigger event, audit table, transaction, `ROLLBACK`.
- **Tables:** `Farmer`, `Farmer_Audit`; trigger `AfterFarmerInsert`.
- **What to say:** “I start a transaction, choose an integer candidate ID, check it, and insert only if it remains unused. The AFTER INSERT trigger writes the matching audit event. I then roll back, which removes both test rows because both tables use InnoDB.”
- **What the output proves:** A matching audit row before rollback demonstrates that the trigger responded to the INSERT. The final two zero counts show the temporary Farmer and audit rows are gone after rollback.
- **Expected output:** A candidate ID check, then one matching `INSERT` audit row if the trigger is installed and the candidate was unused, then zero remaining temporary rows after rollback. If the random candidate was already taken, the guarded insert adds no row; execute the entire block again to generate another candidate.
- **Safety:** Run the entire block in `Fieldwise_Demo_Queries.sql` at once through `ROLLBACK`; do not execute only part of it. The candidate is guarded by `NOT EXISTS` and the primary key protects against a concurrent collision. On a collision, roll back the open transaction.
- **Setup note:** Run `database/08_triggers.sql` on a fresh schema before this query. Confirm `Farmer` and `Farmer_Audit` are InnoDB. The trigger logs Farmer INSERT only. A rollback can consume an `AUTO_INCREMENT` value, leaving an ID gap; it does not preserve the test audit row.

## Query 11 — Update Inside a Transaction, Then Roll Back

- **Concept:** `START TRANSACTION`, `UPDATE`, reading an uncommitted change, and `ROLLBACK`.
- **Tables:** `Farm`.
- **What to say:** “I select an existing farm, display its original area, add 0.01 inside a transaction, and read the temporary value. `ROLLBACK` restores the original stored value, which I display at the end.”
- **What the output proves:** The transaction can see its own update before rollback, and rollback prevents that demonstration change from being saved.
- **Expected output:** Before, inside, and after values. For a non-NULL area, the inside value is 0.01 higher and after rollback it matches the before value. If there are no Farm rows, the selects return no rows and no farm is updated.
- **Safety:** Execute the block through `ROLLBACK`. Do not replace `ROLLBACK` with `COMMIT`.

## Query 12 — Farm Cultivation, Fertilizer and Soil Analytics

- **Concept:** Multiple joins, derived tables, `GROUP BY`, `COUNT`, `SUM`, `AVG`, `GROUP_CONCAT`, and `COALESCE`.
- **Tables:** `Farmer`, `Farm`, `Cultivation`, `Crop`, `Fertilizer_Usage`, `Soil_Test`.
- **What to say:** “The derived queries summarize cultivation/crops, fertilizer use, and soil tests separately per farm. I left-join those summaries back to each farm so one-to-many relationships do not multiply the totals.”
- **What the output proves:** SQL can combine agricultural activity and analytics into one row per farm while retaining farms without optional activity.
- **Expected output:** One row per farm with cultivation count and crop names, fertilizer usage count and total quantity, soil test count, and average pH. Empty categories show zero counts/quantities or `NULL` descriptive values.

## Validation status

The query file was checked statically against `database/02_create_tables.sql` through `08_triggers.sql`, the existing sample query script, and the project's schema definitions. The available SQL definitions confirm the names and relationships used above. Live MySQL inspection and query execution were not possible in this session because the sandbox denied connections to `127.0.0.1:3306` with `EACCES`. Therefore none of the 12 queries is claimed as executed successfully here. Run them in MySQL Workbench against the configured database and confirm the routines/view/trigger exist first.

No database schema was changed and no persistent demonstration records were added.
