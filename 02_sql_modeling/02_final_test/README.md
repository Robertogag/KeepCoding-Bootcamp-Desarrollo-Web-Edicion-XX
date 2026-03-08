# Final Test - SQL Modeling

![ERD diagram](00_images/Modeling_and_SQL.drawio.png)

## Context

The practice is based on a video club that needs a database to manage members, movie inventory and rentals.

## Objective

Design a normalized relational model and implement it in SQL for PostgreSQL.

The solution must allow:

- registering video club members
- storing an optional correspondence address for members
- registering movies
- registering multiple copies of the same movie
- storing which member rented each copy and on what date
- identifying which movies are currently available and how many copies are available

## Deliverables

This practice includes:

- the entity-relationship diagram in draw.io format
- the SQL scripts needed to create and load the database

## Project structure

- `00_images/`: documentation images
- `01_ERD/`: ER diagram files
- `02_SQL_scripts/`: SQL scripts
- `03_data/`: source Excel file used as test data

## Main script

If you want to run everything at once, execute:

- `02_SQL_scripts/00_full_script.sql`

## Optional execution by parts

If you prefer to run the project step by step, execute:

1. `02_SQL_scripts/00_create_database.sql`
2. reconnect to database `keepcoding_web_xx`
3. `02_SQL_scripts/01_create_tables.sql`
4. `02_SQL_scripts/02_insert_data_from_excel.sql`
5. `02_SQL_scripts/03_test_queries.sql`

## Notes

- Database name: `keepcoding_web_xx`
- Schema name: `videoclub`
- The data load was generated from `03_data/videoclub.xlsx`
- The SQL script was prepared to run without errors in sequence
