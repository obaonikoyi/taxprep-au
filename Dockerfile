FROM node:22-bookworm-slim AS frontend
WORKDIR /source/src/frontend
COPY src/frontend/package*.json ./
RUN npm ci
COPY src/frontend/ ./
COPY sample-data/ /source/sample-data/
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend
WORKDIR /source
# TaxPrepAu.Api is the .NET project name, kept after the September 2026 rename
# to Xoba Paycheck: it is invisible to users and renaming it is its own change.
# See docs/RENAME_TO_XOBA_PAYCHECK.md.
COPY src/backend/TaxPrepAu.Api/TaxPrepAu.Api.csproj src/backend/TaxPrepAu.Api/
RUN dotnet restore src/backend/TaxPrepAu.Api/TaxPrepAu.Api.csproj
COPY src/backend/ src/backend/
RUN dotnet publish src/backend/TaxPrepAu.Api/TaxPrepAu.Api.csproj -c Release --no-restore -o /published /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Hosting__HttpsHandledByProxy=true
COPY --from=backend /published/ ./
COPY --from=frontend /source/src/frontend/dist/ ./wwwroot/
USER app
EXPOSE 8080
CMD ["sh", "-c", "exec dotnet TaxPrepAu.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
