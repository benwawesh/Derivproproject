import React, { useEffect, useState } from 'react';
import { getLeaderboard, getCompetitionSettings } from '../../../Services/supabase';
import './leaderboard.scss';

type TLeaderboardEntry = {
    id: string;
    masked_login_id: string;
    start_balance: number;
    current_balance: number;
    net_profit: number;
    profit_percent: number;
    deposits: number;
    withdrawals: number;
    total_trades: number;
    buy_trades: number;
    sell_trades: number;
    bot_used: string;
    market_traded: string;
    trade_type: string;
    rank: number;
    prize_category: string;
    is_qualified: boolean;
};

type TCompSettings = {
    current_period: string;
    period_start: string;
    period_end: string;
    min_profit_for_top10: number;
    min_balance_for_top10: number;
};

const getPrizeBadge = (rank: number, prize_category: string) => {
    if (prize_category === 'funded_top10') return { label: 'Funded', color: '#800000' };
    if (prize_category === 'double_balance') return { label: '2x Balance', color: '#28a745' };
    if (rank === 1) return { label: '🥇', color: 'transparent' };
    if (rank === 2) return { label: '🥈', color: 'transparent' };
    if (rank === 3) return { label: '🥉', color: 'transparent' };
    return null;
};

const getDaysRemaining = (end_date: string) => {
    const end = new Date(end_date);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
};

const Leaderboard = () => {
    const [entries, setEntries] = useState<TLeaderboardEntry[]>([]);
    const [comp_settings, setCompSettings] = useState<TCompSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const [data, settings] = await Promise.all([getLeaderboard(), getCompetitionSettings()]);
                const ranked = (data || []).map((entry: TLeaderboardEntry, i: number) => ({
                    ...entry,
                    rank: i + 1,
                }));
                setEntries(ranked);
                setCompSettings(settings);
            } catch (e) {
                setError('Failed to load leaderboard.');
            } finally {
                setLoading(false);
            }
        };
        load();

        // Refresh every 30 seconds
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className='dpa-leaderboard__loading'>Loading leaderboard...</div>;
    if (error) return <div className='dpa-leaderboard__error'>{error}</div>;

    return (
        <div className='dpa-leaderboard'>
            <div className='dpa-leaderboard__header'>
                <div className='dpa-leaderboard__title-row'>
                    <h1>Live Leaderboard</h1>
                    <span className='dpa-leaderboard__live-dot'>● LIVE</span>
                </div>
                {comp_settings && (
                    <div className='dpa-leaderboard__meta'>
                        <span className='period'>
                            {comp_settings.current_period === 'weekly' ? 'Weekly' : 'Monthly'} Competition
                        </span>
                        <span className='days'>{getDaysRemaining(comp_settings.period_end)} days remaining</span>
                    </div>
                )}
            </div>

            {/* Prize info */}
            <div className='dpa-leaderboard__prizes'>
                <div className='prize-card funded'>
                    <div className='prize-rank'>Top 10</div>
                    <div className='prize-name'>Funded Account</div>
                    <div className='prize-amount'>$1,000 – $10,000</div>
                    <div className='prize-condition'>Must have profit &gt; $1,000 &amp; balance &gt; $1,000</div>
                </div>
                <div className='prize-card double'>
                    <div className='prize-rank'>Top 11–20</div>
                    <div className='prize-name'>Double Balance</div>
                    <div className='prize-amount'>2× Starting Balance</div>
                    <div className='prize-condition'>No minimum requirement</div>
                </div>
            </div>

            {/* Table */}
            <div className='dpa-leaderboard__table-wrapper'>
                <table className='dpa-leaderboard__table'>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Login ID</th>
                            <th>Start Balance</th>
                            <th>Current Balance</th>
                            <th>Net Profit</th>
                            <th>Deposits</th>
                            <th>Withdrawals</th>
                            <th>Trades</th>
                            <th>Bot Used</th>
                            <th>Market</th>
                            <th>Type</th>
                            <th>Prize</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.length === 0 ? (
                            <tr>
                                <td colSpan={12} className='dpa-leaderboard__empty'>
                                    No participants yet. Be the first to join!
                                </td>
                            </tr>
                        ) : (
                            entries.map(entry => {
                                const badge = getPrizeBadge(entry.rank, entry.prize_category);
                                return (
                                    <tr
                                        key={entry.id}
                                        className={`
                                            ${entry.rank <= 3 ? 'top-three' : ''}
                                            ${entry.rank <= 10 ? 'top-ten' : ''}
                                            ${entry.rank >= 11 && entry.rank <= 20 ? 'top-twenty' : ''}
                                        `}
                                    >
                                        <td className='rank'>
                                            {entry.rank <= 3 ? (
                                                <span className='medal'>
                                                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                                </span>
                                            ) : (
                                                entry.rank
                                            )}
                                        </td>
                                        <td className='login-id'>{entry.masked_login_id}</td>
                                        <td>${entry.start_balance?.toFixed(2)}</td>
                                        <td>${entry.current_balance?.toFixed(2)}</td>
                                        <td className={entry.net_profit >= 0 ? 'profit' : 'loss'}>
                                            {entry.net_profit >= 0 ? '+' : ''}${entry.net_profit?.toFixed(2)}
                                            <span className='pct'>({entry.profit_percent?.toFixed(1)}%)</span>
                                        </td>
                                        <td>+${entry.deposits?.toFixed(2)}</td>
                                        <td>-${entry.withdrawals?.toFixed(2)}</td>
                                        <td>
                                            <div className='trade-breakdown'>
                                                <span className='buy'>B: {entry.buy_trades}</span>
                                                <span className='sell'>S: {entry.sell_trades}</span>
                                            </div>
                                        </td>
                                        <td className='bot-name'>{entry.bot_used || '—'}</td>
                                        <td>{entry.market_traded || '—'}</td>
                                        <td>{entry.trade_type || '—'}</td>
                                        <td>
                                            {badge && badge.color !== 'transparent' ? (
                                                <span className='prize-badge' style={{ background: badge.color }}>
                                                    {badge.label}
                                                </span>
                                            ) : badge ? (
                                                <span>{badge.label}</span>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className='dpa-leaderboard__footer'>
                Rankings update every 30 seconds. Ranked by net profit generated during competition period.
            </div>
        </div>
    );
};

export default Leaderboard;
