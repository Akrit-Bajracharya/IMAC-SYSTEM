# IMAC Operations System — Demo Data Tooling

This directory contains developer-only tooling to generate and manage realistic fake data for manual testing against an isolated demonstration database (`imac_demo`).

> [!CAUTION]
> **HARD SAFETY INVARIANTS**
> - These scripts **REFUSE** to execute against any production database or any database whose name is not exactly `imac_demo`.
> - The database host must strictly be `localhost` or `127.0.0.1`.
> - The explicit environment variable `ALLOW_DEMO_DATA=yes` must be present.
> - `DEMO_PASSWORD` is required only by `demoSeed.ts` (must meet the system password policy length requirement, >= 10 characters). `demoRemove.ts` and `demoStatus.ts` do not require `DEMO_PASSWORD`.
> - These scripts will **never** print connection strings, passwords, or credentials.

---

## 1. Setup Instructions (PowerShell)

To run demo data commands, open a dedicated PowerShell terminal and configure the session variables:

```powershell
# 1. Derive the demo database URL without exposing credentials
$line = Get-Content apps\api\.env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$url = ($line -replace '^DATABASE_URL=', '') -replace '^"|"$', ''
$env:DATABASE_URL = $url -replace '/[^/?]+(\?|$)', '/imac_demo$1'

# 2. Set the demo password securely (minimum 10 characters, required only for demo:seed)
$sec = Read-Host "Demo password" -AsSecureString
$env:DEMO_PASSWORD = [System.Net.NetworkCredential]::new('', $sec).Password

# 3. Enable the demo data gate
$env:ALLOW_DEMO_DATA = 'yes'
```

> [!IMPORTANT]
> **Restoring the Primary Database Environment**
> Closing the PowerShell window immediately clears `$env:DATABASE_URL`, `$env:DEMO_PASSWORD`, and `$env:ALLOW_DEMO_DATA`.
> To run or test the API against the primary development database, start the API in a fresh PowerShell window.

---

## 2. Available Commands

All commands are executed from the `apps/api` directory:

### Seed Demo Data
```powershell
npm run demo:seed
```
- Validates the environment guard.
- Pre-hashes demo passwords with Argon2id before beginning transaction.
- Writes users, profiles, work roles, projects, status history events, milestones, tasks, dependencies, comments, messages, time logs, and work log entries inside a single atomic transaction (120-second timeout).
- Produces `.demo-manifest.txt` containing entity counts and UUIDs (no secrets).

### Inspect Demo Data Status
```powershell
npm run demo:status
```
- Reports the count of active demo entities across all database tables.
- Reports status and modification time of `.demo-manifest.txt`.

### Remove Demo Data
```powershell
npm run demo:remove
```
- Removes all seeded demo records in strict child-to-parent reverse order inside an atomic transaction.
- Deletes `.demo-manifest.txt`.

---

## 3. Demo User Accounts

The seeded accounts provide role-aligned testing profiles:

| Username | System Role | Department | Employee Code | Initial Availability |
| :--- | :--- | :--- | :--- | :--- |
| `demo_admin` | `system_admin` | IT & Infrastructure | `DEMO-ADM` | `available` |
| `demo_hr` | `hr_admin` | Human Resources | `DEMO-HR` | `available` |
| `demo_pm` | `project_manager` | Operations & Projects | `DEMO-PM` | `busy_in_meeting` |
| `demo_dev` | `employee` | Software Engineering | `DEMO-DEV` | `working_remotely` |
| `demo_designer` | `employee` | Design & UX | `DEMO-DES` | `available` |
| `demo_viewer` | `viewer` | Executive & Advisory | `DEMO-VW` | `out_of_office` |

Password for all demo accounts is the value provided to `DEMO_PASSWORD` during setup.
Accounts are initialized with `isActive: true`, `mustChangePassword: false`, `failedLoginCount: 0`, and `lockedUntil: null`.
