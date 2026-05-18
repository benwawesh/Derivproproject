import React, { useState, useEffect, useCallback } from 'react';
import { getLeaderboard } from 'Services/supabase';
import { supabase } from 'Services/supabase';
import TraderQRModal from 'App/Components/TraderQR';
import 'App/Components/DPAHomepage/dpa-homepage.scss';
import './leaderboard.scss';

const DPA_API = /derivprofundedacademy\.com/.test(window.location.hostname)
    ? 'https://api.derivprofundedacademy.com/api'
    : 'http://localhost:8011/api';

type TTraderProfile = {
    id: number;
    display_name: string;
    masked_id: string;
    avatar: string | null;
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

const TRADING_MARKETS = [
    {
        img: 'game-box-image-two.png',
        category: 'VOLATILITY',
        name: 'Volatility 100',
        types: ['Rise', 'Fall', 'Digits', 'Touch'],
    },
    { img: 'game-box-image-three.png', category: 'FOREX', name: 'EUR/USD', types: ['Rise', 'Fall', 'Touch', 'Miss'] },
    {
        img: 'game-box-image-four.png',
        category: 'COMMODITY',
        name: 'Gold (XAU)',
        types: ['Rise', 'Fall', 'High', 'Low'],
    },
    {
        img: 'game-box-image-five.png',
        category: 'STRATEGY',
        name: 'Rise/Fall Pro',
        types: ['Rise', 'Fall', 'Martingale'],
    },
    { img: 'game-five.png', category: 'DIGIT', name: 'Digit Over/Under', types: ['Over', 'Under', 'Even', 'Odd'] },
    { img: 'game-six.png', category: 'VOLATILITY', name: 'Volatility 50', types: ['Rise', 'Fall', 'Digits', 'Touch'] },
    { img: 'game-seven.png', category: 'BOT', name: 'Martingale Bot', types: ['Rise', 'Fall', 'Auto'] },
    {
        img: 'game-eight.png',
        category: 'VOLATILITY',
        name: 'Volatility 25',
        types: ['Rise', 'Fall', 'Digits', 'Touch'],
    },
    { img: 'game-nine.png', category: 'FOREX', name: 'GBP/USD', types: ['Rise', 'Fall', 'Touch', 'Miss'] },
    { img: 'game-ten.png', category: 'CRYPTO', name: 'BTC/USD', types: ['Rise', 'Fall', 'High', 'Low'] },
    { img: 'game-box-image-five.png', category: 'BOT', name: 'Even/Odd Bot', types: ['Even', 'Odd', 'Auto'] },
    { img: 'game-one.png', category: 'CUSTOM', name: 'Manual Trading', types: ['All', 'Markets', 'Custom'] },
];

const AVATARS = [
    '/wp-content/uploads/2025/07/winner-01.png',
    '/wp-content/uploads/2025/07/winner-02.png',
    '/wp-content/uploads/2025/07/winner-03.png',
    '/wp-content/uploads/2025/07/winner-04.png',
    '/wp-content/uploads/2025/07/winner-05.png',
    '/wp-content/uploads/2025/07/winner-06.png',
    '/wp-content/uploads/2025/07/winner-07.png',
    '/wp-content/uploads/2025/07/winner-08.png',
];

const CRYPTO_ICONS = [
    '/wp-content/uploads/2025/07/bnb.png',
    '/wp-content/uploads/2025/07/graph.png',
    '/wp-content/uploads/2025/07/tron.png',
    '/wp-content/uploads/2025/07/teth.png',
    '/wp-content/uploads/2025/07/make.png',
    '/wp-content/uploads/2025/07/inu.png',
    '/wp-content/uploads/2025/07/doge.png',
    '/wp-content/uploads/2025/07/card.png',
];

const SIMULATED: any[] = [
    {
        id: '1',
        masked_login_id: 'CR23**01',
        start_balance: 1000,
        current_balance: 1847,
        net_profit: 847,
        profit_percent: 84.7,
        total_trades: 312,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'Volatility 100',
    },
    {
        id: '2',
        masked_login_id: 'CR88**45',
        start_balance: 1000,
        current_balance: 1634,
        net_profit: 634,
        profit_percent: 63.4,
        total_trades: 278,
        bot_used: 'Martingale X',
        market_traded: 'EUR/USD',
    },
    {
        id: '3',
        masked_login_id: 'CR56**12',
        start_balance: 1000,
        current_balance: 1521,
        net_profit: 521,
        profit_percent: 52.1,
        total_trades: 445,
        bot_used: 'Digit Over',
        market_traded: 'Volatility 50',
    },
    {
        id: '4',
        masked_login_id: 'CR77**89',
        start_balance: 1000,
        current_balance: 1408,
        net_profit: 408,
        profit_percent: 40.8,
        total_trades: 189,
        bot_used: 'Manual',
        market_traded: 'Gold (XAU)',
    },
    {
        id: '5',
        masked_login_id: 'CR44**33',
        start_balance: 1000,
        current_balance: 1376,
        net_profit: 376,
        profit_percent: 37.6,
        total_trades: 356,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'Volatility 25',
    },
    {
        id: '6',
        masked_login_id: 'CR31**70',
        start_balance: 1000,
        current_balance: 1298,
        net_profit: 298,
        profit_percent: 29.8,
        total_trades: 423,
        bot_used: 'Even/Odd Bot',
        market_traded: 'Volatility 100',
    },
    {
        id: '7',
        masked_login_id: 'CR19**54',
        start_balance: 1000,
        current_balance: 1254,
        net_profit: 254,
        profit_percent: 25.4,
        total_trades: 167,
        bot_used: 'Manual',
        market_traded: 'GBP/USD',
    },
    {
        id: '8',
        masked_login_id: 'CR65**28',
        start_balance: 1000,
        current_balance: 1198,
        net_profit: 198,
        profit_percent: 19.8,
        total_trades: 298,
        bot_used: 'Martingale X',
        market_traded: 'Volatility 50',
    },
    {
        id: '9',
        masked_login_id: 'CR52**91',
        start_balance: 1000,
        current_balance: 1165,
        net_profit: 165,
        profit_percent: 16.5,
        total_trades: 234,
        bot_used: 'Digit Over',
        market_traded: 'Volatility 100',
    },
    {
        id: '10',
        masked_login_id: 'CR38**47',
        start_balance: 1000,
        current_balance: 1134,
        net_profit: 134,
        profit_percent: 13.4,
        total_trades: 312,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'EUR/USD',
    },
    {
        id: '11',
        masked_login_id: 'CR72**15',
        start_balance: 1000,
        current_balance: 1098,
        net_profit: 98,
        profit_percent: 9.8,
        total_trades: 145,
        bot_used: 'Manual',
        market_traded: 'BTC/USD',
    },
    {
        id: '12',
        masked_login_id: 'CR84**62',
        start_balance: 1000,
        current_balance: 1076,
        net_profit: 76,
        profit_percent: 7.6,
        total_trades: 267,
        bot_used: 'Even/Odd Bot',
        market_traded: 'Volatility 25',
    },
    {
        id: '13',
        masked_login_id: 'CR16**39',
        start_balance: 1000,
        current_balance: 1054,
        net_profit: 54,
        profit_percent: 5.4,
        total_trades: 189,
        bot_used: 'Martingale X',
        market_traded: 'Volatility 100',
    },
    {
        id: '14',
        masked_login_id: 'CR93**07',
        start_balance: 1000,
        current_balance: 1043,
        net_profit: 43,
        profit_percent: 4.3,
        total_trades: 223,
        bot_used: 'Manual',
        market_traded: 'GBP/USD',
    },
    {
        id: '15',
        masked_login_id: 'CR47**83',
        start_balance: 1000,
        current_balance: 1031,
        net_profit: 31,
        profit_percent: 3.1,
        total_trades: 156,
        bot_used: 'Rise/Fall Pro',
        market_traded: 'Volatility 50',
    },
];

// Tab definitions — id matches WordPress data-target="#id"
const TABS = [
    { id: 'All Winners', label: 'All Winners', icon: 'ti ti-trophy' },
    { id: 'Volatility', label: 'Volatility', icon: 'ti ti-chart-line' },
    { id: 'Forex', label: 'Forex', icon: 'ti ti-currency-dollar' },
    { id: 'Commodities', label: 'Commodities', icon: 'ti ti-diamond' },
    { id: 'Crypto', label: 'Crypto', icon: 'ti ti-currency-bitcoin' },
];

function filterEntries(tabId: string, entries: any[]): any[] {
    if (tabId === 'All Winners') return entries;
    if (tabId === 'Volatility') return entries.filter(e => /volatility/i.test(e.market_traded || ''));
    if (tabId === 'Forex') return entries.filter(e => /eur|gbp|jpy|aud|cad|chf|nzd/i.test(e.market_traded || ''));
    if (tabId === 'Commodities') return entries.filter(e => /gold|oil|silver|xau|xag/i.test(e.market_traded || ''));
    if (tabId === 'Crypto') return entries.filter(e => /btc|eth|bitcoin|ethereum|crypto/i.test(e.market_traded || ''));
    return entries;
}

function useBetwinLeaderboardAssets() {
    useEffect(() => {
        let aosObserver: IntersectionObserver | null = null;
        let initTimer: ReturnType<typeof setTimeout> | null = null;

        initTimer = setTimeout(() => {
            const sc = document.getElementById('app_contents');
            if (sc) {
                document.querySelectorAll('.title-animation').forEach((el: Element) => {
                    if (el.querySelector('.title-char')) return;
                    const text = (el.textContent || '').trim();
                    if (!text) return;
                    let charIdx = 0;
                    el.innerHTML = text
                        .split(' ')
                        .map((word: string) => {
                            const wordHtml = word
                                .split('')
                                .map((ch: string) => {
                                    const delay = (charIdx * 0.04).toFixed(2);
                                    charIdx++;
                                    const tr = `opacity 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s,transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s`;
                                    const esc = ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
                                    return `<span class="title-char" data-tr="${tr}" style="display:inline-block;opacity:0;transform:translateX(40px);transition:${tr}">${esc}</span>`;
                                })
                                .join('');
                            return `<span style="display:inline-block;white-space:nowrap">${wordHtml}</span>`;
                        })
                        .join('<span style="display:inline-block;min-width:0.3em">&nbsp;</span>');
                    const io = new IntersectionObserver(
                        entries => {
                            entries.forEach(entry => {
                                const chars = Array.from(el.querySelectorAll('.title-char')) as HTMLElement[];
                                if (entry.isIntersecting) {
                                    chars.forEach(span => {
                                        span.style.opacity = '1';
                                        span.style.transform = 'translateX(0)';
                                    });
                                } else {
                                    chars.forEach(span => {
                                        span.style.transition = 'none';
                                        span.style.opacity = '0';
                                        span.style.transform = 'translateX(40px)';
                                        requestAnimationFrame(() => {
                                            span.style.transition = span.dataset.tr || '';
                                        });
                                    });
                                }
                            });
                        },
                        { root: sc, threshold: 0.1 }
                    );
                    io.observe(el);
                });

                aosObserver = new IntersectionObserver(
                    entries => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) entry.target.classList.add('aos-animate');
                            else entry.target.classList.remove('aos-animate');
                        });
                    },
                    { root: sc, threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
                );
                document.querySelectorAll('[data-aos]').forEach(el => aosObserver!.observe(el));
            }
        }, 300);

        return () => {
            if (initTimer) clearTimeout(initTimer);
            aosObserver?.disconnect();
        };
    }, []);
}

type TWinnerTableProps = { title: string; entries: any[]; offset?: number };

const WinnerTable = ({ title, entries, offset = 0 }: TWinnerTableProps) => (
    <div className='win-t-wrapper'>
        <div className='lottery-intro mb-30'>
            <h6 className='title-animation fw-6 neutral-top'>{title}</h6>
            <a href='#'>See All</a>
        </div>
        <div className='winning-table'>
            <table>
                <thead>
                    <tr>
                        <th>
                            <div className='th-wrap'>
                                Trader{' '}
                                <span>
                                    <i className='fa-solid fa-caret-up' />
                                    <i className='fa-solid fa-caret-down' />
                                </span>
                            </div>
                        </th>
                        <th>
                            <div className='th-wrap'>
                                Market{' '}
                                <span>
                                    <i className='fa-solid fa-caret-up' />
                                    <i className='fa-solid fa-caret-down' />
                                </span>
                            </div>
                        </th>
                        <th>
                            <div className='th-wrap'>
                                Balance{' '}
                                <span>
                                    <i className='fa-solid fa-caret-up' />
                                    <i className='fa-solid fa-caret-down' />
                                </span>
                            </div>
                        </th>
                        <th>
                            <div className='th-wrap'>
                                Profit{' '}
                                <span>
                                    <i className='fa-solid fa-caret-up' />
                                    <i className='fa-solid fa-caret-down' />
                                </span>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {entries.length === 0 ? (
                        <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>
                                No winners in this category yet
                            </td>
                        </tr>
                    ) : (
                        entries.map((entry, i) => {
                            const idx = offset + i;
                            return (
                                <tr key={entry.id}>
                                    <td>
                                        <div className='author__info'>
                                            <div className='author__info'>
                                                <div className='thumb'>
                                                    <img src={AVATARS[idx % AVATARS.length]} alt='Trader' />
                                                </div>
                                                <div className='content'>
                                                    <p className='fw-6'>{entry.masked_login_id}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{entry.market_traded || '—'}</td>
                                    <td>${entry.current_balance?.toFixed(0)}</td>
                                    <td>
                                        <div className='author__info'>
                                            <div className='thumb'>
                                                <img src={CRYPTO_ICONS[idx % CRYPTO_ICONS.length]} alt='profit' />
                                            </div>
                                            <div className='content'>
                                                <p className='fw-6'>+${entry.net_profit?.toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const LeaderboardPage = () => {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All Winners');
    const [champions, setChampions] = useState<TTraderProfile[]>([]);
    const [qr_trader, setQrTrader] = useState<TTraderProfile | null>(null);

    useBetwinLeaderboardAssets();

    const loadData = useCallback(async () => {
        try {
            const lb = await getLeaderboard();
            setEntries(lb?.length ? lb : SIMULATED);
        } catch {
            setEntries(SIMULATED);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const channel = (supabase.channel('leaderboard-changes') as any)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, loadData)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    useEffect(() => {
        fetch(`${DPA_API}/trader-profiles/?placement=leaderboard`)
            .then(r => r.json())
            .then(data => setChampions(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    return (
        <div className='betwins-page'>
            {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
            <div className='breadcrumb-wrap breadcrumb-wrap-icon navbar-style-02'>
                <div className='container'>
                    <div className='row'>
                        <div className='col-lg-12'>
                            <div className='breadcrumb-content'>
                                <h2 className='page-title'>Leaderboard</h2>
                                <ul className='page-list'>
                                    <li>
                                        <a href='/'>Home</a>
                                    </li>
                                    <li>
                                        <span>Leaderboard</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id='content' className='site-content'>
                {/* ── Trading Market Cards ─────────────────────────────────────── */}
                <div className='section-pad'>
                    <div className='container'>
                        <div className='section__header text-center mb-55' data-aos='fade-up' data-aos-duration='1000'>
                            <span className='fw-6 secondary-text text-xl'>
                                <strong>Active,</strong> Trading Markets
                            </span>
                            <h2 className='title-animation fw-6 mt-25'>Choose Your Market</h2>
                            <p className='mt-25 title-description'>
                                Pick a market to trade, climb the leaderboard, and win a funded account worth up to
                                $10,000.
                            </p>
                        </div>
                        <div className='row g-4'>
                            {TRADING_MARKETS.map((market, i) => (
                                <div key={i} className='col-lg-3 col-md-4 col-sm-6'>
                                    <div data-aos='fade-left' data-aos-duration='600' data-aos-delay={String(i * 50)}>
                                        <div className='lt-type__single text-center tilt'>
                                            <span className='serial'>Featured</span>
                                            <span className='price'>
                                                <i className='fa-solid fa-star' /> 5
                                            </span>
                                            <div className='thumb'>
                                                <img
                                                    src={`/wp-content/uploads/2025/07/${market.img}`}
                                                    alt={market.name}
                                                />
                                            </div>
                                            <div className='content mt-25'>
                                                <span className='text-uppercase fw-6 secondary-text'>
                                                    {market.category}
                                                </span>
                                                <h6 className='fw-6 mt-8'>{market.name}</h6>
                                                <ul className='platform justify-content-center mt-12'>
                                                    {market.types.map((t, j) => (
                                                        <React.Fragment key={j}>
                                                            <li>{t}</li>
                                                            {j < market.types.length - 1 && (
                                                                <li>
                                                                    <span />
                                                                </li>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className='cta mt-25'>
                                                <a href='/bot' className='btn--primary'>
                                                    Trade Now <i className='ti ti-arrow-narrow-right' />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Recent Champions Section ─────────────────────────────────── */}
                <div
                    className='section-pad'
                    style={{
                        backgroundImage: 'url(/wp-content/uploads/2025/07/game-bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center center',
                        backgroundRepeat: 'no-repeat',
                    }}
                >
                    <div className='container'>
                        <div
                            className='section__header text-center'
                            style={{ marginBottom: '40px' }}
                            data-aos='fade-up'
                            data-aos-duration='1000'
                        >
                            <span className='fw-6 secondary-text text-xl'>
                                <strong>Latest,</strong> Trading Winners
                            </span>
                            <h2 className='title-animation fw-6 mt-25'>Recent Champions in Action</h2>
                            <p className='mt-25 title-description'>
                                We celebrate every trade win, no matter how big or small. Our platform rewards traders
                                who show discipline and strategy daily.
                            </p>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#aaa', fontSize: '18px' }}>
                                Loading leaderboard...
                            </div>
                        ) : (
                            <div className='ch-list ch-list-alternate'>
                                {/* Filter tabs — data-target="#TabId" matches ch-list__single id */}
                                <div className='row justify-content-center'>
                                    <div className='col-12'>
                                        <div
                                            className='ch-list__btns mb-40'
                                            data-aos='fade-up'
                                            data-aos-duration='600'
                                            data-aos-delay='200'
                                        >
                                            <ul className='p-2'>
                                                {TABS.map(tab => (
                                                    <li key={tab.id}>
                                                        <button
                                                            data-target={`#${tab.id}`}
                                                            className={`ch-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                                                            onClick={() => setActiveTab(tab.id)}
                                                        >
                                                            <i className={tab.icon} /> {tab.label}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* One ch-list__single per tab — same pattern as WordPress game-two */}
                                <div
                                    className='ch-list__inner'
                                    data-aos='fade-up'
                                    data-aos-duration='600'
                                    data-aos-delay='400'
                                >
                                    {TABS.map(tab => {
                                        const tabEntries = filterEntries(tab.id, entries);
                                        const left = tabEntries.slice(0, 8);
                                        const right =
                                            tabEntries.length > 3 ? tabEntries.slice(3, 11) : tabEntries.slice(0, 8);
                                        return (
                                            <div
                                                key={tab.id}
                                                className='ch-list__single'
                                                id={tab.id}
                                                style={{ display: activeTab === tab.id ? 'block' : 'none' }}
                                            >
                                                <div className='row gutter-40'>
                                                    <div className='col-12 col-xl-6'>
                                                        <WinnerTable title='Top Traders' entries={left} offset={0} />
                                                    </div>
                                                    <div className='col-12 col-xl-6'>
                                                        <WinnerTable
                                                            title='Recent Winners'
                                                            entries={right}
                                                            offset={8}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Champions Spotlight ─────────────────────────────────────────── */}
            {champions.length > 0 && (
                <div className='champion section-pad'>
                    <div className='container'>
                        <div className='section__header text-center mb-50' data-aos='fade-up' data-aos-duration='1000'>
                            <span className='fw-6 secondary-text text-xl'>
                                <strong>Verified,</strong> Champions
                            </span>
                            <h2 className='title-animation fw-6 mt-25'>Trading Champions Spotlight</h2>
                            <p className='mt-25 title-description'>
                                Scan the QR code to view their full verified trade report on your device.
                            </p>
                        </div>
                        <div className='row gutter-24'>
                            {champions.map((trader, i) => (
                                <div
                                    key={trader.id}
                                    className='col-12 col-md-6 col-xl-4 col-xxl-3'
                                    data-aos='fade-up'
                                    data-aos-duration='600'
                                >
                                    <div className='lt-type__single champion__single text-center tilt'>
                                        <span className='serial'>#{i + 1}</span>
                                        <div className='thumb'>
                                            {trader.avatar ? (
                                                <img src={trader.avatar} alt={trader.display_name} />
                                            ) : (
                                                <div
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #9cecfe, #0072ff)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '32px',
                                                        fontWeight: 700,
                                                        color: '#1d1e24',
                                                        margin: '0 auto',
                                                    }}
                                                >
                                                    {trader.display_name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className='content mt-20'>
                                            <h6 className='fw-6'>{trader.display_name}</h6>
                                            <p className='text-sm mt-4 primary-text'>
                                                {trader.bot_used || trader.market_traded}
                                            </p>
                                        </div>
                                        <div className='cta mt-25'>
                                            <ul className='champion'>
                                                <li className='active'>{trader.win_rate}%</li>
                                                <li>{trader.total_trades} trades</li>
                                                <li style={{ color: trader.net_profit >= 0 ? '#4caf50' : '#ef5350' }}>
                                                    {trader.net_profit >= 0 ? '+' : ''}${trader.net_profit.toFixed(2)}
                                                </li>
                                            </ul>
                                        </div>
                                        <div className='timer mt-30'>
                                            <button
                                                onClick={() => setQrTrader(trader)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(156,236,254,0.1)',
                                                    border: '1px solid rgba(156,236,254,0.3)',
                                                    borderRadius: '8px',
                                                    padding: '8px 18px',
                                                    color: '#9cecfe',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <i className='ti ti-qrcode' /> View Trade Report
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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

export default LeaderboardPage;
