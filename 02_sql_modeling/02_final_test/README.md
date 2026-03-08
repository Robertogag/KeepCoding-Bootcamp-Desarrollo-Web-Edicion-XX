# Final Test - SQL Modeling

![ERD Preview](00_images/Modeling_and_SQL.drawio.png)

## Project overview

This project implements a normalized relational database for a video club system.

The model supports:
- member registration
- optional correspondence address registration
- movie registration
- multiple physical copies of the same movie
- rental tracking by member and copy
- availability queries for currently rentable movies

## Source data

The source data used for the inserts is stored in:

- `03_data/videoclub.xlsx`

The Excel file was reviewed and transformed into a normalized relational structure before generating the final insert script.

## Database setup

- **Database name:** `keepcoding_web_xx`
- **Schema name:** `videoclub`

## Main tables

- `document_type`
- `member`
- `member_address`
- `genre`
- `director`
- `movie`
- `movie_copy`
- `rental`

## Modeling decisions

### Member and address
The address is stored in a separate table because it is optional according to the requirements.

### Movie and copy
A movie represents the title itself.
A movie copy represents each physical copy available in the video club.

### Rental
The rental table stores:
- which copy was rented
- which member rented it
- rental date
- return date

When `return_date` is `NULL`, the copy is considered currently rented.

## Folder structure

- `00_images/`: images used in the documentation
- `01_ERD/`: entity relationship diagram files
- `02_SQL_scripts/`: SQL scripts
- `03_data/`: source Excel file

## SQL scripts

Inside `02_SQL_scripts/`:

- `00_create_database.sql`
- `01_create_tables.sql`
- `02_insert_data_from_excel.sql`
- `03_test_queries.sql`
- `00_full_script.sql`

## Execution steps

### 1. Create the database
Connect to PostgreSQL using the default database, usually `postgres`, and run:

- `02_SQL_scripts/00_create_database.sql`

### 2. Reconnect
Open a connection to:

- `keepcoding_web_xx`

### 3. Run the full script
Execute:

- `02_SQL_scripts/00_full_script.sql`

This script:
- creates the schema
- creates all tables
- inserts the transformed data from the Excel file
- runs the validation queries

## Optional execution by parts

If needed, the scripts can be executed in this order:

1. `01_create_tables.sql`
2. `02_insert_data_from_excel.sql`
3. `03_test_queries.sql`

## Validation queries

The final queries were designed according to the functional requirements and validate:

1. registered members
2. members and optional address data
3. movie catalog with title, genre, director, and synopsis
4. rental records by member and movie copy
5. movies currently available and number of available copies

## Expected result

After execution, the database should allow you to:
- review members
- review optional address data
- inspect the movie catalog
- check rental history
- identify available movies and available copies
