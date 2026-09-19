# Fictional payslip fixtures

Six independent invented single-page summaries in `examples.json`. No real employee, employer, identifier or document was used. Their withholding/super amounts illustrate the reader and arithmetic, not authoritative payroll calculations.

Regenerate from the repository root using `python sample-data/payslips/generate.py` with ReportLab and DejaVu Sans fonts installed. JSON includes base64 PDF bytes; the generator also writes temporary preview PDFs under `/tmp`. The shipped example imports the JSON lazily and sends each file through the real local reader.

Each page uses the explicit PAYSLIP SUMMARY v1 labels documented in [Milestone 14](../../docs/MILESTONE_14_PAYSLIP_DASHBOARD.md). The last file omits super and every file includes deliberately large YTD values to catch accidental cumulative double counting. Public CI and screenshots use only these synthetic records.
