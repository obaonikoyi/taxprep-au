export type ImportedTransaction = {
  id: string
  date: string
  description: string
  amount: number
}

export type CsvImportResult = {
  transactions: ImportedTransaction[]
  errors: string[]
}

function readCsvRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"' && line[index + 1] === '"' && quoted) {
      current += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += character
    }
  }

  cells.push(current.trim())
  return cells
}

export function parseTransactionCsv(csv: string): CsvImportResult {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())

  if (lines.length === 0) {
    return { transactions: [], errors: ['The CSV file is empty.'] }
  }

  const header = readCsvRow(lines[0]).map((cell) => cell.toLowerCase())
  const requiredColumns = ['date', 'description', 'amount']
  const missingColumns = requiredColumns.filter((column) => !header.includes(column))

  if (missingColumns.length > 0) {
    return {
      transactions: [],
      errors: [`Missing required column${missingColumns.length > 1 ? 's' : ''}: ${missingColumns.join(', ')}.`],
    }
  }

  const column = Object.fromEntries(header.map((name, index) => [name, index]))
  const transactions: ImportedTransaction[] = []
  const errors: string[] = []

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2
    const cells = readCsvRow(line)
    const date = cells[column.date]?.trim()
    const description = cells[column.description]?.trim()
    const amountText = cells[column.amount]?.trim()
    const amount = Number(amountText)

    if (!date || Number.isNaN(Date.parse(`${date}T00:00:00`))) {
      errors.push(`Row ${rowNumber}: enter a valid date in YYYY-MM-DD format.`)
      return
    }

    if (!description) {
      errors.push(`Row ${rowNumber}: description is required.`)
      return
    }

    if (!amountText || !Number.isFinite(amount)) {
      errors.push(`Row ${rowNumber}: amount must be a number.`)
      return
    }

    transactions.push({ id: `${rowNumber}-${date}-${amount}`, date, description, amount })
  })

  return { transactions, errors }
}
