// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import PreparationWorkspace from './PreparationWorkspace'
import { samplePreparation, situationQuestions } from './preparation'

it('keeps stable field labels when sample notes and help text are present', () => {
  render(<PreparationWorkspace value={samplePreparation()} onChange={vi.fn()} records={[]} links={[]} separate={[]} sources={[]} importIssues={[]} onDocuments={vi.fn()} onMessage={vi.fn()} busy={false} />)
  expect(screen.getByLabelText('Handover notes', { exact: true })).toHaveProperty('value', expect.stringContaining('Synthetic adult employee'))
  for (const question of situationQuestions) expect(screen.getByLabelText(question.label, { exact: true }).tagName).toBe('SELECT')
})
