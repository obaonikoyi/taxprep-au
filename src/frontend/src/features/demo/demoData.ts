export interface DemoProfile {
  name: string
  occupation: string
  financialYear: string
  employmentIncome: number
  taxWithheld: number
}

export interface DemoQuestion {
  id: 'travel' | 'phone' | 'protective-clothing'
  title: string
  description: string
}

export const demoProfile: DemoProfile = {
  name: 'Sarah',
  occupation: 'Disability Support Worker',
  financialYear: '2025–26',
  employmentIncome: 72_000,
  taxWithheld: 15_000,
}

export const demoQuestions: DemoQuestion[] = [
  {
    id: 'travel',
    title: 'Did Sarah travel directly between workplaces or clients?',
    description: 'Ordinary travel from home to a regular workplace is not included in this demo.',
  },
  {
    id: 'phone',
    title: 'Did Sarah use her personal phone for work?',
    description: 'Only the documented work-use portion should be considered.',
  },
  {
    id: 'protective-clothing',
    title: 'Did Sarah buy protective clothing required for work?',
    description: 'Everyday clothing is treated differently from protective or occupation-specific items.',
  },
]

