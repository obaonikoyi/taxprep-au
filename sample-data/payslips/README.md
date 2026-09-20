# Fictional payslip fixtures

Six independent invented single-page summaries in `examples.json`. No real employee, employer, identifier or document was used. Their withholding/super amounts illustrate the reader and arithmetic, not authoritative payroll calculations.

Regenerate from the repository root using `python sample-data/payslips/generate.py` with ReportLab and DejaVu Sans fonts installed. JSON includes base64 PDF bytes; the generator also writes temporary preview PDFs under `/tmp`. The shipped example imports the JSON lazily and sends each file through the real local reader.

Each page uses the explicit PAYSLIP SUMMARY v1 labels documented in [Milestone 14](../../docs/MILESTONE_14_PAYSLIP_DASHBOARD.md). The last file omits super and every file includes deliberately large YTD values to catch accidental cumulative double counting. Public CI and screenshots use only these synthetic records.

## PAY ADVICE v2 fixtures

Three further invented single-page advices in `advice-examples.json`, regenerated with `python sample-data/payslips/generate_v2.py`. No real employee, employer, identifier or document was used.

These use the tabular PAY ADVICE v2 layout documented in [Milestone 17](../../docs/MILESTONE_17_SECOND_PAYSLIP_LAYOUT.md): each amount row carries a current-period figure beside a cumulative year-to-date figure. The year-to-date column holds large unrelated values on purpose, so a reader that confused the two columns would produce obviously wrong totals rather than plausible ones. The third advice omits the superannuation row entirely, so super stays unknown rather than being recorded as zero.
