import { useState, useEffect } from 'react';
import { getCopyTraders } from 'Services/supabase';
import './copy-trading.scss';

type TTrader = {
    id: string;
    masked_login_id: string;
    net_profit: number;
    profit_percent: number;
    total_trades: number;
    buy_trades: number;
    sell_trades: number;
    bot_used: string;
    market_traded: string;
    is_qualified: boolean;
    start_balance: number;
    current_balance: number;
};

const AVATAR_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#c62828', '#1565c0'];

const getRiskLabel = (profit_percent: number) => {
    if (profit_percent > 30) return 'High';
    if (profit_percent > 15) return 'Medium';
    return 'Low';
};

const getRiskColor = (label: string) => {
    if (label === 'Low') return '#2e7d32';
    if (label === 'Medium') return '#f57c00';
    return '#c62828';
};

const getDrawdown = (start: number, current: number) => {
    const loss = start - current;
    return loss > 0 ? ((loss / start) * 100).toFixed(1) : '0.0';
};

const CopyTradingPage = () => {
    const [traders, setTraders] = useState<TTrader[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'net_profit' | 'profit_percent' | 'total_trades'>('net_profit');
    const [riskFilter, setRisk] = useState('All');
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        getCopyTraders()
            .then(data => setTraders(data as TTrader[]))
            .catch(() => setTraders([]))
            .finally(() => setLoading(false));
    }, []);

    const handleCopy = (id: string) => {
        setCopied(id);
        setTimeout(() => setCopied(null), 3000);
    };

    const sorted = [...traders]
        .filter(t => {
            if (riskFilter === 'All') return true;
            return getRiskLabel(t.profit_percent) === riskFilter;
        })
        .sort((a, b) => b[sortBy] - a[sortBy]);

    return (
        <div className='dpa-copy'>
            {/* ── Banner ──────────────────────────────────── */}
            <div className='dpa-copy__banner'>
                <div className='dpa-copy__banner-inner'>
                    <span className='dpa-copy__banner-tag'>SOCIAL TRADING</span>
                    <h1 className='dpa-copy__banner-title'>Copy Trading</h1>
                    <p className='dpa-copy__banner-sub'>
                        Copy the trades of top DPA leaderboard traders automatically. Zero copy fees — keep 100% of your
                        profits.
                    </p>
                    {traders.length > 0 && (
                        <div className='dpa-copy__banner-stats'>
                            <div className='dpa-copy__banner-stat'>
                                <span className='dpa-copy__banner-stat-val'>{traders.length}</span>
                                <span className='dpa-copy__banner-stat-label'>Top Traders</span>
                            </div>
                            <div className='dpa-copy__banner-stat'>
                                <span className='dpa-copy__banner-stat-val'>$0</span>
                                <span className='dpa-copy__banner-stat-label'>Copy Fees</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className='dpa-copy__content'>
                {/* ── Copy notice ───────────────────────────── */}
                {copied && (
                    <div className='dpa-copy__notice'>
                        ✅ You are now copying trader{' '}
                        <strong>{traders.find(t => t.id === copied)?.masked_login_id}</strong>. Their trades will be
                        mirrored on your account automatically.
                    </div>
                )}

                {loading ? (
                    <div className='dpa-copy__loading'>Loading traders...</div>
                ) : traders.length === 0 ? (
                    <div className='dpa-copy__empty-state'>
                        <div className='dpa-copy__empty-icon'>👥</div>
                        <h3>No Traders Available Yet</h3>
                        <p>
                            Traders who reach the top of the leaderboard and enable copy trading will appear here. Check
                            back once the competition is underway.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ── Controls ──────────────────────────── */}
                        <div className='dpa-copy__controls'>
                            <div className='dpa-copy__sort'>
                                <span className='dpa-copy__sort-label'>Sort by:</span>
                                {[
                                    { key: 'net_profit', label: 'Profit ($)' },
                                    { key: 'profit_percent', label: 'Return %' },
                                    { key: 'total_trades', label: 'Trades' },
                                ].map(s => (
                                    <button
                                        key={s.key}
                                        className={`dpa-copy__sort-btn${sortBy === s.key ? ' active' : ''}`}
                                        onClick={() => setSortBy(s.key as typeof sortBy)}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                            <div className='dpa-copy__risk-filter'>
                                <span className='dpa-copy__sort-label'>Risk:</span>
                                {['All', 'Low', 'Medium', 'High'].map(r => (
                                    <button
                                        key={r}
                                        className={`dpa-copy__sort-btn${riskFilter === r ? ' active' : ''}`}
                                        onClick={() => setRisk(r)}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Grid ──────────────────────────────── */}
                        <div className='dpa-copy__grid'>
                            {sorted.map((t, i) => {
                                const risk = getRiskLabel(t.profit_percent);
                                const riskColor = getRiskColor(risk);
                                const dd = getDrawdown(t.start_balance, t.current_balance);
                                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                                return (
                                    <div key={t.id} className='dpa-copy__card'>
                                        <div className='dpa-copy__card-header'>
                                            <div className='dpa-copy__avatar' style={{ background: color }}>
                                                {t.masked_login_id.charAt(0)}
                                            </div>
                                            <div className='dpa-copy__trader-info'>
                                                <div className='dpa-copy__trader-name'>{t.masked_login_id}</div>
                                                <div className='dpa-copy__trader-strategy'>
                                                    {t.bot_used || 'Manual'}
                                                </div>
                                            </div>
                                            <div
                                                className='dpa-copy__risk-badge'
                                                style={{ color: riskColor, background: `${riskColor}18` }}
                                            >
                                                {risk} Risk
                                            </div>
                                        </div>

                                        <div className='dpa-copy__stats-row'>
                                            <div className='dpa-copy__stat'>
                                                <div className='dpa-copy__stat-val' style={{ color: '#2e7d32' }}>
                                                    +{t.profit_percent.toFixed(1)}%
                                                </div>
                                                <div className='dpa-copy__stat-label'>Return</div>
                                            </div>
                                            <div className='dpa-copy__stat'>
                                                <div className='dpa-copy__stat-val' style={{ color: '#2e7d32' }}>
                                                    ${t.net_profit.toFixed(0)}
                                                </div>
                                                <div className='dpa-copy__stat-label'>Profit</div>
                                            </div>
                                            <div className='dpa-copy__stat'>
                                                <div className='dpa-copy__stat-val'>{t.total_trades}</div>
                                                <div className='dpa-copy__stat-label'>Trades</div>
                                            </div>
                                            <div className='dpa-copy__stat'>
                                                <div className='dpa-copy__stat-val' style={{ color: '#c62828' }}>
                                                    {dd}%
                                                </div>
                                                <div className='dpa-copy__stat-label'>Max DD</div>
                                            </div>
                                        </div>

                                        <div className='dpa-copy__markets'>
                                            {t.market_traded && (
                                                <span className='dpa-copy__market-tag'>{t.market_traded}</span>
                                            )}
                                            {t.is_qualified && (
                                                <span className='dpa-copy__qualified-tag'>✓ Qualified</span>
                                            )}
                                        </div>

                                        <button className='dpa-copy__copy-btn' onClick={() => handleCopy(t.id)}>
                                            <svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor'>
                                                <path d='M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z' />
                                            </svg>
                                            Copy This Trader — Free
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* ── How it works ──────────────────────────── */}
                <div className='dpa-copy__how'>
                    <h2 className='dpa-copy__how-title'>How Copy Trading Works</h2>
                    <div className='dpa-copy__how-steps'>
                        {[
                            {
                                icon: '👀',
                                step: '1. Browse',
                                desc: 'Find a trader whose stats and risk level match your goals.',
                            },
                            {
                                icon: '📋',
                                step: '2. Copy',
                                desc: 'Click "Copy This Trader" to start copying their trades automatically.',
                            },
                            {
                                icon: '💰',
                                step: '3. Profit',
                                desc: 'Your account mirrors their trades proportionally to your balance.',
                            },
                            {
                                icon: '🛑',
                                step: '4. Stop',
                                desc: 'Cancel copy trading anytime from your dashboard with one click.',
                            },
                        ].map((s, i) => (
                            <div key={i} className='dpa-copy__how-step'>
                                <div className='dpa-copy__how-icon'>{s.icon}</div>
                                <div className='dpa-copy__how-step-title'>{s.step}</div>
                                <p className='dpa-copy__how-step-desc'>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className='dpa-copy__disclaimer'>
                    Copy trading involves risk. Past performance of traders does not guarantee future results. Only
                    invest what you can afford to lose.
                </p>
            </div>
        </div>
    );
};

export default CopyTradingPage;
