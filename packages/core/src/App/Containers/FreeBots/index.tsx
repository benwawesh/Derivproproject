import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { observer, useStore } from '@deriv/stores';
import { routes } from '@deriv/shared';
import { getFreeBots } from 'Services/supabase';
import './free-bots.scss';

type TBot = {
    id: string;
    name: string;
    version: string;
    description: string;
    market: string;
    trade_type: string;
    win_rate: number;
    avg_profit: string;
    downloads: number;
    risk: string;
    tags: string[];
    is_featured: boolean;
    xml_url?: string;
};

const RISK_COLORS: Record<string, string> = {
    Low: '#2e7d32',
    Medium: '#f57c00',
    High: '#c62828',
};

// ── Free Bot Card ─────────────────────────────────────────────────────────────
const FreeBotCard = ({ bot, onLoad, isLoaded }: { bot: TBot; onLoad: (bot: TBot) => void; isLoaded: boolean }) => (
    <div className={`dpa-bots__card${bot.is_featured ? ' featured' : ''}${isLoaded ? ' loaded' : ''}`}>
        {bot.is_featured && <div className='dpa-bots__featured-badge'>⭐ Featured</div>}

        <div className='dpa-bots__card-header'>
            <div className='dpa-bots__card-icon'>🤖</div>
            <div>
                <div className='dpa-bots__card-name'>{bot.name}</div>
                <div className='dpa-bots__card-version'>{bot.version}</div>
            </div>
            <div
                className='dpa-bots__risk-badge'
                style={{ background: `${RISK_COLORS[bot.risk] ?? '#888'}18`, color: RISK_COLORS[bot.risk] ?? '#888' }}
            >
                {bot.risk} Risk
            </div>
        </div>

        <p className='dpa-bots__card-desc'>{bot.description}</p>

        <div className='dpa-bots__card-stats'>
            <div className='dpa-bots__stat'>
                <span className='dpa-bots__stat-label'>Win Rate</span>
                <span className='dpa-bots__stat-value' style={{ color: bot.win_rate >= 70 ? '#2e7d32' : '#f57c00' }}>
                    {bot.win_rate}%
                </span>
            </div>
            <div className='dpa-bots__stat'>
                <span className='dpa-bots__stat-label'>Avg Profit</span>
                <span className='dpa-bots__stat-value green'>{bot.avg_profit}</span>
            </div>
        </div>

        <div className='dpa-bots__card-meta'>
            <div className='dpa-bots__meta-row'>
                <span className='dpa-bots__meta-label'>Market:</span>
                <span className='dpa-bots__meta-val'>{bot.market}</span>
            </div>
            <div className='dpa-bots__meta-row'>
                <span className='dpa-bots__meta-label'>Trade Type:</span>
                <span className='dpa-bots__meta-val'>{bot.trade_type}</span>
            </div>
        </div>

        {bot.tags?.length > 0 && (
            <div className='dpa-bots__tags'>
                {bot.tags.map(tag => (
                    <span key={tag} className='dpa-bots__tag'>
                        {tag}
                    </span>
                ))}
            </div>
        )}

        <button className={`dpa-bots__load-btn${isLoaded ? ' loaded' : ''}`} onClick={() => onLoad(bot)}>
            {isLoaded ? '✓ Loaded' : 'Load Bot'}
        </button>
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const FreeBotsPage = observer(() => {
    const history = useHistory();

    const [bots, setBots] = useState<TBot[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [risk_filter, setRisk] = useState('All');

    useEffect(() => {
        getFreeBots()
            .then(data => setBots(data as TBot[]))
            .catch(() => setBots([]))
            .finally(() => setLoading(false));
    }, []);

    const handleLoad = (bot: TBot) => {
        if (!bot.xml_url) {
            alert('This bot does not have an XML file yet.');
            return;
        }
        // Store XML URL then navigate to internal DBot — BotXmlLoader will inject it
        localStorage.setItem('dpa_load_xml', bot.xml_url);
        localStorage.setItem('dpa_bot_mode', '1');
        history.push(routes.bot as any);
    };

    const filtered = bots.filter(b => {
        const matchSearch =
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            b.description?.toLowerCase().includes(search.toLowerCase());
        const matchRisk = risk_filter === 'All' || b.risk === risk_filter;
        return matchSearch && matchRisk;
    });

    const how_it_works = [
        { step: '1', text: 'Browse and select a bot from the list' },
        { step: '2', text: 'Click Load Bot — the bot opens in your Deriv Bot Builder' },
        { step: '3', text: 'Hit Run to start trading automatically' },
    ];

    return (
        <div className='dpa-bots'>
            {/* ── Banner ──────────────────────────────────────── */}
            <div className='dpa-bots__banner'>
                <div className='dpa-bots__banner-inner'>
                    <span className='dpa-bots__banner-tag'>FREE FOR DPA MEMBERS</span>
                    <h1 className='dpa-bots__banner-title'>Free Bots Library</h1>
                    <p className='dpa-bots__banner-sub'>
                        Select a bot and click <strong>Load Bot</strong> to start trading automatically on your Deriv
                        account.
                    </p>
                </div>
            </div>

            <div className='dpa-bots__layout'>
                {/* ── Left: Bot List ───────────────────────────── */}
                <div className='dpa-bots__list'>
                    {/* Filters */}
                    <div className='dpa-bots__filters'>
                        <div className='dpa-bots__search-wrap'>
                            <svg
                                className='dpa-bots__search-icon'
                                width='16'
                                height='16'
                                viewBox='0 0 24 24'
                                fill='currentColor'
                            >
                                <path d='M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' />
                            </svg>
                            <input
                                className='dpa-bots__search'
                                type='text'
                                placeholder='Search bots...'
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className='dpa-bots__risk-filters'>
                            {['All', 'Low', 'Medium', 'High'].map(r => (
                                <button
                                    key={r}
                                    className={`dpa-bots__risk-btn${risk_filter === r ? ' active' : ''}`}
                                    onClick={() => setRisk(r)}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <span className='dpa-bots__count'>{filtered.length} bots</span>
                    </div>

                    {loading ? (
                        <div className='dpa-bots__loading'>Loading bots...</div>
                    ) : bots.length === 0 ? (
                        <div className='dpa-bots__empty-state'>
                            <div className='dpa-bots__empty-icon'>🤖</div>
                            <h3>Bots Coming Soon</h3>
                            <p>The DPA team is building bots for you. Check back soon.</p>
                        </div>
                    ) : (
                        <div className='dpa-bots__grid'>
                            {filtered.map(bot => (
                                <FreeBotCard key={bot.id} bot={bot} onLoad={handleLoad} isLoaded={false} />
                            ))}
                            {filtered.length === 0 && (
                                <div className='dpa-bots__empty'>No bots found matching your search.</div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right: How It Works Panel ────────────────── */}
                <div className='dpa-bots__panel'>
                    <div className='dpa-bots__panel-empty'>
                        <div className='dpa-bots__panel-empty-icon'>🤖</div>
                        <h3>How It Works</h3>
                        {how_it_works.map(item => (
                            <div key={item.step} className='dpa-bots__how-step'>
                                <span className='dpa-bots__how-num'>{item.step}</span>
                                <span>{item.text}</span>
                            </div>
                        ))}
                        <p className='dpa-bots__panel-login-hint'>
                            ⚠️ You will need to log in when you click Run in the Bot Builder.
                        </p>
                    </div>
                </div>
            </div>

            <p className='dpa-bots__disclaimer'>
                Bots are provided for educational purposes. Past performance does not guarantee future results. Always
                test on a demo account first.
            </p>
        </div>
    );
});

export default FreeBotsPage;
