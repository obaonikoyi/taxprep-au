import { useId } from 'react'
import { aud, buckets, type Payslip } from './payslip'
type Series = { label: string; color: string; values: (number | null)[] }
function Trend({ title, dates, series }: { title: string; dates: string[]; series: Series[] }) {
  const id = useId(), highest = Math.max(1, ...series.flatMap(s => s.values.filter(v => v !== null)))
  const x = (i: number) => 24 + i * 432 / Math.max(1, dates.length - 1)
  const y = (n: number) => 135 - n / highest * 110
  return <section className="statement-panel pay-chart"><div className="panel-heading"><h3>{title}</h3><span>Recorded figures</span></div>
    <div className="pay-legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    <svg viewBox="0 0 480 170" role="img" aria-labelledby={id}><title id={id}>{title}. Exact values are available in the chart data table below.</title>
      {[25, 80, 135].map(n => <line key={n} x1="24" x2="456" y1={n} y2={n} stroke="#e8eee9" />)}
      {series.map(s => <g key={s.label}>{s.values.map((v, i) => v === null ? null : <g key={i}>{i > 0 && s.values[i - 1] !== null && <line x1={x(i - 1)} y1={y(s.values[i - 1]!)} x2={x(i)} y2={y(v)} stroke={s.color} strokeWidth="2.5" />}<circle cx={x(i)} cy={y(v)} r="4" fill={s.color}><title>{dates[i]}: {s.label} {aud(v)}</title></circle></g>)}</g>)}
      <text x="24" y="160" fill="#63776f" fontSize="11">{dates[0]}</text><text x="456" y="160" textAnchor="end" fill="#63776f" fontSize="11">{dates.at(-1)}</text>
    </svg>
    <p className="chart-note">Peak shown: {aud(highest)}. Lines connect uploaded records; they do not fill missing periods.</p>
  </section>
}
export default function PayslipCharts({ slips, grouping }: { slips: Payslip[]; grouping: 'payday' | 'month' }) {
  const all = buckets(slips, grouping), data = all.slice(-24), dates = data.map(d => d.date)
  return <><div className="pay-charts">
    <Trend title="Earnings & take-home pay" dates={dates} series={[{ label: 'Gross', color: '#1f7658', values: data.map(d => d.gross) }, { label: 'Net', color: '#799b87', values: data.map(d => d.net) }]} />
    <Trend title="Tax withheld" dates={dates} series={[{ label: 'Withheld', color: '#ac7139', values: data.map(d => d.withheld) }]} />
    <Trend title="Super recorded" dates={dates} series={[{ label: 'Super', color: '#6277a0', values: data.map(d => d.superKnown === d.count ? d.superCents : null) }]} />
  </div><details className="statement-help"><summary>View exact chart figures</summary><p>By {grouping === 'month' ? 'payment month' : 'payment date'}. Charts show the latest 24 groups; the table includes all groups in the selected view. Unknown super breaks the chart line.</p><div className="statement-table-wrap"><table><thead><tr><th>Payment {grouping === 'month' ? 'month' : 'date'}</th><th>Gross</th><th>Net</th><th>Withheld</th><th>Withheld / gross</th><th>Super</th></tr></thead><tbody>{all.map(d => <tr key={d.date}><td>{d.date}</td><td>{aud(d.gross)}</td><td>{aud(d.net)}</td><td>{aud(d.withheld)}</td><td>{d.percentage === null ? '—' : `${d.percentage}%`}</td><td>{d.superKnown === d.count ? aud(d.superCents) : `Incomplete (${d.superKnown}/${d.count})`}</td></tr>)}</tbody></table></div></details></>
}
