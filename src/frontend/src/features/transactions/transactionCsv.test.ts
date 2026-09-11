import { describe, expect, it } from 'vitest'
import { parseTransactionCsv } from './transactionCsv'

describe('parseTransactionCsv', () => {
  it('parses valid transactions and quoted commas', () => {
    const result = parseTransactionCsv(
      'date,description,amount\n2026-07-02,"City Stationery, Adelaide",-37.60\n2026-07-29,Example Payroll,2450.00',
    )

    expect(result.errors).toEqual([])
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].description).toBe('City Stationery, Adelaide')
    expect(result.transactions[1].amount).toBe(2450)
  })

  it('reports missing required columns', () => {
    const result = parseTransactionCsv('date,description\n2026-07-02,Office supplies')

    expect(result.transactions).toEqual([])
    expect(result.errors).toEqual(['Missing required column: amount.'])
  })

  it('keeps valid rows when another row is invalid', () => {
    const result = parseTransactionCsv(
      'date,description,amount\nnot-a-date,Invalid,-10\n2026-07-02,Valid expense,-49.95',
    )

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].description).toBe('Valid expense')
    expect(result.errors[0]).toContain('Row 2')
  })

  it('rejects empty files', () => {
    expect(parseTransactionCsv('  ').errors).toEqual(['The CSV file is empty.'])
  })
})
