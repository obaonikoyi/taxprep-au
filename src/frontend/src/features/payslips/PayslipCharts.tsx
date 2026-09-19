import { useId, useState } from 'react'
import { aud, buckets, type Payslip } from './payslip'

type Series = { label: string; color: string; values: (number | null)[]; dashed?: boolean }
const dateLabel = (date: string) => new Date(`${date.length === 7 ? date + '-01' : date}T00:00:00Z`).toLocaleDateString('en-AU', { ...(date.length === 10 ? { day: 'numeric' as const } : {}), month: 'short', year: 'numeric', timeZone: 'UTC' })
const axisAmount = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100)

function Trend({ title, dates, series }: { title: string; dates: string[]; series: Series[] }) {
  const id = useId(), highest = Math.max(100, ...series.flatMap(s => s.values.filter(v => v !== null)))
  const x = (i: number) => dates.length === 1 ? 370 : 70 + i * 620 / (dates.length - 1)
  const y = (n: number) => 190 - n / highest * 155
  return <div className="pay-chart">
    <div className="pay-legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }} />{s.label}{s.dashed ? ' (dashed)' : ''}</span>)}</div>
    <svg viewBox="0 0 760 240" role="img" aria-labelledby={id}>
      <title id={id}>{title}. Exact values are in the table below.</title>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="70" x2="690" y1={y(highest * fraction)} y2={y(highest * fraction)} stroke="#dce6e0" /><text x="57" y={y(highest * fraction) + 4} textAnchor="end" fill="#50685c" fontSize="13">{axisAmount(highest * fraction)}</text></g>)}
      {series.map(s => <g key={s.label}>{s.values.map((v, i) => v === null ? null : <g key={i}>
        {i > 0 && s.values[i - 1] !== null && <line x1={x(i - 1)} y1={y(s.values[i - 1]!)} x2={x(i)} y2={y(v)} stroke={s.color} strokeWidth="3" strokeDasharray={s.dashed ? '7 5' : undefined} />}
        <circle cx={x(i)} cy={y(v)} r="4.5" fill={s.color}><title>{dateLabel(dates[i])}: {s.label} {aud(v)}</title></circle>
      </g>)}</g>)}
      <text x={x(0)} y="222" fill="#50685c" fontSize="13" textAnchor={dates.length === 1 ? 'middle' : 'start'}>{dateLabel(dates[0])}</text>
      {dates.length > 1 && <text x="690" y="222" textAnchor="end" fill="#50685c" fontSize="13">{dateLabel(dates.at(-1)!)}</text>}
    </svg>
  </div>
}
export default function PayslipCharts({ slips, grouping, onGrouping }: { slips: Payslip[]; grouping: 'payday' | 'month'; onGrouping: (value: 'payday' | 'month') => void }) {
  const [view, setView] = useState<'pay' | 'tax' | 'super'>('pay')
  const all = buckets(slips, grouping), data = all.slice(-24), dates = data.map(d => d.date)
  const series: Series[] = view === 'pay' ? [
    { label: 'Before deductions', color: '#17735a', values: data.map(d => d.gross) },
    { label: 'Take-home pay', color: '#536ba0', dashed: true, values: data.map(d => d.net) },
  ] : view === 'tax' ? [{ label: 'Tax taken out', color: '#a45d20', values: data.map(d => d.withheld) }] : [{ label: 'Super on payslips', color: '#536ba0', values: data.map(d => d.superKnown === d.count ? d.superCents : null) }]
  const title = view === 'pay' ? 'Your pay over time' : view === 'tax' ? 'Tax taken out over time' : 'Super recorded over time'
  return <section className="statement-panel pay-charts" aria-label="Pay charts">
    <div className="pay-chart-heading"><div><h3>{title}</h3><p>{view === 'pay' ? 'Compare what you earned with what you took home.' : view === 'tax' ? 'See the withholding recorded for each payment period.' : 'Amounts shown on your payslips, not confirmed payments to your fund.'}</p></div><label>Show by<select aria-label="Chart grouping" value={grouping} onChange={e => onGrouping(e.target.value as 'month' | 'payday')}><option value="month">Month</option><option value="payday">Payday</option></select></label></div>
    <div className="pay-chart-switch" role="group" aria-label="Choose a chart">{(['pay', 'tax', 'super'] as const).map((key, i) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{['Pay', 'Tax', 'Super'][i]}</button>)}</div>
    {series.every(s => s.values.every(value => value === null)) ? <p className="pay-empty-chart">No complete super amounts to chart yet. Add the missing amounts from your payslips if you have them.</p> : <Trend title={title} dates={dates} series={series} />}
    <p className="chart-note">{view === 'super' && data.some(d => d.superKnown !== d.count) ? 'There’s a gap where a payslip is missing a super amount. Missing does not mean zero. ' : ''}Only checked payslips are shown. Missing pay periods are not estimated.{all.length > 24 ? ' Showing the latest 24 points; all values are in the table.' : ''}</p>
    <details className="statement-help pay-chart-data"><summary>View exact chart figures</summary><div className="statement-table-wrap" tabIndex={0} role="region" aria-label="Exact chart figures"><table><caption>Checked pay by {grouping === 'month' ? 'month' : 'payday'}</caption><thead><tr><th scope="col">Paid</th><th scope="col">Before deductions</th><th scope="col">Take-home</th><th scope="col">Tax taken out</th><th scope="col">Tax / gross</th><th scope="col">Super</th></tr></thead><tbody>{all.map(d => <tr key={d.date}><th scope="row">{dateLabel(d.date)}</th><td>{aud(d.gross)}</td><td>{aud(d.net)}</td><td>{aud(d.withheld)}</td><td>{d.percentage === null ? '—' : `${d.percentage}%`}</td><td>{d.superKnown === d.count ? aud(d.superCents) : `Incomplete (${d.superKnown}/${d.count})`}</td></tr>)}</tbody></table></div></details>
  </section>
}
