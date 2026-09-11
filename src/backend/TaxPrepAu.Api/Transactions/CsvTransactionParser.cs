using System.Globalization;
using Microsoft.VisualBasic.FileIO;

namespace TaxPrepAu.Api.Transactions;

public sealed record ImportedTransaction(int RowNumber, DateOnly Date, string Description, decimal Amount);
public sealed record ImportValidationError(int? RowNumber, string Message);
public sealed record TransactionImportPreview(
    IReadOnlyList<ImportedTransaction> Transactions,
    IReadOnlyList<ImportValidationError> Errors,
    decimal NetTotal);

public static class CsvTransactionParser
{
    private static readonly string[] RequiredColumns = ["date", "description", "amount"];

    public static TransactionImportPreview Parse(TextReader reader)
    {
        using var parser = new TextFieldParser(reader);
        parser.TextFieldType = FieldType.Delimited;
        parser.SetDelimiters(",");
        parser.HasFieldsEnclosedInQuotes = true;

        if (parser.EndOfData)
        {
            return Preview([], [new(null, "The CSV file is empty.")]);
        }

        var headers = (parser.ReadFields() ?? [])
            .Select((value, index) => new { Name = value.Trim().ToLowerInvariant(), Index = index })
            .ToDictionary(item => item.Name, item => item.Index);
        var missing = RequiredColumns.Where(column => !headers.ContainsKey(column)).ToArray();

        if (missing.Length > 0)
        {
            return Preview([], [new(null, $"Missing required column{(missing.Length > 1 ? "s" : "")}: {string.Join(", ", missing)}.")]);
        }

        var transactions = new List<ImportedTransaction>();
        var errors = new List<ImportValidationError>();
        var rowNumber = 1;

        while (!parser.EndOfData)
        {
            rowNumber++;
            var fields = parser.ReadFields() ?? [];
            string Get(string name) => headers[name] < fields.Length ? fields[headers[name]].Trim() : string.Empty;
            var dateText = Get("date");
            var description = Get("description");
            var amountText = Get("amount");

            if (!DateOnly.TryParseExact(dateText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                errors.Add(new(rowNumber, "Enter a valid date in YYYY-MM-DD format."));
                continue;
            }

            if (string.IsNullOrWhiteSpace(description))
            {
                errors.Add(new(rowNumber, "Description is required."));
                continue;
            }

            if (!decimal.TryParse(amountText, NumberStyles.Number | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var amount))
            {
                errors.Add(new(rowNumber, "Amount must be a number."));
                continue;
            }

            transactions.Add(new(rowNumber, date, description, amount));
        }

        return Preview(transactions, errors);
    }

    private static TransactionImportPreview Preview(
        IReadOnlyList<ImportedTransaction> transactions,
        IReadOnlyList<ImportValidationError> errors) =>
        new(transactions, errors, transactions.Sum(transaction => transaction.Amount));
}
