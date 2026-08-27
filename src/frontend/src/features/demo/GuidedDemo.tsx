import { useState } from 'react'
import { demoProfile, demoQuestions, type DemoQuestion } from './demoData'

type DemoStep = 'welcome' | 'income' | 'questions' | 'summary'
type Answer = 'yes' | 'no'
type Answers = Partial<Record<DemoQuestion['id'], Answer>>

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

function GuidedDemo() {
  const [step, setStep] = useState<DemoStep>('welcome')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})

  const currentQuestion = demoQuestions[questionIndex]
  const answeredCount = Object.keys(answers).length

  function answerQuestion(answer: Answer) {
    const nextAnswers = { ...answers, [currentQuestion.id]: answer }
    setAnswers(nextAnswers)

    if (questionIndex === demoQuestions.length - 1) {
      setStep('summary')
      return
    }

    setQuestionIndex((current) => current + 1)
  }

  function restartDemo() {
    setStep('welcome')
    setQuestionIndex(0)
    setAnswers({})
  }

  return (
    <section className="demo" id="guided-demo" aria-labelledby="demo-title">
      <div className="demo-heading">
        <div>
          <p className="eyebrow">Interactive portfolio demo</p>
          <h2 id="demo-title">Prepare a simple return in minutes.</h2>
        </div>
        <span className="demo-badge">Fictional data</span>
      </div>

      <div className="demo-shell">
        <aside className="demo-sidebar" aria-label="Demo progress">
          <p className="sidebar-label">Preparation journey</p>
          <ol>
            <li className={step === 'welcome' ? 'active' : ''}>Start demo</li>
            <li className={step === 'income' ? 'active' : ''}>Confirm income</li>
            <li className={step === 'questions' ? 'active' : ''}>Work expenses</li>
            <li className={step === 'summary' ? 'active' : ''}>Review summary</li>
          </ol>
          <p className="privacy-note">No TFN, myGov login or real financial information is collected.</p>
        </aside>

        <div className="demo-content" aria-live="polite">
          {step === 'welcome' && (
            <div>
              <p className="step-label">Step 1 of 4</p>
              <h3>Meet {demoProfile.name}</h3>
              <p className="lead">Try TaxPrep AU using a ready-made, fictional profile. No signup or personal details required.</p>
              <dl className="profile-grid">
                <div><dt>Occupation</dt><dd>{demoProfile.occupation}</dd></div>
                <div><dt>Financial year</dt><dd>{demoProfile.financialYear}</dd></div>
              </dl>
              <button className="primary-button" type="button" onClick={() => setStep('income')}>Try demo</button>
            </div>
          )}

          {step === 'income' && (
            <div>
              <p className="step-label">Step 2 of 4</p>
              <h3>Confirm Sarah’s income</h3>
              <p className="lead">A future version could import pre-fill information. This portfolio demo uses safe sample values.</p>
              <div className="income-grid">
                <div><span>Employment income</span><strong>{currency.format(demoProfile.employmentIncome)}</strong></div>
                <div><span>Tax withheld</span><strong>{currency.format(demoProfile.taxWithheld)}</strong></div>
              </div>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => setStep('welcome')}>Back</button>
                <button className="primary-button" type="button" onClick={() => setStep('questions')}>Information is correct</button>
              </div>
            </div>
          )}

          {step === 'questions' && currentQuestion && (
            <div>
              <p className="step-label">Question {questionIndex + 1} of {demoQuestions.length}</p>
              <div className="progress-track" aria-label={`${answeredCount} of ${demoQuestions.length} questions answered`}>
                <span style={{ width: `${(questionIndex / demoQuestions.length) * 100}%` }} />
              </div>
              <h3>{currentQuestion.title}</h3>
              <p className="lead">{currentQuestion.description}</p>
              <div className="answer-grid">
                <button type="button" onClick={() => answerQuestion('yes')}><strong>Yes</strong><span>Show relevant preparation items</span></button>
                <button type="button" onClick={() => answerQuestion('no')}><strong>No</strong><span>Skip this expense category</span></button>
              </div>
            </div>
          )}

          {step === 'summary' && (
            <div>
              <p className="step-label">Step 4 of 4</p>
              <h3>Sarah’s preparation summary</h3>
              <p className="lead">The demo found the categories below. These are preparation prompts, not approved tax claims.</p>
              <div className="summary-list">
                {demoQuestions.map((question) => (
                  <article key={question.id}>
                    <div><strong>{question.title.replace('Did Sarah ', '').replace('?', '')}</strong><p>{question.description}</p></div>
                    <span className={`result result--${answers[question.id]}`}>{answers[question.id] === 'yes' ? 'Review details' : 'Not applicable'}</span>
                  </article>
                ))}
              </div>
              <aside className="next-action"><strong>Next milestone</strong><p>Add amounts and evidence to every item marked “Review details”.</p></aside>
              <button className="secondary-button" type="button" onClick={restartDemo}>Restart demo</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default GuidedDemo

