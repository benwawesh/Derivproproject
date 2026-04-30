import React, { useMemo } from 'react';
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

const COLORS = { win: '#16a534', loss: '#ff444f', neutral: '#00a79e' };

// ── Shared helpers (same logic as MyReportsDashboard) ─────────────────────────
const buildEquityCurve = (trades: any[], startBalance: number) => {
    let balance = startBalance;
    return [...trades]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(t => {
            balance += typeof t.profit === 'number' ? t.profit : parseFloat(t.profit ?? '0') || 0;
            return { time: new Date(t.created_at).toLocaleDateString(), balance: parseFloat(balance.toFixed(2)) };
        });
};

const buildDailyPnL = (trades: any[]) => {
    const map: Record<string, number> = {};
    trades.forEach(t => {
        const day = new Date(t.created_at).toLocaleDateString();
        map[day] = (map[day] ?? 0) + (typeof t.profit === 'number' ? t.profit : parseFloat(t.profit ?? '0') || 0);
    });
    return Object.entries(map)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([day, pnl]) => ({ day, pnl: parseFloat(pnl.toFixed(2)) }));
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const SC = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className='admin-report__stat'>
        <div className='admin-report__stat-label'>{label}</div>
        <div className='admin-report__stat-value' style={color ? { color } : undefined}>
            {value}
        </div>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
    trades: any[];
    accountType: 'funded' | 'real';
    startBalance?: number;
}

const AdminUserReportView = ({ trades, accountType, startBalance = 0 }: Props) => {
    const stats = useMemo(() => {
        const wins = trades.filter(t => t.is_win).length;
        const losses = trades.filter(t => !t.is_win).length;
        const total = trades.length;
        const grossProfit = trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
        const grossLoss = Math.abs(trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));
        const netProfit = grossProfit - grossLoss;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        const profits = trades.map(t => t.profit ?? 0);
        const bestTrade = profits.length ? Math.max(...profits) : 0;
        const worstTrade = profits.length ? Math.min(...profits) : 0;
        return {
            wins,
            losses,
            total,
            grossProfit,
            grossLoss,
            netProfit,
            winRate,
            avgWin,
            avgLoss,
            profitFactor,
            bestTrade,
            worstTrade,
        };
    }, [trades]);

    const equityCurve = useMemo(() => buildEquityCurve(trades, startBalance), [trades, startBalance]);
    const dailyPnL = useMemo(() => buildDailyPnL(trades), [trades]);
    const donutData = useMemo(
        () => [
            { name: 'Wins', value: stats.wins },
            { name: 'Losses', value: stats.losses },
        ],
        [stats]
    );

    if (trades.length === 0) {
        return (
            <div className='admin-report__empty'>
                <p>No {accountType} account trades recorded for this user.</p>
                {accountType === 'funded' ? (
                    <p>Trades appear here once the user runs the bot in Funded mode.</p>
                ) : (
                    <p>Trades appear here once the user runs the bot on their real account.</p>
                )}
            </div>
        );
    }

    return (
        <div className='admin-report'>
            {/* ── Stats row ──────────────────────────────────────────── */}
            <div className='admin-report__stats'>
                <SC
                    label='Net P&L'
                    value={`${stats.netProfit >= 0 ? '+' : ''}$${stats.netProfit.toFixed(2)}`}
                    color={stats.netProfit >= 0 ? COLORS.win : COLORS.loss}
                />
                <SC label='Total Trades' value={String(stats.total)} />
                <SC
                    label='Win Rate'
                    value={`${stats.winRate.toFixed(1)}%`}
                    color={stats.winRate >= 50 ? COLORS.win : COLORS.loss}
                />
                <SC label='Wins' value={String(stats.wins)} color={COLORS.win} />
                <SC label='Losses' value={String(stats.losses)} color={COLORS.loss} />
                <SC label='Profit Factor' value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'} />
                <SC label='Avg Win' value={`$${stats.avgWin.toFixed(2)}`} color={COLORS.win} />
                <SC label='Avg Loss' value={`$${stats.avgLoss.toFixed(2)}`} color={COLORS.loss} />
                <SC label='Best Trade' value={`$${stats.bestTrade.toFixed(2)}`} color={COLORS.win} />
                <SC label='Worst Trade' value={`$${stats.worstTrade.toFixed(2)}`} color={COLORS.loss} />
            </div>

            {/* ── Charts ─────────────────────────────────────────────── */}
            <div className='admin-report__charts'>
                {/* Equity Curve */}
                <div className='admin-report__chart-card admin-report__chart-card--full'>
                    <h4>Equity Curve</h4>
                    <ResponsiveContainer width='100%' height={220}>
                        <LineChart data={equityCurve} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.08)' />
                            <XAxis dataKey='time' tick={{ fontSize: 11, fill: '#aaa' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#aaa' }} />
                            <Tooltip formatter={(v: any) => [`$${v}`, 'Balance']} />
                            <Line
                                type='monotone'
                                dataKey='balance'
                                stroke={COLORS.neutral}
                                strokeWidth={2.5}
                                dot={equityCurve.length <= 30}
                                animationDuration={600}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Daily P&L */}
                <div className='admin-report__chart-card'>
                    <h4>Daily P&L</h4>
                    <ResponsiveContainer width='100%' height={220}>
                        <BarChart data={dailyPnL} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.08)' />
                            <XAxis dataKey='day' tick={{ fontSize: 11, fill: '#aaa' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#aaa' }} />
                            <Tooltip formatter={(v: any) => [`$${v}`, 'P&L']} />
                            <Bar dataKey='pnl' radius={[4, 4, 0, 0]} animationDuration={600}>
                                {dailyPnL.map((entry, i) => (
                                    <Cell key={i} fill={entry.pnl >= 0 ? COLORS.win : COLORS.loss} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Win/Loss Donut */}
                <div className='admin-report__chart-card'>
                    <h4>Win / Loss Split</h4>
                    <ResponsiveContainer width='100%' height={220}>
                        <PieChart>
                            <Pie
                                data={donutData}
                                cx='50%'
                                cy='50%'
                                innerRadius={60}
                                outerRadius={85}
                                dataKey='value'
                                animationDuration={600}
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

            {/* ── Trade history table ─────────────────────────────────── */}
            <div className='admin-report__table-wrap'>
                <div className='admin-report__table-header'>
                    <h4>Trade History</h4>
                    <span>{trades.length} trades</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className='dpa-admin__table'>
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Market</th>
                                <th>Type</th>
                                <th>Stake</th>
                                <th>Payout</th>
                                <th>P&L</th>
                                <th>Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((t: any) => (
                                <tr key={t.id ?? t.contract_id}>
                                    <td>{new Date(t.created_at).toLocaleString()}</td>
                                    <td>{t.market ?? '—'}</td>
                                    <td>{t.trade_type ?? '—'}</td>
                                    <td>${(t.stake ?? 0).toFixed(2)}</td>
                                    <td>${(t.payout ?? 0).toFixed(2)}</td>
                                    <td
                                        style={{
                                            color: (t.profit ?? 0) >= 0 ? COLORS.win : COLORS.loss,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {(t.profit ?? 0) >= 0 ? '+' : ''}${(t.profit ?? 0).toFixed(2)}
                                    </td>
                                    <td>
                                        <span
                                            className={`dpa-admin__badge dpa-admin__badge--${t.is_win ? 'win' : 'loss'}`}
                                        >
                                            {t.is_win ? 'WIN' : 'LOSS'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminUserReportView;
