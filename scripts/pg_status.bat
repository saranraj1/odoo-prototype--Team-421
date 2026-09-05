@echo off
set ROOT_DIR=%~dp0..
set PGSQL_DIR=%ROOT_DIR%\pgsql
set DATA_DIR=%PGSQL_DIR%\data

if exist "%PGSQL_DIR%\pgsql\bin\pg_ctl.exe" (
    set BIN_DIR=%PGSQL_DIR%\pgsql\bin
) else if exist "%PGSQL_DIR%\bin\pg_ctl.exe" (
    set BIN_DIR=%PGSQL_DIR%\bin
) else (
    echo [ERROR] PostgreSQL binaries not found in %PGSQL_DIR%.
    exit /b 1
)

"%BIN_DIR%\pg_ctl.exe" -D "%DATA_DIR%" status
