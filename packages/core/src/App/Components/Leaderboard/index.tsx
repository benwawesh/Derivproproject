import React, { useEffect, useState } from 'react';
import { getLeaderboard, getCompetitionSettings } from '../../../Services/supabase';
import TraderQRModal from '../TraderQR';
import './leaderboard.scss';

const DPA_API = /derivprofundedacademy\.com/.test(window.location.hostname)
    ? 'https://api.derivprofundedacademy.com/api'
    : 'http://localhost:8011/api';

type TTraderProfile = {
    id: number;
    display_name: string;
    masked_id: string;
    avatar: string | null;
    country: string;
    account_type: string;
    qr_token: string;
    current_balance: number;
    start_balance: number;
    net_profit: number;
    profit_percent: number;
    win_rate: number;
    bot_used: string;
    market_traded: string;
    total_trades: number;
};

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
    const [champions, setChampions] = useState<TTraderProfile[]>([]);
    const [qr_trader, setQrTrader] = useState<TTraderProfile | null>(null);

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

        fetch(`${DPA_API}/trader-profiles/?placement=leaderboard`)
            .then(r => r.json())
            .then(data => setChampions(Array.isArray(data) ? data : []))
            .catch(() => {});

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

            {/* ── Champions Spotlight ─────────────────────────────────────────── */}
            {champions.length > 0 && (
                <div className='dpa-leaderboard__champions'>
                    <h2 className='dpa-leaderboard__champions-title'>
                        <span>🏆</span> Champions Spotlight
                    </h2>
                    <p className='dpa-leaderboard__champions-sub'>
                        Verified traders on our platform — scan their QR to see the full trade report.
                    </p>
                    <div className='dpa-leaderboard__champions-grid'>
                        {champions.map((t, i) => {
                            const profit_pos = t.net_profit >= 0;
                            return (
                                <div key={t.id} className='dpa-lb-champion'>
                                    <div className='dpa-lb-champion__rank'>#{i + 1}</div>
                                    <div className='dpa-lb-champion__avatar'>
                                        {t.avatar ? (
                                            <img src={t.avatar} alt={t.display_name} />
                                        ) : (
                                            <span>{t.display_name.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className='dpa-lb-champion__info'>
                                        <div className='dpa-lb-champion__name'>{t.display_name}</div>
                                        <div className='dpa-lb-champion__id'>{t.masked_id}</div>
                                        {t.country && <div className='dpa-lb-champion__country'>📍 {t.country}</div>}
                                    </div>
                                    <div className='dpa-lb-champion__stats'>
                                        <div className='dpa-lb-champion__stat'>
                                            <span className='label'>Balance</span>
                                            <span className='value'>${t.current_balance.toFixed(2)}</span>
                                        </div>
                                        <div className='dpa-lb-champion__stat'>
                                            <span className='label'>Return</span>
                                            <span
                                                className='value'
                                                style={{ color: profit_pos ? '#4caf50' : '#ef5350' }}
                                            >
                                                {profit_pos ? '+' : ''}
                                                {t.profit_percent}%
                                            </span>
                                        </div>
                                        <div className='dpa-lb-champion__stat'>
                                            <span className='label'>Win Rate</span>
                                            <span className='value'>{t.win_rate}%</span>
                                        </div>
                                        <div className='dpa-lb-champion__stat'>
                                            <span className='label'>Trades</span>
                                            <span className='value'>{t.total_trades}</span>
                                        </div>
                                    </div>
                                    <button className='dpa-lb-champion__qr-btn' onClick={() => setQrTrader(t)}>
                                        <span>⬛</span> View Report
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {qr_trader && (
                <TraderQRModal
                    qr_token={qr_trader.qr_token}
                    display_name={qr_trader.display_name}
                    masked_id={qr_trader.masked_id}
                    avatar={qr_trader.avatar}
                    account_type={qr_trader.account_type}
                    on_close={() => setQrTrader(null)}
                />
            )}
        </div>
    );
};

export default Leaderboard;
