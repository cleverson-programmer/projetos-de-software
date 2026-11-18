#!/bin/sh
set -eu
node database/migrate.mjs
exec node src/server.js
