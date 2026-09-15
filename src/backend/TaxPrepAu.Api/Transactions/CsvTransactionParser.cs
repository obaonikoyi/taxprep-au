using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.VisualBasic.FileIO;

namespace TaxPrepAu.Api.Transactions;

public sealed record ImportedTransaction(long RowNumber, DateOnly Date, string Description, decimal Amount);
public sealed record ImportValidationError(long? RowNumber, string Message);
public sealed record TransactionImportPreview(
    IReadOnlyList<ImportedTransaction> Transactions,
    IReadOnlyList<ImportValidationError> Errors,
    decimal NetTotal);

public static partial class CsvTransactionParser
{
    public const int MaximumRows = 5000;
    private static readonly string[] RequiredColumns = ["date", "description", "amount"];

    // A documented decimal format prevents locale guesses and rounding hidden fractions.
    [GeneratedRegex(@"^[+-]?[0-9]+(?:\.[0-9]{1,2})?$")]
    private static partial Regex AmountPattern();

    public static TransactionImportPreview Parse(TextReader reader)
    {
        using var parser = new TextFieldParser(reader);
        parser.TextFieldType = FieldType.Delimited;
        parser.SetDelimiters(",");
        parser.HasFieldsEnclosedInQuotes = true;

        if (parser.EndOfData)
            return Preview([], [new(null, "The CSV file is empty.")]);

        string[] names;
        try
        {
            names = (parser.ReadFields() ?? [])
                .Select(value => value.Trim().TrimStart('\uFEFF').ToLowerInvariant()).ToArray();
        }
        catch (MalformedLineException)
        {
            return Preview([], [new(null, "The CSV header has invalid quotation marks.")]);
        }

        if (names.Distinct().Count() != names.Length)
            return Preview([], [new(null, "Column headings must be unique.")]);

        var headers = names.Select((name, index) => (name, index)).ToDictionary(x => x.name, x => x.index);
        var missing = RequiredColumns.Where(column => !headers.ContainsKey(column)).ToArray();
        if (missing.Length > 0)
            return Preview([], [new(null, $"Missing required column{(missing.Length > 1 ? "s" : "")}: {string.Join(", ", missing)}.")]);

        var transactions = new List<ImportedTransaction>();
        var errors = new List<ImportValidationError>();
        var recordsRead = 0;
        while (!parser.EndOfData)
        {
            if (++recordsRead > MaximumRows)
                return Preview([], [new(null, $"The CSV exceeds {MaximumRows} data rows. Split it into smaller files.")]);

            // TextFieldParser uses physical line numbers, including blank/multiline rows.
            var rowNumber = parser.LineNumber;
            string[] fields;
            try
            {
                fields = parser.ReadFields() ?? [];
            }
            catch (MalformedLineException)
            {
                errors.Add(new(parser.ErrorLineNumber, "Invalid CSV quotation marks. Check this record before importing again."));
                continue;
            }

            if (fields.Length != names.Length)
            {
                errors.Add(new(rowNumber, "The number of values must match the column headings."));
                continue;
            }
            string Get(string name) => fields[headers[name]].Trim();
            if (!DateOnly.TryParseExact(Get("date"), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                errors.Add(new(rowNumber, "Enter a valid date in YYYY-MM-DD format."));
                continue;
            }
            var description = Get("description");
            if (description.Length is 0 or > 500)
            {
                errors.Add(new(rowNumber, "Description must contain 1 to 500 characters."));
                continue;
            }
            var amountText = Get("amount");
            if (!AmountPattern().IsMatch(amountText)
                || !decimal.TryParse(amountText, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign,
                    CultureInfo.InvariantCulture, out var amount)
                || Math.Abs(amount) > 1_000_000_000m)
            {
                errors.Add(new(rowNumber, "Use a signed decimal amount with up to 2 decimal places, no currency symbols or separators, and magnitude at most 1,000,000,000."));
                continue;
            }
            transactions.Add(new(rowNumber, date, description, amount));
        }
        if (recordsRead == 0)
            errors.Add(new(null, "The CSV has headings but no transaction rows."));
        return Preview(transactions, errors);
    }

    private static TransactionImportPreview Preview(
        IReadOnlyList<ImportedTransaction> transactions,
        IReadOnlyList<ImportValidationError> errors) =>
        new(transactions, errors, transactions.Sum(transaction => transaction.Amount));
}
