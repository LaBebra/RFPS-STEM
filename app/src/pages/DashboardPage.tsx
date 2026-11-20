import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RunControl } from '../components/RunControl';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, KpiCard, PageHeader } from '../components/ui';
import { formatDateTime, formatDuration } from '../lib/format';
import { buildTrend, restrictToSuite, runsInPeriod, summarize, topFailing } from '../lib/stats';
import { useDocumentTitle, useReducedMotion } from '../hooks';
import { useAppStore } from '../store/useAppStore';

/** Кольори статусів (статусна палітра: завжди разом з підписом/легендою). */
export const STATUS_COLORS = {
  passed: 'var(--st-good)',
  failed: 'var(--st-critical)',
  error: 'var(--st-serious)',
  timeout: 'var(--st-warning)',
  skipped: 'var(--st-neutral)',
};

const SERIES = [
  { key: 'passed', name: 'Пройдено' },
  { key: 'failed', name: 'Провалено' },
  { key: 'error', name: 'Помилки' },
  { key: 'timeout', name: 'Тайм-аути' },
  { key: 'skipped', name: 'Пропущено' },
] as const;

const PERIODS = [
  { value: 7, label: '7 днів' },
  { value: 30, label: '30 днів' },
  { value: 0, label: 'Увесь час' },
];

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip__title">Прогін {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="chart-tip__row">
          <span className="chart-tip__swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <b>
            {p.value}
            {unit}
          </b>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Дашборд');
  const { runs, suites, cases } = useAppStore();
  const animate = !useReducedMotion();
  const [period, setPeriod] = useState(30);
  const [suiteId, setSuiteId] = useState<string>('all');

  const scoped = useMemo(() => restrictToSuite(runsInPeriod(runs, period), suiteId), [runs, period, suiteId]);
  const finished = useMemo(() => scoped.filter((r) => r.status !== 'running'), [scoped]);
  const trend = useMemo(() => buildTrend(finished, 15), [finished]);
  const failing = useMemo(() => topFailing(finished, 5), [finished]);
  const last = finished[0];
  const lastSummary = last ? summarize(last.results) : null;
  const avgPass = trend.length ? Math.round((trend.reduce((s, p) => s + p.passRate, 0) / trend.length) * 10) / 10 : 0;
  const avgDuration = trend.length ? trend.reduce((s, p) => s + p.durationMs, 0) / trend.length : 0;
  const enabledIds = cases.filter((c) => c.enabled && (suiteId === 'all' || c.suiteId === suiteId)).map((c) => c.id);

  const pieData = lastSummary
    ? SERIES.map((s) => ({ name: s.name, key: s.key, value: s.key === 'skipped' ? lastSummary.skipped + lastSummary.cancelled : lastSummary[s.key] })).filter(
        (d) => d.value > 0,
      )
    : [];

  return (
    <>
      <PageHeader
        title="Дашборд"
        subtitle="Загальний стан якості та динаміка автоматизованих прогонів"
        actions={<RunControl caseIds={enabledIds} title={suiteId === 'all' ? 'Повний прогін усіх наборів' : `Прогін: ${suites.find((s) => s.id === suiteId)?.name}`} scope={suiteId === 'all' ? 'all' : 'suite'} label="Запустити всі тести" navigateOnStart />}
      />

      <div className="filters" role="group" aria-label="Фільтри дашборду">
        <div className="segmented" role="radiogroup" aria-label="Період">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" role="radio" aria-checked={period === p.value} className={period === p.value ? 'is-active' : ''} onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="inline-field">
          <span>Набір</span>
          <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
            <option value="all">Усі набори</option>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="kpi-grid" aria-label="Ключові показники">
        <KpiCard label="Тест-кейсів" value={suiteId === 'all' ? cases.length : cases.filter((c) => c.suiteId === suiteId).length} hint={`у ${suiteId === 'all' ? suites.length : 1} наборах`} />
        <KpiCard label="Прогонів за період" value={finished.length} hint={last ? `останній ${formatDateTime(last.startedAt)}` : 'ще не було'} />
        <KpiCard
          label="Успішність останнього"
          value={lastSummary ? `${lastSummary.passRate}%` : '-'}
          hint={lastSummary ? `${lastSummary.passed} з ${lastSummary.total} пройдено` : undefined}
          tone={lastSummary ? (lastSummary.passRate >= 90 ? 'good' : 'bad') : undefined}
        />
        <KpiCard label="Середня успішність" value={trend.length ? `${avgPass}%` : '-'} hint={`за ${trend.length} прогонів`} />
        <KpiCard label="Середня тривалість" value={formatDuration(avgDuration)} hint="сумарний час тестів" />
      </section>

      {finished.length === 0 ? (
        <EmptyState icon="runs" title="Немає даних за обраний період" text="Запустіть прогін або змініть фільтри, щоб побачити аналітику." />
      ) : (
        <div className="dash-grid">
          <figure className="card chart-card chart-card--wide">
            <figcaption>
              <h2>Динаміка успішності, %</h2>
              <p className="muted">Частка пройдених тестів у кожному з останніх {trend.length} прогонів</p>
            </figcaption>
            <div className="chart-box" role="img" aria-label={`Графік успішності: від ${trend[0]?.passRate}% до ${trend[trend.length - 1]?.passRate}%`}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={trend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="passFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: 'var(--axis)' }} />
                  <Area isAnimationActive={animate} type="monotone" dataKey="passRate" name="Успішність" stroke="var(--series-1)" strokeWidth={2} fill="url(#passFill)" dot={{ r: 3, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>

          <figure className="card chart-card">
            <figcaption>
              <h2>Результати останнього прогону</h2>
              <p className="muted">{last && formatDateTime(last.startedAt)}</p>
            </figcaption>
            <div className="chart-box donut" role="img" aria-label={pieData.map((d) => `${d.name}: ${d.value}`).join(', ')}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie isAnimationActive={animate} data={pieData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut__center" aria-hidden="true">
                <b>{lastSummary?.passRate}%</b>
                <span>успішність</span>
              </div>
            </div>
            <ul className="legend">
              {pieData.map((d) => (
                <li key={d.key}>
                  <span className="legend__swatch" style={{ background: STATUS_COLORS[d.key] }} />
                  {d.name} <b>{d.value}</b>
                </li>
              ))}
            </ul>
          </figure>

          <figure className="card chart-card chart-card--wide">
            <figcaption>
              <h2>Розподіл результатів за прогонами</h2>
              <p className="muted">Кількість тест-кейсів за статусами</p>
            </figcaption>
            <div className="chart-box" role="img" aria-label="Стовпчикова діаграма результатів за прогонами">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover)' }} />
                  <Legend wrapperStyle={{ fontSize: 13, color: 'var(--text-muted)' }} iconType="circle" iconSize={9} />
                  {SERIES.map((s, i) => (
                    <Bar isAnimationActive={animate} key={s.key} dataKey={s.key} name={s.name} stackId="r" fill={STATUS_COLORS[s.key]} stroke="var(--surface)" strokeWidth={1} radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>

          <section className="card">
            <h2>Проблемні тест-кейси</h2>
            {failing.length === 0 ? (
              <p className="muted">Падінь за обраний період немає.</p>
            ) : (
              <ol className="rank-list">
                {failing.map((f) => (
                  <li key={f.caseId}>
                    <div>
                      <b>{f.title}</b>
                      <small className="muted">
                        {f.suiteName} · {f.failures} з {f.executions} прогонів
                        {f.flaky && <span className="tag tag--warn">flaky</span>}
                      </small>
                    </div>
                    <span className="rank-list__value">{f.failRate}%</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card card--wide-all">
            <div className="card__head">
              <h2>Останні прогони</h2>
              <Link to="/runs" className="link-sm">
                Увесь журнал
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <thead>
                  <tr>
                    <th scope="col">Прогін</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Результат</th>
                    <th scope="col">Тривалість</th>
                    <th scope="col">Запущено</th>
                  </tr>
                </thead>
                <tbody>
                  {scoped.slice(0, 5).map((r) => {
                    const s = summarize(r.results);
                    return (
                      <tr key={r.id}>
                        <td data-label="Прогін">
                          <Link to={`/runs/${r.id}`}>{r.title}</Link>
                        </td>
                        <td data-label="Статус">
                          <StatusBadge status={r.status} kind="run" />
                        </td>
                        <td data-label="Результат">
                          {s.passed}/{s.total} ({s.passRate}%)
                        </td>
                        <td data-label="Тривалість">{formatDuration(s.durationMs)}</td>
                        <td data-label="Запущено">{formatDateTime(r.startedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
