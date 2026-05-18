import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import MyReportsDashboard from 'Modules/MyReports/MyReportsDashboard';
import 'Modules/MyReports/MyReportsDashboard.scss';
import 'Modules/MyReports/MyReports.scss';
import './trader-report.scss';

const BASE = /derivprofundedacademy\.com/.test(window.location.hostname)
    ? 'https://api.derivprofundedacademy.com/api'
    : 'http://localhost:8011/api';

const COLORS = { win: '#16a534', loss: '#ff444f', neutral: '#00a79e' };

type TimeFrame = 'day' | 'week' | 'month' | 'all';
type TAccountType = 'funded' | 'real';

type TProfile = {
    display_name: string;
    masked_id: string;
    deriv_loginid: string;
    avatar: string | null;
    country: string;
    account_type: string;
    qr_token: string;
    current_balance: number;
    start_balance: number;
    net_profit: number;
    profit_percent: number;
    bot_used: string;
    market_traded: string;
    total_trades: number;
    winning_trades: number;
    win_rate: number;
    joined_date: string;
};

type TTrade = {
    id: number;
    market: string;
    trade_type: string;
    stake: number;
    profit: number;
    result: 'win' | 'loss';
    balance_after: number;
    timestamp: string;
};

const ACCOUNT_LABEL: Record<string, string> = {
    real: 'Real Account',
    funded: 'Funded Account',
    marketing: 'Marketing Account',
};

const fmt_usd = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const filterByTimeFrame = (trades: TTrade[], tf: TimeFrame): TTrade[] => {
    if (tf === 'all') return trades;
    const now = new Date();
    const cutoff = new Date();
    if (tf === 'day') cutoff.setHours(0, 0, 0, 0);
    if (tf === 'week') cutoff.setDate(now.getDate() - 7);
    if (tf === 'month') cutoff.setDate(now.getDate() - 30);
    return trades.filter(t => new Date(t.timestamp) >= cutoff);
};

const buildEquityCurve = (trades: TTrade[], startBalance: number) => {
    let balance = startBalance;
    return [...trades]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(t => {
            balance += t.profit;
            return { time: new Date(t.timestamp).toLocaleDateString(), balance: parseFloat(balance.toFixed(2)) };
        });
};

const buildDailyPnL = (trades: TTrade[]) => {
    const map: Record<string, number> = {};
    trades.forEach(t => {
        const day = new Date(t.timestamp).toLocaleDateString();
        map[day] = (map[day] ?? 0) + t.profit;
    });
    return Object.entries(map)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([day, pnl]) => ({ day, pnl: parseFloat(pnl.toFixed(2)) }));
};

const ProgressBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className='mrd-progress'>
            <div className='mrd-progress__header'>
                <span className='mrd-progress__label'>{label}</span>
                <span className='mrd-progress__value' style={{ color }}>
                    ${value.toFixed(2)} / ${max.toFixed(2)}
                </span>
            </div>
            <div className='mrd-progress__track'>
                <div className='mrd-progress__fill' style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className='mrd-progress__pct'>{pct.toFixed(1)}%</span>
        </div>
    );
};

const StatCard = ({
    label,
    value,
    sub,
    highlight,
    color,
}: {
    label: string;
    value: string;
    sub?: string;
    highlight?: boolean;
    color?: string;
}) => (
    <div className={`mrd-stat${highlight ? ' mrd-stat--highlight' : ''}`}>
        <div className='mrd-stat__label'>{label}</div>
        <div className='mrd-stat__value' style={color ? { color } : undefined}>
            {value}
        </div>
        {sub && <div className='mrd-stat__sub'>{sub}</div>}
    </div>
);

// ── Funded Account Dashboard (DPA platform data) ───────────────────────────────
const FundedDashboard = ({ profile, allTrades }: { profile: TProfile; allTrades: TTrade[] }) => {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');
    const trades = useMemo(() => filterByTimeFrame(allTrades, timeFrame), [allTrades, timeFrame]);

    const stats = useMemo(() => {
        const wins = trades.filter(t => t.result === 'win').length;
        const losses = trades.filter(t => t.result === 'loss').length;
        const total = trades.length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const grossProfit = trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
        const grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));
        const netProfit = grossProfit - grossLoss;
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        const profits = trades.map(t => t.profit);
        const bestTrade = profits.length ? Math.max(...profits) : 0;
        const worstTrade = profits.length ? Math.min(...profits) : 0;
        let streak = 0,
            streakType = '';
        for (let i = 0; i < trades.length; i++) {
            if (i === 0) {
                streak = 1;
                streakType = trades[i].result;
            } else if (trades[i].result === streakType) streak++;
            else break;
        }
        return {
            wins,
            losses,
            total,
            winRate,
            netProfit,
            avgWin,
            avgLoss,
            profitFactor,
            bestTrade,
            worstTrade,
            streak,
            streakType,
        };
    }, [trades]);

    const equityCurve = useMemo(() => buildEquityCurve(trades, profile.start_balance), [trades, profile]);
    const dailyPnL = useMemo(() => buildDailyPnL(trades), [trades]);
    const donutData = useMemo(
        () => [
            { name: 'Wins', value: stats.wins },
            { name: 'Losses', value: stats.losses },
        ],
        [stats]
    );

    const profitTarget = profile.start_balance * 0.15;
    const dailyLossLimit = profile.start_balance * 0.05;
    const maxDrawdownLimit = profile.start_balance * 0.1;
    const todayLoss = Math.abs(
        trades
            .filter(t => new Date(t.timestamp).toDateString() === new Date().toDateString() && t.profit < 0)
            .reduce((s, t) => s + t.profit, 0)
    );
    const drawdown = Math.max(0, profile.start_balance - profile.current_balance);

    return (
        <div className='mrd'>
            {/* Balance header */}
            <div className='mrd-header'>
                <div>
                    <span className='mrd-header__balance-label'>Funded Account</span>
                    <span className='mrd-header__balance-value'>{fmt_usd(profile.current_balance)}</span>
                    <div className='mrd-header__balance-sub'>
                        Starting: {fmt_usd(profile.start_balance)}&nbsp;|&nbsp;P&amp;L:&nbsp;
                        <span style={{ color: profile.net_profit >= 0 ? COLORS.win : COLORS.loss, fontWeight: 600 }}>
                            {profile.net_profit >= 0 ? '+' : ''}
                            {fmt_usd(profile.net_profit)}
                        </span>
                        &nbsp;({profile.profit_percent >= 0 ? '+' : ''}
                        {profile.profit_percent}%)
                    </div>
                </div>
                <div className='mrd-timeframe'>
                    {(['day', 'week', 'month', 'all'] as TimeFrame[]).map(tf => (
                        <button
                            key={tf}
                            className={`mrd-timeframe__btn${timeFrame === tf ? ' mrd-timeframe__btn--active' : ''}`}
                            onClick={() => setTimeFrame(tf)}
                        >
                            {tf === 'day' ? 'Today' : tf === 'week' ? 'Week' : tf === 'month' ? 'Month' : 'All Time'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Challenge targets */}
            {profile.account_type === 'funded' && (
                <div className='mrd-targets'>
                    <h3 className='mrd-targets__title'>Challenge Targets</h3>
                    <div className='mrd-targets__grid'>
                        <ProgressBar
                            label='Profit Target (15%)'
                            value={Math.max(0, stats.netProfit)}
                            max={profitTarget}
                            color={COLORS.win}
                        />
                        <ProgressBar
                            label='Daily Loss Used (5% limit)'
                            value={todayLoss}
                            max={dailyLossLimit}
                            color={todayLoss > dailyLossLimit * 0.8 ? COLORS.loss : '#f59e0b'}
                        />
                        <ProgressBar
                            label='Max Drawdown (10% limit)'
                            value={drawdown}
                            max={maxDrawdownLimit}
                            color={drawdown > maxDrawdownLimit * 0.8 ? COLORS.loss : '#f59e0b'}
                        />
                    </div>
                </div>
            )}

            {trades.length === 0 ? (
                <div className='mrd-empty'>
                    <p style={{ fontWeight: 600 }}>No trades in this period</p>
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className='mrd-stats'>
                        <StatCard
                            label='Net Profit / Loss'
                            value={`${stats.netProfit >= 0 ? '+' : ''}${fmt_usd(stats.netProfit)}`}
                            color={stats.netProfit >= 0 ? COLORS.win : COLORS.loss}
                            highlight
                        />
                        <StatCard label='Total Trades' value={String(stats.total)} />
                        <StatCard
                            label='Win Rate'
                            value={`${stats.winRate.toFixed(1)}%`}
                            color={stats.winRate >= 50 ? COLORS.win : COLORS.loss}
                        />
                        <StatCard label='Wins' value={String(stats.wins)} color={COLORS.win} />
                        <StatCard label='Losses' value={String(stats.losses)} color={COLORS.loss} />
                        <StatCard
                            label='Profit Factor'
                            value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}
                        />
                        <StatCard label='Avg Win' value={fmt_usd(stats.avgWin)} color={COLORS.win} />
                        <StatCard label='Avg Loss' value={fmt_usd(stats.avgLoss)} color={COLORS.loss} />
                        <StatCard label='Best Trade' value={fmt_usd(stats.bestTrade)} color={COLORS.win} />
                        <StatCard label='Worst Trade' value={fmt_usd(stats.worstTrade)} color={COLORS.loss} />
                        {profile.bot_used && <StatCard label='Bot Used' value={profile.bot_used} />}
                        {profile.market_traded && <StatCard label='Primary Market' value={profile.market_traded} />}
                        {stats.streak > 0 && (
                            <StatCard
                                label='Current Streak'
                                value={`${stats.streak} ${stats.streakType === 'win' ? 'W' : 'L'}`}
                                color={stats.streakType === 'win' ? COLORS.win : COLORS.loss}
                            />
                        )}
                    </div>

                    {/* Charts */}
                    <div className='mrd-charts'>
                        <div className='mrd-chart-card mrd-chart-card--full'>
                            <h3 className='mrd-chart-card__title'>Equity Curve</h3>
                            <ResponsiveContainer width='100%' height={260}>
                                <LineChart data={equityCurve} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                                    <XAxis dataKey='time' tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v: any) => [`$${v}`, 'Balance']} />
                                    <Line
                                        type='monotone'
                                        dataKey='balance'
                                        stroke={COLORS.neutral}
                                        strokeWidth={2.5}
                                        dot={equityCurve.length <= 30}
                                        animationDuration={800}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className='mrd-chart-card'>
                            <h3 className='mrd-chart-card__title'>Daily P&amp;L</h3>
                            <ResponsiveContainer width='100%' height={260}>
                                <BarChart data={dailyPnL} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                                    <XAxis dataKey='day' tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v: any) => [`$${v}`, 'P&L']} />
                                    <Bar dataKey='pnl' animationDuration={800} radius={[4, 4, 0, 0]}>
                                        {dailyPnL.map((entry, i) => (
                                            <Cell key={i} fill={entry.pnl >= 0 ? COLORS.win : COLORS.loss} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className='mrd-chart-card'>
                            <h3 className='mrd-chart-card__title'>Win / Loss Split</h3>
                            <ResponsiveContainer width='100%' height={260}>
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx='50%'
                                        cy='50%'
                                        innerRadius={70}
                                        outerRadius={100}
                                        dataKey='value'
                                        animationDuration={800}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        <Cell fill={COLORS.win} />
                                        <Cell fill={COLORS.loss} />
                                    </Pie>
                                    <Legend />
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Trade history */}
                    <div className='mrd-table-wrap'>
                        <div className='mrd-table-wrap__header'>
                            <h3>Trade History</h3>
                            <span style={{ color: '#666', fontSize: '13px' }}>{trades.length} trades</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className='mrd-table'>
                                <thead>
                                    <tr>
                                        <th>Date &amp; Time</th>
                                        <th>Market</th>
                                        <th>Type</th>
                                        <th>Stake</th>
                                        <th>P&amp;L</th>
                                        <th>Balance</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map(t => (
                                        <tr key={t.id}>
                                            <td>{new Date(t.timestamp).toLocaleString()}</td>
                                            <td>{t.market}</td>
                                            <td>{t.trade_type}</td>
                                            <td>{fmt_usd(t.stake)}</td>
                                            <td
                                                style={{
                                                    color: t.profit >= 0 ? COLORS.win : COLORS.loss,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {t.profit >= 0 ? '+' : ''}
                                                {fmt_usd(t.profit)}
                                            </td>
                                            <td>{fmt_usd(t.balance_after)}</td>
                                            <td>
                                                <span className={`mrd-badge mrd-badge--${t.result}`}>
                                                    {t.result === 'win' ? 'WIN' : 'LOSS'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className='tr-disclaimer'>
                        <i className='ti ti-shield-check' />
                        This report only reflects trades executed through the DerivPro Academy platform. Past
                        performance does not guarantee future results.
                    </div>
                </>
            )}
        </div>
    );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const TraderReportPage = () => {
    const { token } = useParams<{ token: string }>();
    const location = useLocation();
    const source = new URLSearchParams(location.search).get('source');

    const [profile, setProfile] = useState<TProfile | null>(null);
    const [allTrades, setAllTrades] = useState<TTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [accountType, setAccountType] = useState<TAccountType>('funded');

    useEffect(() => {
        if (!token) return;
        fetch(`${BASE}/trader-profiles/${token}/`)
            .then(r => {
                if (r.status === 403) throw new Error('private');
                if (!r.ok) throw new Error('not_found');
                return r.json();
            })
            .then(async (p: TProfile) => {
                setProfile(p);
                // Fetch all trade pages for the funded dashboard
                let page = 1,
                    collected: TTrade[] = [];
                while (true) {
                    const r = await fetch(`${BASE}/trader-profiles/${token}/trades/?page=${page}&limit=100`);
                    const d = await r.json();
                    collected = collected.concat(d.results ?? []);
                    if (page >= (d.pages ?? 1)) break;
                    page++;
                }
                setAllTrades(collected);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));

        if (source === 'qr') {
            fetch(`${BASE}/trader-profiles/${token}/scan/`, { method: 'POST' }).catch(() => {});
        }
    }, [token, source]);

    const handle_copy = () => {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading)
        return (
            <div className='mrd-loading' style={{ padding: '80px 24px', textAlign: 'center' }}>
                <div className='tr-spinner' />
                <p style={{ marginTop: 16, color: '#666' }}>Loading trader profile…</p>
            </div>
        );

    if (error === 'private')
        return (
            <div className='mrd-empty' style={{ padding: '80px 24px' }}>
                <i className='ti ti-lock' style={{ fontSize: 48, color: '#ccc' }} />
                <h2 style={{ margin: '16px 0 8px' }}>Profile is Private</h2>
                <p style={{ color: '#666' }}>This trader has chosen to keep their report private.</p>
            </div>
        );

    if (error || !profile)
        return (
            <div className='mrd-empty' style={{ padding: '80px 24px' }}>
                <i className='ti ti-alert-circle' style={{ fontSize: 48, color: '#ff444f' }} />
                <h2 style={{ margin: '16px 0 8px' }}>Profile Not Found</h2>
                <p style={{ color: '#666' }}>The link may be invalid or has been removed.</p>
            </div>
        );

    return (
        <div className='my-reports__container'>
            {/* ── Identity card ─────────────────────────────────────────────── */}
            <div className='tr-identity-card'>
                <div className='tr-identity-card__left'>
                    {profile.avatar ? (
                        <img src={profile.avatar} alt={profile.display_name} className='tr-identity-card__avatar' />
                    ) : (
                        <div className='tr-identity-card__avatar tr-identity-card__avatar--initials'>
                            {profile.display_name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className='tr-identity-card__name'>{profile.display_name}</h1>
                        <div className='tr-identity-card__meta'>
                            <span className='tr-identity-card__id'>{profile.masked_id}</span>
                            <span className={`tr-badge tr-badge--${profile.account_type}`}>
                                {ACCOUNT_LABEL[profile.account_type] ?? profile.account_type}
                            </span>
                            {profile.country && (
                                <span className='tr-identity-card__country'>
                                    <i className='ti ti-map-pin' /> {profile.country}
                                </span>
                            )}
                            <span className='tr-identity-card__joined'>
                                <i className='ti ti-calendar' /> Since{' '}
                                {new Date(profile.joined_date).toLocaleDateString('en-US', {
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </span>
                        </div>
                    </div>
                </div>
                <div className='tr-identity-card__right'>
                    <div className='tr-verified'>
                        <i className='ti ti-shield-check' />
                        <span>Verified by DerivPro Academy</span>
                    </div>
                    <button className='tr-copy-btn' onClick={handle_copy}>
                        <i className={`ti ti-${copied ? 'check' : 'link'}`} />
                        {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                </div>
            </div>

            {/* ── Tab switcher ──────────────────────────────────────────────── */}
            <div className='my-reports__header'>
                <div className='my-reports__account-selector'>
                    <button
                        className={`my-reports__tab${accountType === 'funded' ? ' my-reports__tab--active' : ''}`}
                        onClick={() => setAccountType('funded')}
                    >
                        Funded Account Analytics
                    </button>
                    <button
                        className={`my-reports__tab${accountType === 'real' ? ' my-reports__tab--active' : ''}`}
                        onClick={() => setAccountType('real')}
                    >
                        Real Account Analytics
                    </button>
                </div>
            </div>

            {/* ── Funded tab — DPA platform data ────────────────────────────── */}
            {accountType === 'funded' && <FundedDashboard profile={profile} allTrades={allTrades} />}

            {/* ── Real Account tab — Supabase data via MyReportsDashboard ───── */}
            {accountType === 'real' &&
                (profile.deriv_loginid ? (
                    <MyReportsDashboard accountType='real' loginid={profile.deriv_loginid} />
                ) : (
                    <div className='mrd-empty'>
                        <i
                            className='ti ti-link-off'
                            style={{ fontSize: 40, color: '#ccc', display: 'block', marginBottom: 12 }}
                        />
                        <p style={{ fontWeight: 600, color: '#555' }}>Real account not linked yet</p>
                        <p style={{ color: '#999', marginTop: 8, fontSize: 13 }}>
                            This trader's Deriv account hasn't been connected to their profile.
                        </p>
                    </div>
                ))}
        </div>
    );
};

export default TraderReportPage;
