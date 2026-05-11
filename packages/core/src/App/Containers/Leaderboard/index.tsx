import { useState, useEffect, useCallback } from 'react';
import { getLeaderboard, getCompetitionSettings } from 'Services/supabase';
import { supabase } from 'Services/supabase';
import './leaderboard.scss';

// ── Simulated data (shown when Supabase is empty) ─────────────────────────────
const SIMULATED: any[] = [
    {
        id: '1',
        masked_login_id: 'CR23**01',
        start_balance: 1000,
        current_balance: 1847,
        net_profit: 847,
        profit_percent: 84.7,
        total_trades: 312,
        buy_trades: 198,
        sell_trades: 114,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'Volatility 100',
        is_qualified: true,
    },
    {
        id: '2',
        masked_login_id: 'CR88**45',
        start_balance: 1000,
        current_balance: 1634,
        net_profit: 634,
        profit_percent: 63.4,
        total_trades: 278,
        buy_trades: 165,
        sell_trades: 113,
        bot_used: 'Martingale X',
        market_traded: 'EUR/USD',
        is_qualified: true,
    },
    {
        id: '3',
        masked_login_id: 'CR56**12',
        start_balance: 1000,
        current_balance: 1521,
        net_profit: 521,
        profit_percent: 52.1,
        total_trades: 445,
        buy_trades: 267,
        sell_trades: 178,
        bot_used: 'Digit Over',
        market_traded: 'Volatility 50',
        is_qualified: true,
    },
    {
        id: '4',
        masked_login_id: 'CR77**89',
        start_balance: 1000,
        current_balance: 1408,
        net_profit: 408,
        profit_percent: 40.8,
        total_trades: 189,
        buy_trades: 112,
        sell_trades: 77,
        bot_used: 'Manual',
        market_traded: 'Gold (XAU)',
        is_qualified: true,
    },
    {
        id: '5',
        masked_login_id: 'CR44**33',
        start_balance: 1000,
        current_balance: 1376,
        net_profit: 376,
        profit_percent: 37.6,
        total_trades: 356,
        buy_trades: 201,
        sell_trades: 155,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'Volatility 25',
        is_qualified: true,
    },
    {
        id: '6',
        masked_login_id: 'CR31**70',
        start_balance: 1000,
        current_balance: 1298,
        net_profit: 298,
        profit_percent: 29.8,
        total_trades: 423,
        buy_trades: 245,
        sell_trades: 178,
        bot_used: 'Even/Odd Bot',
        market_traded: 'Volatility 100',
        is_qualified: true,
    },
    {
        id: '7',
        masked_login_id: 'CR19**54',
        start_balance: 1000,
        current_balance: 1254,
        net_profit: 254,
        profit_percent: 25.4,
        total_trades: 167,
        buy_trades: 98,
        sell_trades: 69,
        bot_used: 'Manual',
        market_traded: 'GBP/USD',
        is_qualified: true,
    },
    {
        id: '8',
        masked_login_id: 'CR65**28',
        start_balance: 1000,
        current_balance: 1198,
        net_profit: 198,
        profit_percent: 19.8,
        total_trades: 298,
        buy_trades: 176,
        sell_trades: 122,
        bot_used: 'Martingale X',
        market_traded: 'Volatility 50',
        is_qualified: true,
    },
    {
        id: '9',
        masked_login_id: 'CR52**91',
        start_balance: 1000,
        current_balance: 1165,
        net_profit: 165,
        profit_percent: 16.5,
        total_trades: 234,
        buy_trades: 134,
        sell_trades: 100,
        bot_used: 'Digit Over',
        market_traded: 'Volatility 100',
        is_qualified: true,
    },
    {
        id: '10',
        masked_login_id: 'CR38**47',
        start_balance: 1000,
        current_balance: 1134,
        net_profit: 134,
        profit_percent: 13.4,
        total_trades: 312,
        buy_trades: 178,
        sell_trades: 134,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'EUR/USD',
        is_qualified: true,
    },
    {
        id: '11',
        masked_login_id: 'CR72**15',
        start_balance: 1000,
        current_balance: 1098,
        net_profit: 98,
        profit_percent: 9.8,
        total_trades: 145,
        buy_trades: 82,
        sell_trades: 63,
        bot_used: 'Manual',
        market_traded: 'Oil (WTI)',
        is_qualified: false,
    },
    {
        id: '12',
        masked_login_id: 'CR84**62',
        start_balance: 1000,
        current_balance: 1076,
        net_profit: 76,
        profit_percent: 7.6,
        total_trades: 267,
        buy_trades: 152,
        sell_trades: 115,
        bot_used: 'Even/Odd Bot',
        market_traded: 'Volatility 25',
        is_qualified: false,
    },
    {
        id: '13',
        masked_login_id: 'CR16**39',
        start_balance: 1000,
        current_balance: 1054,
        net_profit: 54,
        profit_percent: 5.4,
        total_trades: 189,
        buy_trades: 108,
        sell_trades: 81,
        bot_used: 'Martingale X',
        market_traded: 'Volatility 100',
        is_qualified: false,
    },
    {
        id: '14',
        masked_login_id: 'CR93**07',
        start_balance: 1000,
        current_balance: 1043,
        net_profit: 43,
        profit_percent: 4.3,
        total_trades: 223,
        buy_trades: 127,
        sell_trades: 96,
        bot_used: 'Manual',
        market_traded: 'GBP/USD',
        is_qualified: false,
    },
    {
        id: '15',
        masked_login_id: 'CR47**83',
        start_balance: 1000,
        current_balance: 1031,
        net_profit: 31,
        profit_percent: 3.1,
        total_trades: 156,
        buy_trades: 89,
        sell_trades: 67,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'Volatility 50',
        is_qualified: false,
    },
];

const PRIZES = [
    { rank: '1st', prize: '$10,000', color: '#ffd700' },
    { rank: '2nd', prize: '$7,000', color: '#c0c0c0' },
    { rank: '3rd', prize: '$5,000', color: '#cd7f32' },
    { rank: '4th', prize: '$3,000', color: '#800000' },
    { rank: '5th', prize: '$2,000', color: '#800000' },
    { rank: '6–10th', prize: '$1,000', color: '#800000' },
    { rank: '11–20th', prize: '2× Balance', color: '#555' },
];

const getPrize = (rank: number) => {
    if (rank === 1) return '$10,000';
    if (rank === 2) return '$7,000';
    if (rank === 3) return '$5,000';
    if (rank === 4) return '$3,000';
    if (rank === 5) return '$2,000';
    if (rank <= 10) return '$1,000';
    if (rank <= 20) return '2× Balance';
    return '—';
};

const getMedal = (rank: number) => {
    if (rank === 1) return { icon: '🥇', cls: 'gold' };
    if (rank === 2) return { icon: '🥈', cls: 'silver' };
    if (rank === 3) return { icon: '🥉', cls: 'bronze' };
    return { icon: String(rank), cls: '' };
};

const LeaderboardPage = () => {
    const [entries, setEntries] = useState<any[]>([]);
    const [competition, setComp] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'monthly' | 'weekly'>('monthly');

    const loadData = useCallback(async () => {
        try {
            const [lb, comp] = await Promise.all([getLeaderboard(), getCompetitionSettings()]);
            setEntries(lb?.length ? lb : SIMULATED);
            setComp(comp);
        } catch {
            setEntries(SIMULATED);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const channel = supabase
            .channel('leaderboard-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, loadData)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    const timeLeft = () => {
        if (!competition?.period_end) return '7d 0h remaining';
        const diff = new Date(competition.period_end).getTime() - Date.now();
        if (diff <= 0) return 'Competition ended';
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        return `${days}d ${hours}h remaining`;
    };

    const top3 = entries.slice(0, 3);

    return (
        <div className='dpa-lb'>
            {/* ── Hero Banner ──────────────────────────────────────── */}
            <div className='dpa-lb__banner'>
                <div className='dpa-lb__banner-inner'>
                    <div className='dpa-lb__banner-left'>
                        <span className='dpa-lb__banner-tag'>LIVE COMPETITION</span>
                        <h1 className='dpa-lb__banner-title'>Monthly Leaderboard</h1>
                        <p className='dpa-lb__banner-sub'>
                            Top 20 traders win funded accounts & cash prizes. Rankings reset every period.
                        </p>
                        <div className='dpa-lb__banner-timer'>
                            <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
                                <path d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z' />
                            </svg>
                            {timeLeft()}
                        </div>
                    </div>
                    <div className='dpa-lb__banner-prizes'>
                        {PRIZES.map(p => (
                            <div key={p.rank} className='dpa-lb__banner-prize' style={{ borderColor: p.color }}>
                                <span className='dpa-lb__banner-prize-rank' style={{ color: p.color }}>
                                    {p.rank}
                                </span>
                                <span className='dpa-lb__banner-prize-val'>{p.prize}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className='dpa-lb__content'>
                {/* ── Top 3 Podium ─────────────────────────────────── */}
                {!loading && top3.length >= 3 && (
                    <div className='dpa-lb__podium'>
                        {/* 2nd */}
                        <div className='dpa-lb__podium-slot dpa-lb__podium-slot--2'>
                            <div className='dpa-lb__podium-avatar silver'>{top3[1].masked_login_id.charAt(0)}</div>
                            <div className='dpa-lb__podium-name'>{top3[1].masked_login_id}</div>
                            <div className='dpa-lb__podium-profit'>+${top3[1].net_profit.toFixed(0)}</div>
                            <div className='dpa-lb__podium-prize'>$7,000</div>
                            <div className='dpa-lb__podium-bar silver'>
                                <span>2nd</span>
                            </div>
                        </div>
                        {/* 1st */}
                        <div className='dpa-lb__podium-slot dpa-lb__podium-slot--1'>
                            <div className='dpa-lb__podium-crown'>👑</div>
                            <div className='dpa-lb__podium-avatar gold'>{top3[0].masked_login_id.charAt(0)}</div>
                            <div className='dpa-lb__podium-name'>{top3[0].masked_login_id}</div>
                            <div className='dpa-lb__podium-profit'>+${top3[0].net_profit.toFixed(0)}</div>
                            <div className='dpa-lb__podium-prize'>$10,000</div>
                            <div className='dpa-lb__podium-bar gold'>
                                <span>1st</span>
                            </div>
                        </div>
                        {/* 3rd */}
                        <div className='dpa-lb__podium-slot dpa-lb__podium-slot--3'>
                            <div className='dpa-lb__podium-avatar bronze'>{top3[2].masked_login_id.charAt(0)}</div>
                            <div className='dpa-lb__podium-name'>{top3[2].masked_login_id}</div>
                            <div className='dpa-lb__podium-profit'>+${top3[2].net_profit.toFixed(0)}</div>
                            <div className='dpa-lb__podium-prize'>$5,000</div>
                            <div className='dpa-lb__podium-bar bronze'>
                                <span>3rd</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Filter tabs ───────────────────────────────────── */}
                <div className='dpa-lb__filters'>
                    <button
                        className={`dpa-lb__filter-btn${filter === 'monthly' ? ' active' : ''}`}
                        onClick={() => setFilter('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`dpa-lb__filter-btn${filter === 'weekly' ? ' active' : ''}`}
                        onClick={() => setFilter('weekly')}
                    >
                        Weekly
                    </button>
                    <span className='dpa-lb__filter-count'>{entries.length} participants</span>
                </div>

                {/* ── Table ────────────────────────────────────────── */}
                {loading ? (
                    <div className='dpa-lb__loading'>Loading leaderboard...</div>
                ) : (
                    <div className='dpa-lb__table-wrap'>
                        <table className='dpa-lb__table'>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Trader</th>
                                    <th>Profit</th>
                                    <th>Return %</th>
                                    <th>Trades</th>
                                    <th>Market</th>
                                    <th>Bot</th>
                                    <th>Prize</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e, i) => {
                                    const { icon, cls } = getMedal(i + 1);
                                    return (
                                        <tr
                                            key={e.id}
                                            className={`dpa-lb__row${i < 10 ? ' top10' : i < 20 ? ' top20' : ''}`}
                                        >
                                            <td className={`dpa-lb__rank ${cls}`}>{icon}</td>
                                            <td className='dpa-lb__trader'>
                                                <div
                                                    className='dpa-lb__trader-avatar'
                                                    style={{ background: `hsl(${(i * 47) % 360}, 60%, 45%)` }}
                                                >
                                                    {e.masked_login_id.charAt(0)}
                                                </div>
                                                <span>{e.masked_login_id}</span>
                                            </td>
                                            <td className={`dpa-lb__profit ${e.net_profit >= 0 ? 'up' : 'down'}`}>
                                                {e.net_profit >= 0 ? '+' : ''}${e.net_profit.toFixed(2)}
                                            </td>
                                            <td className={`dpa-lb__percent ${e.profit_percent >= 0 ? 'up' : 'down'}`}>
                                                {e.profit_percent >= 0 ? '+' : ''}
                                                {e.profit_percent.toFixed(1)}%
                                            </td>
                                            <td className='dpa-lb__trades'>{e.total_trades}</td>
                                            <td className='dpa-lb__market'>{e.market_traded || '—'}</td>
                                            <td className='dpa-lb__bot'>{e.bot_used || 'Manual'}</td>
                                            <td>
                                                <span
                                                    className={`dpa-lb__prize-badge ${i < 10 ? 'funded' : i < 20 ? 'double' : 'none'}`}
                                                >
                                                    {getPrize(i + 1)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Disclaimer ───────────────────────────────────── */}
                <p className='dpa-lb__disclaimer'>
                    Leaderboard updates in real-time · Rankings based on net profit · Simulated data shown until
                    competition begins
                </p>
            </div>
        </div>
    );
};

export default LeaderboardPage;
