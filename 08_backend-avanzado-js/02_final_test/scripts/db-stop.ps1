# Detiene el clúster PostgreSQL de desarrollo de BookShop (puerto 5433).

$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$dataDir = "$env:USERPROFILE\.bookshop-pgdata"

& "$pgBin\pg_ctl.exe" -D $dataDir stop

Write-Host 'PostgreSQL de BookShop detenido'
