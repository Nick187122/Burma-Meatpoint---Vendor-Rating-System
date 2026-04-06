# Burma Meat Point Database setup

This directory contains standalone SQL scripts to initialize the PostgreSQL database for the Burma Meat Point Vendor Rating System.

## Using `psql`

1. Open a terminal and connect to your PostgreSQL instance:
```bash
psql -U postgres
```

2. Create the database if it doesn't exist:
```sql
CREATE DATABASE burmameat;
\c burmameat
```

3. Run the schema script to create all tables:
```bash
psql -U postgres -d burmameat -f schema.sql
```

4. Optional: If you want to load the initial sample data and accounts:
```bash
psql -U postgres -d burmameat -f seed.sql
```

## Note for Django
If you prefer Django ORM to handle database creation, run:
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```
This is generally preferred unless you need the raw SQL constraints and manual importing logic provided by these scripts.

## PostgreSQL runtime configuration

To run the Django app against PostgreSQL instead of SQLite:

1. Update `backend/.env`:
```env
USE_SQLITE=False
DB_NAME=burma_meat_point
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
```

2. Run Django migrations against PostgreSQL:
```bash
cd backend
python manage.py migrate
```

3. If you already have SQLite data in `backend/db.sqlite3`, dump and reload it:
```bash
cd backend
python manage.py dumpdata --natural-foreign --natural-primary --exclude auth.permission --exclude contenttypes > data.json
python manage.py loaddata data.json
```

## NoSQL export

The repository now includes a collection-oriented export script:
```bash
python database/export_to_nosql_json.py
```

This writes JSON files into `database/nosql_export/` so the current relational
data can be imported into a document database such as MongoDB using the tooling
for that database.
