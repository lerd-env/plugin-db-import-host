# db-import-host for Lerd

Moving to Lerd from Valet, Herd, DBngin or a MySQL installed with your package manager? Your sites link in a minute, but their data is still in the database server you were using before. This plugin copies it into Lerd's own MySQL, MariaDB or PostgreSQL service, one site at a time or all at once.

## Use

```bash
lerd db-import-host:list                 # databases on this machine's server, and the site each one fills
lerd db-import-host:import               # inside a linked project: replace its Lerd database with the one of the same name
lerd db-import-host:import shop blog     # named sites
lerd db-import-host:import --all         # every site whose database exists on this machine's server
lerd db-import-host:import shop --from shop_prod          # the database there has another name
lerd db-import-host:import blog --database blog_wp        # Lerd does not know the site's database name (WordPress, Drupal)
```

Each site also gets **Import database from this machine** in its Commands menu on the dashboard, and AI assistants get `db-import-host_list` and `db-import-host_import` through Lerd's MCP server.

By default it connects to `127.0.0.1:3306` as `root` with no password for MySQL and MariaDB, and `127.0.0.1:5432` as `postgres` for PostgreSQL. Save anything else once:

```bash
lerd db-import-host:connect mysql --user root --password secret
lerd db-import-host:connect mysql --socket /run/mysqld/mysqld.sock
lerd db-import-host:connect postgres --port 5433 --bin-dir /Applications/Postgres.app/Contents/Versions/latest/bin
```

`--bin-dir` points at the folder holding the server's own `mysqldump`/`mariadb-dump` and `mysql`/`mariadb`, or `pg_dump` and `psql`, when they are not on your `PATH`. Lerd's own shims of the same name are skipped, since they run inside Lerd's containers and cannot reach a server on the machine.

## What it does

For each site it dumps the database from the machine's server with that server's own client, then runs `lerd db:create`, `lerd db:snapshot before-host-import` and `lerd db:import --fresh` in the site's folder. The import replaces what Lerd held for that database, and the snapshot brings it back with `lerd db:restore`. A MariaDB dump going into a MySQL service has its MariaDB-only collations (`utf8mb4_uca1400_*`) and the `NO_AUTO_CREATE_USER` sql mode swapped for what MySQL accepts.

## What it reads, writes and sends

It reads the databases you import from the server on this machine, and never writes to that server. It reads the site list from Lerd's API. The dump is written to `tmp/` in the plugin's data folder and deleted once imported. The connection you save with `connect`, password included, is kept in `connection.json` in the same data folder, readable only by you. Nothing leaves the machine.

## Requirements

Node, which Lerd installs, and the client tools of the server you import from.

## License

MIT
