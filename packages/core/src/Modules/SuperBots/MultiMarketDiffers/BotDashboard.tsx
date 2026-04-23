/**
 * BotDashboard - Live per-market stats table (one row per market, updates in place)
 */

import React from 'react';

export type MarketStat = {
    marketSymbol: string;
    marketName: string;
    runs: number;
    wins: number;
    losses: number;
    profit: number;
    status: 'active' | 'stopped';
    lastDigit?: number;
    martingaleLevel: number;
};

type Props = {
    marketStats: Record<string, MarketStat>;
    mode: 'global' | 'individual';
    globalTargetDigit?: number;
    onStop: () => void;
};

export const BotDashboard = ({ marketStats, mode, globalTargetDigit, onStop }: Props) => {
    const markets = Object.values(marketStats);

    const totalRuns = markets.reduce((s, m) => s + m.runs, 0);
    const totalWins = markets.reduce((s, m) => s + m.wins, 0);
    const totalLosses = markets.reduce((s, m) => s + m.losses, 0);
    const totalProfit = markets.reduce((s, m) => s + m.profit, 0);
    const activeCount = markets.filter(m => m.status === 'active').length;

    return (
        <div className='mm-differs__dashboard'>
            {/* Header */}
            <div className='mm-differs__dashboard-header'>
                <h2 className='mm-differs__dashboard-title'>Live Dashboard</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ color: '#00a79e', fontWeight: 600 }}>🟢 {activeCount} Active</span>
                    <span style={{ color: '#a0a0a0', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {mode === 'global' ? `Global · Digit ${globalTargetDigit}` : 'Individual Mode'}
                    </span>
                </div>
            </div>

            {/* Summary cards */}
            <div
                className='mm-differs__stats-grid'
                style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}
            >
                <div className='mm-differs__stat-card'>
                    <div className='mm-differs__stat-label'>Total Runs</div>
                    <div className='mm-differs__stat-value'>{totalRuns}</div>
                    <div className='mm-differs__stat-sub'>
                        {totalWins}W / {totalLosses}L
                    </div>
                </div>
                <div className='mm-differs__stat-card'>
                    <div className='mm-differs__stat-label'>Win Rate</div>
                    <div className='mm-differs__stat-value'>
                        {totalRuns > 0 ? ((totalWins / totalRuns) * 100).toFixed(1) : '0.0'}%
                    </div>
                    <div className='mm-differs__stat-sub'>{totalWins} wins</div>
                </div>
                <div className='mm-differs__stat-card'>
                    <div className='mm-differs__stat-label'>Total P/L</div>
                    <div className={`mm-differs__stat-value ${totalProfit >= 0 ? 'positive' : 'negative'}`}>
                        {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
                    </div>
                    <div className='mm-differs__stat-sub'>{markets.length} markets</div>
                </div>
                <div className='mm-differs__stat-card'>
                    <div className='mm-differs__stat-label'>Markets</div>
                    <div className='mm-differs__stat-value'>{activeCount}</div>
                    <div className='mm-differs__stat-sub'>of {markets.length} active</div>
                </div>
            </div>

            {/* Per-market table */}
            <div className='mm-differs__trades-section'>
                <div className='mm-differs__trades-table-container'>
                    <table className='mm-differs__trades-table'>
                        <thead>
                            <tr>
                                <th>Market</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center' }}>Runs</th>
                                <th style={{ textAlign: 'center' }}>Wins</th>
                                <th style={{ textAlign: 'center' }}>Losses</th>
                                <th style={{ textAlign: 'center' }}>Last Digit</th>
                                <th style={{ textAlign: 'right' }}>P/L</th>
                                <th style={{ textAlign: 'center' }}>Martingale</th>
                            </tr>
                        </thead>
                        <tbody>
                            {markets.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', color: '#a0a0a0', padding: '2rem' }}>
                                        Waiting for first trade...
                                    </td>
                                </tr>
                            ) : (
                                markets.map(m => (
                                    <tr key={m.marketSymbol} className={m.status === 'stopped' ? 'lost' : ''}>
                                        <td>
                                            <div className='mm-differs__market-info'>
                                                <strong style={{ fontSize: '0.9rem' }}>{m.marketName}</strong>
                                                <span className='mm-differs__market-symbol'>{m.marketSymbol}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span
                                                className={`mm-differs__status-badge ${m.status === 'active' ? 'running' : 'lost'}`}
                                            >
                                                {m.status === 'active' ? '● ACTIVE' : '■ STOPPED'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.runs}</td>
                                        <td style={{ textAlign: 'center', color: '#00a79e', fontWeight: 600 }}>
                                            {m.wins}
                                        </td>
                                        <td style={{ textAlign: 'center', color: '#ff444f', fontWeight: 600 }}>
                                            {m.losses}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {m.lastDigit !== undefined ? (
                                                <span
                                                    style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '1.1rem',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {m.lastDigit}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#a0a0a0' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span
                                                className={`mm-differs__trade-profit ${m.profit >= 0 ? 'positive' : 'negative'}`}
                                            >
                                                {m.profit >= 0 ? '+' : ''}${m.profit.toFixed(2)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {m.martingaleLevel > 0 ? (
                                                <span className='mm-differs__martingale-badge'>
                                                    Lvl {m.martingaleLevel}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#a0a0a0' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {/* Totals row */}
                        {markets.length > 0 && (
                            <tfoot>
                                <tr style={{ borderTop: '2px solid #3e3e3e', background: '#1e1e1e' }}>
                                    <td>
                                        <strong style={{ color: '#ffcc00' }}>TOTAL</strong>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ color: '#a0a0a0', fontSize: '0.85rem' }}>
                                            {activeCount} active
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                                        {totalRuns}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#00a79e', fontWeight: 700 }}>
                                        {totalWins}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#ff444f', fontWeight: 700 }}>
                                        {totalLosses}
                                    </td>
                                    <td />
                                    <td style={{ textAlign: 'right' }}>
                                        <strong
                                            className={totalProfit >= 0 ? 'positive' : 'negative'}
                                            style={{ fontSize: '1.1rem' }}
                                        >
                                            {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
                                        </strong>
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Stop button */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <button className='mm-differs__btn mm-differs__btn--stop' onClick={onStop} style={{ width: '100%' }}>
                    ⏹ STOP BOT
                </button>
            </div>
        </div>
    );
};
