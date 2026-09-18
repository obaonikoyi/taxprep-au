// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import DocumentWorkspace from './DocumentWorkspace'
it('exposes stable accessible names for the entry controls', () => {
  render(<DocumentWorkspace />)
  expect(screen.getByRole('combobox', { name: 'Financial year' })).toBeDefined()
  expect(screen.getByLabelText('Financial year', { exact: true })).toBeDefined()
  expect(screen.getByLabelText('Tax situation', { exact: true })).toBeDefined()
})
