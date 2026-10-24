# db-import-host

Copies your sites' databases from a MySQL, MariaDB or PostgreSQL server installed on this machine (a system package, Herd, DBngin, Valet) into lerd's own database service.

## Import

| Where | How |
|---|---|
| Terminal, inside a project | `lerd db-import-host:import` |
| Terminal, named sites | `lerd db-import-host:import shop blog` |
| Terminal, every site at once | `lerd db-import-host:import --all` |
| Dashboard | the site's Commands menu, **Import database from this machine** |
| AI assistant | `db-import-host_import` |

`lerd db-import-host:list` shows the databases on the machine's server and the lerd site each one fills.

The import replaces the site's lerd database. A `before-host-import` snapshot is taken first, so `lerd db:restore` brings the old one back. The machine's server is only read.

When the database there has another name, add `--from <name>`. When lerd does not know the site's database name, as with WordPress and Drupal, add `--database <name>`.

## Connecting

By default it connects to `127.0.0.1:3306` as `root` with no password for MySQL and MariaDB, and `127.0.0.1:5432` as `postgres` for PostgreSQL. To save anything else, run `lerd db-import-host:connect` and answer its questions; it tries the connection before saving. Or pass it all at once:

```bash
lerd db-import-host:connect mysql --user root --password secret
lerd db-import-host:connect mysql --socket /run/mysqld/mysqld.sock
lerd db-import-host:connect postgres --port 5433 --bin-dir /path/to/postgres/bin
```

`--bin-dir` points at the folder holding the server's own `mysqldump` and `mysql`, or `pg_dump` and `psql`, when they are not on your `PATH`.

## When it fails

- **no mysqldump and mysql of the machine's own were found**: install the server's client tools, or point `--bin-dir` at them.
- **Access denied**: run `lerd db-import-host:connect` and give the right user and password.
- A MariaDB dump going into lerd's MySQL has its MariaDB-only collations swapped for MySQL's on the way.
