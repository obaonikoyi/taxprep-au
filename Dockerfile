FROM node:22-bookworm-slim AS frontend
WORKDIR /source/src/frontend
COPY src/frontend/package*.json ./
RUN npm ci
COPY src/frontend/ ./
COPY sample-data/ /source/sample-data/
RUN npm run build

# Which commit this build came from, served as a plain file at /build.txt.
#
# The hosted verification job browses the deployed site, and a push to main
# starts that job and this deploy at the same moment — so without a marker the
# job races the thing it is checking and tests the previous release. It polls
# this file until it matches the commit being deployed.
#
# Railway isolates Dockerfile builds from its own variables unless a build
# argument opts in, so the ARG is required, and the empty default keeps a
# local `docker build` working.
ARG RAILWAY_GIT_COMMIT_SHA=""
RUN printf '%s' "$RAILWAY_GIT_COMMIT_SHA" > dist/build.txt

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
