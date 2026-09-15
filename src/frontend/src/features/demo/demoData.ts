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
    title: 'Did Sarah pay transport fares between workplaces or clients?',
    description: 'This example covers bus, train or taxi fares. Leave out ordinary commuting and own-car expenses for this demo.',
  },
  {
    id: 'phone',
    title: 'Did Sarah use her personal phone for work?',
    description: 'Record a phone service bill and the percentage used for work.',
  },
  {
    id: 'protective-clothing',
    title: 'Did Sarah buy protective clothing required for work?',
    description: 'Record a protective item and what Sarah used it for. Everyday clothing is outside this example.',
  },
]
