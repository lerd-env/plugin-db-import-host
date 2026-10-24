---
name: lerd-db-import-host
description: Move a site's database from a MySQL, MariaDB or PostgreSQL server installed on the machine (system package, Herd, DBngin, Valet) into lerd's database service.
---

Use `db-import-host_list` first: it shows the databases on the machine's own server and which lerd site each one fills. Then `db-import-host_import` with the site, adding `from` only when the database there has another name.

The import replaces the site's lerd database, after saving a `before-host-import` snapshot that `db` `restore` brings back. Say so before running it. The machine's server is only read.

When the list fails because no client tools or no server were found, ask the user to run `lerd db-import-host:connect` in their terminal, which asks for each value and tests the connection; never guess a password.
