# Development guide

This guide explains how to run the TaxPrep AU foundation locally. The frontend and backend run as separate applications during development.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- .NET 8 SDK
- Git

Visual Studio 2022 users should install the **ASP.NET and web development** workload.

## Get the project

```powershell
git clone https://github.com/obaonikoyi/taxprep-au.git
cd taxprep-au
```

## Run the React frontend

Open a terminal in the repository and run:

```powershell
cd src/frontend
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

### Check the frontend

```powershell
npm run lint
npm run build
```

- `lint` checks the source for common code-quality problems.
- `build` checks TypeScript and creates an optimised production bundle.

## Run the ASP.NET Core backend

Open a second terminal in the repository and run:

```powershell
dotnet restore TaxPrepAu.sln
dotnet run --project src/backend/TaxPrepAu.Api
```

Open `http://localhost:5087/api/health`. A running API returns JSON similar to:

```json
{
  "status": "healthy",
  "service": "TaxPrep AU API"
}
```

### Check the backend

```powershell
dotnet build TaxPrepAu.sln --configuration Release
```

## Run with Visual Studio 2022

1. Open `TaxPrepAu.sln`.
2. Confirm `TaxPrepAu.Api` is the startup project.
3. Press `Ctrl+F5` to run without the debugger, or `F5` to run with it.
4. Keep the frontend running separately with `npm run dev`.

## Current safety boundary

The foundation contains no AI integration, bank connection, database, authentication, receipt upload, or real financial data. Use fictional data only when test fixtures are introduced.

## Common first-run problems

### `dotnet` is not recognised

Install the .NET 8 SDK, close the terminal, open a new terminal, and run `dotnet --version`.

### `npm` is not recognised

Install a current Node.js LTS release, reopen the terminal, and run `node --version` and `npm --version`.

### Port already in use

Stop the older development process or start the application on another port. Do not change committed port settings only to solve a temporary local conflict.
