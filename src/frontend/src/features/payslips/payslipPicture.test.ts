import { describe, expect, it } from 'vitest'
import { isPicture, rowsFromBlocks } from './payslipPicture'

/*
 * The recogniser's answer is data from outside the app, so it is read like any
 * other: only what is understood is kept, and anything else is dropped rather
 * than trusted. The positions matter as much as the words — they are what tells
 * a "This pay" column from a "Year to date" one.
 */
const word = (text: string, x0: number, x1: number, y0: number, y1: number) => ({ text, bbox: { x0, x1, y0, y1 } })
const page = (lines: ReturnType<typeof word>[][]) => [{ paragraphs: [{ lines: lines.map(words => ({ words })) }] }]

describe('what the recogniser hands back', () => {
  it('keeps each line as a row of positioned words', () => {
    const rows = rowsFromBlocks(page([[word('Gross', 10, 60, 100, 120), word('1840.00', 200, 280, 100, 120)]]), 1000)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('Gross 1840.00')
    expect(rows[0].tokens.map(t => t.x)).toEqual([10, 200])
    expect(rows[0].tokens.map(t => t.width)).toEqual([50, 80])
  })

  it('measures upwards from the bottom, the way every parser here expects', () => {
    // A word near the top of the picture must end up with the larger y, or a
    // payslip would be read from the bottom up.
    const rows = rowsFromBlocks(page([
      [word('TOP', 10, 60, 100, 120)],
      [word('BOTTOM', 10, 90, 900, 920)],
    ]), 1000)
    expect(rows[0].tokens[0].y).toBeGreaterThan(rows[1].tokens[0].y)
  })

  it('uses the recogniser’s own idea of a line rather than regrouping by height', () => {
    // Print on one line of a photo wanders by more than the two units the PDF
    // grouping allows, so two words at slightly different heights are still
    // one row when the recogniser says they are.
    const rows = rowsFromBlocks(page([[word('This', 10, 60, 100, 120), word('pay', 200, 240, 108, 129)]]), 1000)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toBe('This pay')
  })

  it('drops a word with no readable position instead of placing it at zero', () => {
    const rows = rowsFromBlocks([{ paragraphs: [{ lines: [{ words: [
      { text: 'kept', bbox: { x0: 10, x1: 50, y0: 10, y1: 30 } },
      { text: 'nowhere', bbox: { x0: null, x1: 'x', y0: 10, y1: 30 } },
      { text: 'alsonowhere' },
    ] }] }] }], 500)
    expect(rows[0].tokens.map(t => t.text)).toEqual(['kept'])
  })

  it('answers with nothing rather than throwing on an answer of the wrong shape', () => {
    for (const value of [null, undefined, 'text', 42, [], [{}], [{ paragraphs: null }], [{ paragraphs: [{ lines: 'no' }] }]])
      expect(rowsFromBlocks(value, 100)).toEqual([])
  })

  it('leaves out a line that recognised as nothing but whitespace', () => {
    expect(rowsFromBlocks(page([[word('   ', 10, 60, 100, 120)]]), 500)).toEqual([])
  })
})

describe('which files are pictures', () => {
  it('accepts the formats a phone produces', () => {
    for (const name of ['pay.png', 'pay.PNG', 'pay.jpg', 'pay.jpeg', 'IMG_2031.JPG']) expect(isPicture(name)).toBe(true)
  })
  it('leaves PDFs and everything else to the other path', () => {
    for (const name of ['pay.pdf', 'pay.heic', 'pay.png.pdf', 'pay.webp', 'pay']) expect(isPicture(name)).toBe(false)
  })
})
