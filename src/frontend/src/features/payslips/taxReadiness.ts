import { confirmationIssues, employerKey, financialYear, type Payslip } from './payslip'

export const TAX_READINESS_VERSION = 'tax-readiness-profile-v1'
export const TAX_READINESS_REVIEW = 'Profile readiness only. Reliable tax/refund calculations remain locked while qualified rule, source and rounding review in issue #28 is pending.'

export type ReadinessAnswer = '' | 'yes' | 'no' | 'unsure'
export type TaxReadinessKey =
  | 'resident'
  | 'payCoverage'
  | 'otherIncome'
  | 'studyLoan'
  | 'declarationsKnown'
  | 'simpleFamily'
  | 'medicareSpecial'
  | 'privateHealth'
  | 'otherAdjustments'
  | 'irregularPay'

export type TaxReadinessAnswers = Record<TaxReadinessKey, ReadinessAnswer>

export type TaxReadinessQuestion = {
  key: TaxReadinessKey
  label: string
  help: string
  supportedAnswer: 'yes' | 'no'
  noMeansNeedsInformation?: boolean
  sourceIds: string[]
}

export const taxReadinessSources = [
  {
    id: 'tfn',
    title: 'ATO — Tax file number declaration',
    url: 'https://www.ato.gov.au/TFNdec',
  },
  {
    id: 'withheld',
    title: 'ATO — Tax withheld calculator and declaration inputs',
    url: 'https://www.ato.gov.au/calculators-and-tools/tax-withheld-calculator',
  },
  {
    id: 'payg-2026',
    title: 'ATO Software Developers — 2026 PAYG withholding schedules',
    url: 'https://softwaredevelopers.ato.gov.au/PAYGWTaxtables',
  },
  {
    id: 'loans',
    title: 'ATO — Study and training loan repayment thresholds and rates',
    url: 'https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-compulsory-repayments',
  },
] as const

export const taxReadinessQuestions: TaxReadinessQuestion[] = [
  {
    key: 'resident',
    label: 'Were you an Australian resident for tax purposes for the full financial year, without working-holiday or another special tax rate?',
    help: 'Tax residency and special worker status can change which annual and PAYG rules apply.',
    supportedAnswer: 'yes',
    sourceIds: ['tfn', 'withheld'],
  },
  {
    key: 'payCoverage',
    label: 'Have you included every employer and salary/wage record you have for this financial year?',
    help: 'A tax view is whole-person/year scoped. One employer or a partial pay history is not enough.',
    supportedAnswer: 'yes',
    noMeansNeedsInformation: true,
    sourceIds: [],
  },
  {
    key: 'otherIncome',
    label: 'Did you have income outside salary/wages or sole-owner Australian bank interest?',
    help: 'Business, rental, foreign, investment and other income need separate supported rules.',
    supportedAnswer: 'no',
    sourceIds: [],
  },
  {
    key: 'studyLoan',
    label: 'Did you have a study or training support loan during this financial year?',
    help: 'Examples include HELP, VSL, SFSS, SSL, ABSTUDY SSL and AASL. These can affect both withholding and the annual position.',
    supportedAnswer: 'no',
    sourceIds: ['withheld', 'loans'],
  },
  {
    key: 'declarationsKnown',
    label: 'Do you know the tax-free-threshold and withholding-declaration choices that applied at each employer?',
    help: 'Do not enter a TFN here. Future PAYG checking needs declaration choices, not the TFN number itself.',
    supportedAnswer: 'yes',
    noMeansNeedsInformation: true,
    sourceIds: ['tfn', 'withheld'],
  },
  {
    key: 'simpleFamily',
    label: 'Were you single with no spouse or dependants for the full financial year?',
    help: 'Family circumstances can affect Medicare-related calculations and thresholds.',
    supportedAnswer: 'yes',
    sourceIds: [],
  },
  {
    key: 'medicareSpecial',
    label: 'Did a Medicare levy exemption, reduction or Medicare levy variation circumstance apply?',
    help: 'Those circumstances need their own reviewed inputs and calculation rules.',
    supportedAnswer: 'no',
    sourceIds: ['withheld'],
  },
  {
    key: 'privateHealth',
    label: 'Did private patient hospital cover or another Medicare levy surcharge/private-health circumstance need to be considered?',
    help: 'Private-health and surcharge treatment is outside the current narrow employee prototype.',
    supportedAnswer: 'no',
    sourceIds: [],
  },
  {
    key: 'otherAdjustments',
    label: 'Did you have deductions, tax offsets or other annual adjustments that would need to change the calculation?',
    help: 'Draft expense illustrations are not automatically approved deductions, and unsupported adjustments must stay separate.',
    supportedAnswer: 'no',
    sourceIds: [],
  },
  {
    key: 'irregularPay',
    label: 'Did this year include bonuses, commissions, back pay, termination payments or other irregular employment payments?',
    help: 'Irregular payments can use different withholding treatment and must not be projected like normal pay.',
    supportedAnswer: 'no',
    sourceIds: ['payg-2026'],
  },
]

export const blankTaxReadinessAnswers = (): TaxReadinessAnswers => ({
  resident: '',
  payCoverage: '',
  otherIncome: '',
  studyLoan: '',
  declarationsKnown: '',
  simpleFamily: '',
  medicareSpecial: '',
  privateHealth: '',
  otherAdjustments: '',
  irregularPay: '',
})

export type TaxReadinessResult = {
  answered: TaxReadinessQuestion[]
  needsInformation: TaxReadinessQuestion[]
  outsideProfile: TaxReadinessQuestion[]
  taxResultLocked: true
  version: string
  review: string
}

export function assessTaxReadiness(answers: TaxReadinessAnswers): TaxReadinessResult {
  const answered: TaxReadinessQuestion[] = []
  const needsInformation: TaxReadinessQuestion[] = []
  const outsideProfile: TaxReadinessQuestion[] = []

  for (const question of taxReadinessQuestions) {
    const answer = answers[question.key]
    if (!answer || answer === 'unsure') {
      needsInformation.push(question)
      continue
    }
    if (question.noMeansNeedsInformation && answer === 'no') {
      needsInformation.push(question)
      continue
    }
    if (answer === question.supportedAnswer) answered.push(question)
    else outsideProfile.push(question)
  }

  return {
    answered,
    needsInformation,
    outsideProfile,
    taxResultLocked: true,
    version: TAX_READINESS_VERSION,
    review: TAX_READINESS_REVIEW,
  }
}

const validPayDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export type TaxReadinessCoverage = {
  year: string
  checkedSlips: Payslip[]
  pendingSlips: Payslip[]
  employerCount: number
  employerNames: string[]
}

export function taxReadinessCoverage(allSlips: Payslip[], year: string): TaxReadinessCoverage {
  if (year === 'all') return { year, checkedSlips: [], pendingSlips: [], employerCount: 0, employerNames: [] }

  const checkedSlips = allSlips.filter(slip => {
    if (!validPayDate(slip.facts.payDate) || financialYear(slip.facts.payDate) !== year) return false
    return slip.confirmed && confirmationIssues(slip, allSlips).length === 0
  })

  const pendingSlips = allSlips.filter(slip => {
    const couldBelong = !validPayDate(slip.facts.payDate) || financialYear(slip.facts.payDate) === year
    if (!couldBelong) return false
    return !slip.confirmed || confirmationIssues(slip, allSlips).length > 0
  })

  const employerMap = new Map<string, string>()
  for (const slip of checkedSlips) {
    const key = employerKey(slip.facts.employer)
    if (key) employerMap.set(key, slip.facts.employer.trim())
  }

  return {
    year,
    checkedSlips,
    pendingSlips,
    employerCount: employerMap.size,
    employerNames: [...employerMap.values()].sort((a, b) => a.localeCompare(b)),
  }
}

export const answerLabel = (answer: ReadinessAnswer) => ({
  '': 'Not answered',
  yes: 'Yes',
  no: 'No',
  unsure: 'Unsure',
}[answer])
