import React, { useState, useEffect, useMemo } from 'react';
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
import { getUserTradesByAccountType, getParticipant, supabase } from 'Services/supabase';
import './MyReportsDashboard.scss';

type AccountType = 'funded' | 'real';
type TimeFrame = 'day' | 'week' | 'month' | 'all';

interface MyReportsDashboardProps {
    accountType: AccountType;
    loginid: string;
}

interface Trade {
    id: string;
    timestamp: string;
    asset: string;
    tradeType: string;
    profit: number;
    status: 'win' | 'loss';
    stake: number;
    payout: number;
}

interface FundedMeta {
    balance: number;
    initial_balance: number;
}

const COLORS = { win: '#16a534', loss: '#ff444f', neutral: '#00a79e' };

// ── Get funded balance from database (challenge_participants table) ──
const loadFundedMeta = async (loginid: string): Promise<FundedMeta> => {
    try {
        const participant = await getParticipant(loginid);
        if (!participant) return { balance: 0, initial_balance: 0 };
        return {
            balance: participant.current_balance ?? 0,
            initial_balance: participant.start_balance ?? 0,
        };
    } catch {
        return { balance: 0, initial_balance: 0 };
    }
};

const filterByTimeFrame = (trades: Trade[], tf: TimeFrame): Trade[] => {
    if (tf === 'all') return trades;
    const now = new Date();
    const cutoff = new Date();
    if (tf === 'day') cutoff.setHours(0, 0, 0, 0);
    if (tf === 'week') cutoff.setDate(now.getDate() - 7);
    if (tf === 'month') cutoff.setDate(now.getDate() - 30);
    return trades.filter(t => new Date(t.timestamp) >= cutoff);
};

const buildEquityCurve = (trades: Trade[], startBalance: number) => {
    let balance = startBalance;
    return trades
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(t => {
            balance += t.profit;
            return {
                time: new Date(t.timestamp).toLocaleDateString(),
                balance: parseFloat(balance.toFixed(2)),
            };
        });
};

const buildDailyPnL = (trades: Trade[]) => {
    const map: Record<string, number> = {};
    trades.forEach(t => {
        const day = new Date(t.timestamp).toLocaleDateString();
        map[day] = (map[day] ?? 0) + t.profit;
    });
    return Object.entries(map)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([day, pnl]) => ({ day, pnl: parseFloat(pnl.toFixed(2)) }));
};

// ── Progress Bar ───────────────────────────────────────────────────────────────
const ProgressBar = ({
    label,
    value,
    max,
    color,
    suffix = '$',
}: {
    label: string;
    value: number;
    max: number;
    color: string;
    suffix?: string;
}) => {
    const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className='mrd-progress'>
            <div className='mrd-progress__header'>
                <span className='mrd-progress__label'>{label}</span>
                <span className='mrd-progress__value' style={{ color }}>
                    {suffix}
                    {value.toFixed(2)} / {suffix}
                    {max.toFixed(2)}
                </span>
            </div>
            <div className='mrd-progress__track'>
                <div className='mrd-progress__fill' style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className='mrd-progress__pct'>{pct.toFixed(1)}%</span>
        </div>
    );
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
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

// ── Main Component ─────────────────────────────────────────────────────────────
const MyReportsDashboard = ({ accountType, loginid }: MyReportsDashboardProps) => {
    const [allTrades, setAllTrades] = useState<Trade[]>([]);
    const [fundedMeta, setFundedMeta] = useState<FundedMeta>({ balance: 0, initial_balance: 0 });
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const rowToTrade = (r: any): Trade => ({
        id: r.contract_id ?? String(r.id ?? Math.random()),
        timestamp: r.created_at ?? new Date().toISOString(),
        asset: r.market ?? r.symbol ?? 'Unknown',
        tradeType: r.trade_type ?? r.contract_type ?? 'Unknown',
        profit: typeof r.profit === 'number' ? r.profit : parseFloat(r.profit ?? '0') || 0,
        status: r.is_win ? 'win' : 'loss',
        stake: typeof r.stake === 'number' ? r.stake : parseFloat(r.stake ?? '0') || 0,
        payout: typeof r.payout === 'number' ? r.payout : parseFloat(r.payout ?? '0') || 0,
    });

    useEffect(() => {
        let cancelled = false;

        // ── Initial load ────────────────────────────────────────────────────────
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (accountType === 'funded') {
                    const meta = await loadFundedMeta(loginid);
                    if (!cancelled) setFundedMeta(meta);
                }
                const rows = await getUserTradesByAccountType(loginid, accountType);
                if (!cancelled) setAllTrades((rows ?? []).map(rowToTrade));
            } catch (err: any) {
                if (!cancelled) setError(err?.message ?? 'Failed to load trades');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchData();

        // ── Real-time subscription — new trades appear instantly ────────────────
        const channel = supabase
            .channel(`bot_trades_${loginid}_${accountType}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'bot_trades',
                    filter: `deriv_loginid=eq.${loginid}`,
                },
                (payload: any) => {
                    const newRow = payload.new;
                    if (newRow.account_type !== accountType) return;
                    // Prepend new trade (newest first)
                    setAllTrades(prev => [rowToTrade(newRow), ...prev]);
                    // Refresh balance for funded account
                    if (accountType === 'funded') {
                        loadFundedMeta(loginid).then(meta => {
                            if (!cancelled) setFundedMeta(meta);
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [accountType, loginid]);

    const trades = useMemo(() => filterByTimeFrame(allTrades, timeFrame), [allTrades, timeFrame]);

    const stats = useMemo(() => {
        const wins = trades.filter(t => t.status === 'win').length;
        const losses = trades.filter(t => t.status === 'loss').length;
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

        let streak = 0;
        let streakType = '';
        for (let i = 0; i < trades.length; i++) {
            if (i === 0) {
                streak = 1;
                streakType = trades[i].status;
            } else if (trades[i].status === streakType) streak++;
            else break;
        }

        return {
            wins,
            losses,
            total,
            winRate,
            grossProfit,
            grossLoss,
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

    const startBalance = accountType === 'funded' ? fundedMeta.initial_balance : 0;
    const equityCurve = useMemo(() => buildEquityCurve(trades, startBalance), [trades, startBalance]);
    const dailyPnL = useMemo(() => buildDailyPnL(trades), [trades]);
    const donutData = useMemo(
        () => [
            { name: 'Wins', value: stats.wins },
            { name: 'Losses', value: stats.losses },
        ],
        [stats]
    );

    // Funded challenge targets
    const profitTarget = fundedMeta.initial_balance * 0.15;
    const dailyLossLimit = fundedMeta.initial_balance * 0.05;
    const maxDrawdownLimit = fundedMeta.initial_balance * 0.1;
    const pnlVsTarget = Math.max(0, stats.netProfit);
    const todayLoss = Math.abs(
        trades
            .filter(t => {
                const d = new Date(t.timestamp);
                return d.toDateString() === new Date().toDateString() && t.profit < 0;
            })
            .reduce((s, t) => s + t.profit, 0)
    );
    const drawdown = Math.max(0, fundedMeta.initial_balance - fundedMeta.balance);

    if (isLoading)
        return (
            <div className='mrd-loading'>
                <p>Loading your trades...</p>
            </div>
        );
    if (error)
        return (
            <div className='mrd-loading'>
                <p style={{ color: '#ff444f' }}>Error: {error}</p>
            </div>
        );

    return (
        <div className='mrd'>
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className='mrd-header'>
                <div>
                    <span className='mrd-header__balance-label'>
                        {accountType === 'funded' ? 'Funded Balance' : 'Real Account'}
                    </span>
                    {accountType === 'funded' ? (
                        <>
                            <span className='mrd-header__balance-value'>
                                $
                                {fundedMeta.balance.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </span>
                            <div className='mrd-header__balance-sub'>
                                Starting: ${fundedMeta.initial_balance.toLocaleString()} &nbsp;|&nbsp; P&L:&nbsp;
                                <span
                                    style={{ color: stats.netProfit >= 0 ? COLORS.win : COLORS.loss, fontWeight: 600 }}
                                >
                                    {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <span className='mrd-header__balance-value' style={{ fontSize: '20px' }}>
                            {stats.total} trades recorded
                        </span>
                    )}
                </div>

                {/* Time Frame Filter */}
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

            {/* ── Progress Targets (Funded only) ──────────────────────────────── */}
            {accountType === 'funded' && fundedMeta.initial_balance > 0 && (
                <div className='mrd-targets'>
                    <h3 className='mrd-targets__title'>Challenge Targets</h3>
                    <div className='mrd-targets__grid'>
                        <ProgressBar
                            label='Profit Target (15%)'
                            value={pnlVsTarget}
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

            {/* ── No trades state ─────────────────────────────────────────────── */}
            {trades.length === 0 ? (
                <div className='mrd-empty'>
                    <p style={{ fontWeight: 'bold', fontSize: '16px' }}>No trades in this period</p>
                    <p style={{ color: '#666', marginTop: '8px' }}>
                        {accountType === 'funded'
                            ? 'Start trading in funded mode to see your reports.'
                            : 'Run a bot or use SuperBots to record real account trades.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Stats Cards ───────────────────────────────────────────── */}
                    <div className='mrd-stats'>
                        <StatCard
                            label='Net Profit / Loss'
                            value={`${stats.netProfit >= 0 ? '+' : ''}$${stats.netProfit.toFixed(2)}`}
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
                        <StatCard label='Avg Win' value={`$${stats.avgWin.toFixed(2)}`} color={COLORS.win} />
                        <StatCard label='Avg Loss' value={`$${stats.avgLoss.toFixed(2)}`} color={COLORS.loss} />
                        <StatCard label='Best Trade' value={`$${stats.bestTrade.toFixed(2)}`} color={COLORS.win} />
                        <StatCard label='Worst Trade' value={`$${stats.worstTrade.toFixed(2)}`} color={COLORS.loss} />
                        {stats.streak > 0 && (
                            <StatCard
                                label='Current Streak'
                                value={`${stats.streak} ${stats.streakType === 'win' ? 'W' : 'L'}`}
                                color={stats.streakType === 'win' ? COLORS.win : COLORS.loss}
                            />
                        )}
                    </div>

                    {/* ── Charts ────────────────────────────────────────────────── */}
                    <div className='mrd-charts'>
                        {/* Equity Curve */}
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

                        {/* Daily P&L */}
                        <div className='mrd-chart-card'>
                            <h3 className='mrd-chart-card__title'>Daily P&L</h3>
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

                        {/* Win/Loss Donut */}
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

                    {/* ── Trade History Table ───────────────────────────────────── */}
                    <div className='mrd-table-wrap'>
                        <div className='mrd-table-wrap__header'>
                            <h3>Trade History</h3>
                            <span style={{ color: '#666', fontSize: '13px' }}>{trades.length} trades</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className='mrd-table'>
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Asset</th>
                                        <th>Type</th>
                                        <th>Stake</th>
                                        <th>Payout</th>
                                        <th>P&L</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trades.map(t => (
                                        <tr key={t.id}>
                                            <td>{new Date(t.timestamp).toLocaleString()}</td>
                                            <td>{t.asset}</td>
                                            <td>{t.tradeType}</td>
                                            <td>${t.stake.toFixed(2)}</td>
                                            <td>${t.payout.toFixed(2)}</td>
                                            <td
                                                style={{
                                                    color: t.profit >= 0 ? COLORS.win : COLORS.loss,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                                            </td>
                                            <td>
                                                <span className={`mrd-badge mrd-badge--${t.status}`}>
                                                    {t.status === 'win' ? 'WIN' : 'LOSS'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default MyReportsDashboard;
