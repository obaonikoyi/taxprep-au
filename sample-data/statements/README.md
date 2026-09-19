# Fictional statement fixtures

These are entirely invented records, counterparties and figures. No uploaded private statement data is included. `generate.py` creates reproducible PDF bytes inside JSON for the native-text table parser: a multi-page example with continuation/value-date cases, a zero-activity statement and an intentionally mismatched totals statement. The example is copied to the public sample directory and is clearly labelled fictional. The geometry exercises a CommBank-style table contract; no bank logo or endorsement is used.

From the repository root, run `python sample-data/statements/generate.py` with ReportLab installed. Temporary PDF files are generated in `/tmp` for visual inspection. CI consumes the committed JSON and does not need Python or private uploads.
