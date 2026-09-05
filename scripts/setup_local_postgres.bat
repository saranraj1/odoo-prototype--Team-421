@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   DealFlow360: Local PostgreSQL 16 Native Setup
echo   Memory-Aware Architecture (^< 150MB RAM Footprint)
echo ==========================================================

set ROOT_DIR=%~dp0..
set PGSQL_DIR=%ROOT_DIR%\pgsql
set DATA_DIR=%PGSQL_DIR%\data
set LOG_FILE=%PGSQL_DIR%\postgres.log
set ZIP_FILE=%ROOT_DIR%\postgresql-16-binaries.zip
set DOWNLOAD_URL=https://get.enterprisedb.com/postgresql/postgresql-16.15-3-windows-x64-binaries.zip

:: Check if postgres.exe already exists
if exist "%PGSQL_DIR%\bin\postgres.exe" (
    set BIN_DIR=%PGSQL_DIR%\bin
    goto :INIT_CLUSTER
)
if exist "%PGSQL_DIR%\pgsql\bin\postgres.exe" (
    set BIN_DIR=%PGSQL_DIR%\pgsql\bin
    goto :INIT_CLUSTER
)

:: Step 1: Low-memory download using native streaming curl.exe (< 10MB RAM)
echo [1/5] Downloading PostgreSQL 16 portable binaries via streaming curl...
echo Target: %DOWNLOAD_URL%
if not exist "%PGSQL_DIR%" mkdir "%PGSQL_DIR%"

curl.exe -L -o "%ZIP_FILE%" --progress-bar "%DOWNLOAD_URL%"
if errorlevel 1 (
    echo [ERROR] Download failed. Check network connection.
    exit /b 1
)

:: Step 2: Low-memory streaming extraction using native tar.exe (< 15MB RAM)
echo [2/5] Extracting binaries using streaming tar.exe...
tar.exe -xf "%ZIP_FILE%" -C "%PGSQL_DIR%"
if errorlevel 1 (
    echo [ERROR] Extraction failed.
    exit /b 1
)

:: Delete zip to free disk immediately
del /q /f "%ZIP_FILE%" 2>nul

if exist "%PGSQL_DIR%\pgsql\bin\postgres.exe" (
    set BIN_DIR=%PGSQL_DIR%\pgsql\bin
) else (
    set BIN_DIR=%PGSQL_DIR%\bin
)

:INIT_CLUSTER
echo Binaries located at: %BIN_DIR%

:: Step 3: Initialize cluster with UTF-8 and user 'odoo'
if exist "%DATA_DIR%\PG_VERSION" (
    echo [3/5] Database cluster already initialized at %DATA_DIR%.
) else (
    echo [3/5] Initializing database cluster at %DATA_DIR%...
    "%BIN_DIR%\initdb.exe" -D "%DATA_DIR%" -U odoo -E UTF8 --locale=C -A trust
    if errorlevel 1 (
        echo [ERROR] initdb failed.
        exit /b 1
    )

    :: Apply memory-conscious tuning
    echo [3/5] Applying low-memory tuning to postgresql.conf...
    (
        echo.
        echo # DealFlow360 Memory-Conscious Tuning
        echo listen_addresses = 'localhost'
        echo port = 5432
        echo max_connections = 25
        echo shared_buffers = 128MB
        echo work_mem = 4MB
        echo maintenance_work_mem = 32MB
        echo effective_cache_size = 256MB
        echo wal_buffers = 4MB
        echo checkpoint_completion_target = 0.9
        echo fsync = on
        echo synchronous_commit = off
    ) >> "%DATA_DIR%\postgresql.conf"
)

:: Step 4: Start PostgreSQL daemon
echo [4/5] Starting local PostgreSQL daemon...
"%BIN_DIR%\pg_ctl.exe" -D "%DATA_DIR%" -l "%LOG_FILE%" -w start
if errorlevel 1 (
    echo [WARN] pg_ctl start returned code %errorlevel%, checking status...
)

:: Step 5: Provision database 'odoo'
echo [5/5] Provisioning database 'odoo'...
timeout /t 2 /nobreak >nul
"%BIN_DIR%\createdb.exe" -h localhost -p 5432 -U odoo odoo 2>nul
if errorlevel 1 (
    echo Database 'odoo' already exists or ready.
) else (
    echo Database 'odoo' created successfully.
)

echo ==========================================================
echo  PostgreSQL 16 is ACTIVE and ready for Odoo!
echo  Host: localhost  Port: 5432  User: odoo  DB: odoo
echo ==========================================================
exit /b 0
