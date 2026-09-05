@echo off
set ROOT_DIR=%~dp0..
set PGSQL_DIR=%ROOT_DIR%\pgsql
set DATA_DIR=%PGSQL_DIR%\data
set LOG_FILE=%PGSQL_DIR%\postgres.log

if exist "%PGSQL_DIR%\pgsql\bin\pg_ctl.exe" (
    set BIN_DIR=%PGSQL_DIR%\pgsql\bin
) else if exist "%PGSQL_DIR%\bin\pg_ctl.exe" (
    set BIN_DIR=%PGSQL_DIR%\bin
) else (
    echo [ERROR] PostgreSQL binaries not found in %PGSQL_DIR%.
    echo Run scripts\setup_local_postgres.bat first.
    exit /b 1
)

echo Starting PostgreSQL on localhost:5432...
"%BIN_DIR%\pg_ctl.exe" -D "%DATA_DIR%" -l "%LOG_FILE%" -w start
"%BIN_DIR%\pg_ctl.exe" -D "%DATA_DIR%" status
