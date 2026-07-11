-- Runs once when the Postgres container is first created.
CREATE DATABASE little_library_exchange_test;
GRANT ALL PRIVILEGES ON DATABASE little_library_exchange_test TO lle;
