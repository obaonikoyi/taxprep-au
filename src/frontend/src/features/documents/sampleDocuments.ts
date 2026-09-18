import fixture from '../../../../../sample-data/documents/receipt.json'
export async function sampleDocuments(): Promise<File[]> {
  return [new File(['Date,Description,Amount\n2025-08-14,Sunrise Mobile Services,-45.00\n'], 'sample-bank.csv', { type: 'text/csv' }),
    new File([Uint8Array.from(atob(fixture.pdfBase64), character => character.charCodeAt(0))], 'sample-phone-receipt.pdf', { type: 'application/pdf' })]
}
