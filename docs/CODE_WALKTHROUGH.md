# TaxPrep AU code walkthrough

This is a beginner-friendly tour of the project. It explains how the main files work together without repeating every line of code.

## The big picture

TaxPrep AU currently contains two applications:

1. The **frontend** is the page a user sees and interacts with in the browser.
2. The **backend** is the server that will eventually validate requests, apply business rules and work with stored data.

They run separately during development. This separation lets us change the page design without mixing it with server or data logic.

## What happens when the frontend starts?

1. The browser opens `src/frontend/index.html`.
2. That file loads `src/frontend/src/main.tsx`.
3. `main.tsx` finds the HTML element named `root`.
4. React renders the `App` component inside that element.
5. `App.tsx` describes the visible page structure and content.
6. `App.css` and `index.css` control how the page looks.

### Why `App.tsx` looks like HTML

React uses **JSX**, which lets TypeScript describe a user interface with HTML-like elements. For example:

```tsx
<h1>A clean foundation for a careful product.</h1>
```

This tells React to display a main heading. JSX can also include normal programming features such as variables, conditions and loops.

### How the foundation cards are created

`App.tsx` stores the card information in the `foundations` array. The `map` operation visits each item and creates one card from it.

This is preferable to copying the same markup three times because there is only one card structure to maintain.

## What happens when the backend starts?

1. .NET runs `src/backend/TaxPrepAu.Api/Program.cs`.
2. `WebApplication.CreateBuilder` prepares the application and reads its configuration.
3. `builder.Build()` creates the web application.
4. The application registers the `/api/health` endpoint.
5. `app.Run()` starts the server and waits for requests.

### What is an endpoint?

An endpoint is an address where another program can request a specific operation or piece of information.

The current endpoint is:

```text
/api/health
```

It returns:

```json
{
  "status": "healthy",
  "service": "TaxPrep AU API"
}
```

This proves the API is running. It does not read or return personal or financial information.

## Where the synthetic CSV fits

`sample-data/transactions.csv` is not part of a real user's account. It is a safe development fixture that will help us build the future import workflow.

The planned flow is:

1. The user chooses a CSV file.
2. The frontend sends it to the backend.
3. An importer reads and validates the columns.
4. The application shows a preview.
5. The user confirms or corrects the information.
6. Only confirmed transactions are added to the selected tax-year workspace.

The generic importer will convert supported CSV columns into TaxPrep AU's standard transaction format. Bank-specific adapters and document scanning are possible future work, not part of the current foundation.

## How we will comment code

Comments should explain:

- why a section exists;
- how it fits into TaxPrep AU;
- a decision that may not be obvious;
- a privacy or safety rule; or
- syntax that is genuinely useful for a beginner to understand.

Comments should not repeat every obvious line. The code remains the exact source of behaviour, while this walkthrough explains the larger story.

## Current boundaries

The project does not yet contain:

- login or user accounts;
- a database;
- CSV upload or parsing;
- tax categorisation;
- AI integration;
- bank connections; or
- real financial information.

Those features will be introduced in small, reviewed stages.
