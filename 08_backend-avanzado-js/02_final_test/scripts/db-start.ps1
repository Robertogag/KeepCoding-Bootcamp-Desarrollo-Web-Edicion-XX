# Arranca un clúster PostgreSQL de desarrollo dedicado para BookShop
# (alternativa a Docker en máquinas con PostgreSQL 17 instalado de forma nativa).
# Usa el puerto 5433 para no interferir con otras instancias en 5432.

$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$dataDir = "$env:USERPROFILE\.bookshop-pgdata"

if (-not (Test-Path "$dataDir\PG_VERSION")) {
  Write-Host "Inicializando clúster de datos en $dataDir..."
  & "$pgBin\initdb.exe" -D $dataDir -U postgres -A trust -E UTF8 --locale=C
}

& "$pgBin\pg_ctl.exe" -D $dataDir -o '-p 5433' -l "$dataDir\server.log" -w start

$dbExists = & "$pgBin\psql.exe" -h localhost -p 5433 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='BookShop'"
if ($dbExists -ne '1') {
  Write-Host 'Creando base de datos BookShop...'
  & "$pgBin\createdb.exe" -h localhost -p 5433 -U postgres BookShop
}

Write-Host 'PostgreSQL listo en localhost:5433 (base de datos: BookShop)'
