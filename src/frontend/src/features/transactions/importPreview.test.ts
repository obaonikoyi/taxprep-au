import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchImportPreview, validateFile } from './importPreview'

const file = new File(['date,description,amount\n2026-01-01,Example,1'], 'test.csv')
const signal = () => new AbortController().signal
const preview = { transactions: [{ rowNumber: 2, date: '2026-01-01', description: 'Example', amount: 0.3 }], errors: [], netTotal: 0.3 }
afterEach(() => vi.unstubAllGlobals())

describe('import preview API boundary', () => {
  it('uploads multipart data and reads the server total', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(preview))
    vi.stubGlobal('fetch', fetch)
    expect(await fetchImportPreview(file, signal())).toEqual(preview)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/transactions/import-preview')
    expect(options.method).toBe('POST')
    expect(options.body.get('file').name).toBe('test.csv')
    expect(options.headers).toBeUndefined()
  })
  it.each([{}, { ...preview, netTotal: '0.3' }, { ...preview, transactions: [{ id: 'old-contract' }] },
    { ...preview, transactions: [preview.transactions[0], preview.transactions[0]] }])('rejects incompatible JSON', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)))
    await expect(fetchImportPreview(file, signal())).rejects.toThrow('unexpected response')
  })
  it.each([[413, 'up to 1 MB'], [502, 'unavailable'], [400, 'Choose a CSV file.']])('handles HTTP %s', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Choose a CSV file.' }, { status: Number(status) })))
    await expect(fetchImportPreview(file, signal())).rejects.toThrow(String(message))
  })
  it('handles HTML responses and network failures', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('<html>Internal</html>')).mockRejectedValueOnce(new TypeError('socket closed'))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchImportPreview(file, signal())).rejects.toThrow('unreadable response')
    await expect(fetchImportPreview(file, signal())).rejects.toThrow('Could not reach')
  })
  it('validates file type, emptiness and exact size boundary', () => {
    expect(validateFile(new File(['x'.repeat(1_000_000)], 'TEST.CSV'))).toBeNull()
    expect(validateFile(new File(['x'.repeat(1_000_001)], 'test.csv'))).toContain('1 MB')
    expect(validateFile(new File([], 'test.csv'))).toContain('empty')
    expect(validateFile(new File(['x'], 'test.txt'))).toContain('CSV')
  })
})
