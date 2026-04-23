import { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { observer, useStore } from '@deriv/stores';
import { redirectToLogin, routes } from '@deriv/shared';
import { getLanguage } from '@deriv/translations';
import HomeSlider from './HomeSlider';
import LiveChart from './LiveChart';
import Testimonials from './Testimonials';
import './dpa-homepage.scss';

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IcBot = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM9.5 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' />
    </svg>
);
const IcTrophy = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z' />
    </svg>
);
const IcBoard = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M7 4H2v16h5V4zm5-2H7v18h5V2zm5 7h-5v11h5V9zm5 2h-5v9h5v-9z' />
    </svg>
);
const IcChart = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z' />
    </svg>
);
const IcCopy = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z' />
    </svg>
);
const IcAnalysis = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z' />
    </svg>
);
const IcFree = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z' />
    </svg>
);
const IcClock = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z' />
    </svg>
);
const IcUp = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z' />
    </svg>
);
const IcGlobe = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z' />
    </svg>
);
const IcPercent = () => (
    <svg viewBox='0 0 24 24' fill='currentColor'>
        <path d='M7.5 11C9.43 11 11 9.43 11 7.5S9.43 4 7.5 4 4 5.57 4 7.5 5.57 11 7.5 11zm0-5C8.33 6 9 6.67 9 7.5S8.33 9 7.5 9 6 8.33 6 7.5 6.67 6 7.5 6zM4.0 19.5L19.5 4.0l1.41 1.41L5.41 20.91zM16.5 13c-1.93 0-3.5 1.57-3.5 3.5S14.57 20 16.5 20s3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm0 5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z' />
    </svg>
);

// ── Simulated Live Feed ───────────────────────────────────────────────────────
const FEED_POOL = [
    { loginid: 'CR23**01', text: 'just passed Phase 1', type: 'phase' },
    { loginid: 'CR88**45', text: 'won $3,000 in competition', type: 'win' },
    { loginid: 'CR12**78', text: 'just passed Phase 2', type: 'phase' },
    { loginid: 'CR56**23', text: 'earned a $5,000 funded account', type: 'funded' },
    { loginid: 'CR99**67', text: 'won $1,000 in competition', type: 'win' },
    { loginid: 'CR44**19', text: 'just passed Phase 1', type: 'phase' },
    { loginid: 'CR31**85', text: 'won $7,000 in competition', type: 'win' },
    { loginid: 'CR77**02', text: 'earned a $10,000 funded account', type: 'funded' },
    { loginid: 'CR65**33', text: 'just passed Phase 2', type: 'phase' },
    { loginid: 'CR18**90', text: 'won $2,000 in competition', type: 'win' },
    { loginid: 'CR52**74', text: 'just passed Phase 1', type: 'phase' },
    { loginid: 'CR39**61', text: 'earned a $3,000 funded account', type: 'funded' },
];

const FEATURES = [
    {
        Ic: IcBot,
        title: 'Bot Builder',
        desc: 'Build automated bots — no coding needed. Rise/Fall, Martingale and more.',
        path: '/bot',
    },
    {
        Ic: IcTrophy,
        title: 'Funded Challenge',
        desc: 'Pass 3 phases, get a funded account up to $10,000. Completely free to enter.',
        path: '/challenge',
    },
    {
        Ic: IcBoard,
        title: 'Live Leaderboard',
        desc: 'Compete monthly. Top 10 win funded accounts. Positions 11–20 get doubled balance.',
        path: '/leaderboard',
    },
    {
        Ic: IcChart,
        title: 'D-Trader',
        desc: 'Trade options & multipliers on Synthetic Indices, Forex and Crypto 24/7.',
        path: routes.trade,
    },
    {
        Ic: IcCopy,
        title: 'Copy Trading',
        desc: 'Copy top-performing traders automatically and grow your balance hands-free.',
        path: '/copy-trading',
    },
    {
        Ic: IcAnalysis,
        title: 'Analysis Tools',
        desc: 'Advanced charts, indicators and market signals to sharpen your strategy.',
        path: '/analysis',
    },
];

const WHY = [
    { Ic: IcFree, title: 'Free to Join', desc: 'No subscription. No challenge entry fee. Zero cost to start.' },
    {
        Ic: IcBot,
        title: 'Bots Allowed',
        desc: 'Unlike other prop firms, we allow and encourage automated bot trading.',
    },
    {
        Ic: IcClock,
        title: '24/7 Synthetics',
        desc: 'Trade Synthetic Indices any time — weekends and holidays included.',
    },
    {
        Ic: IcUp,
        title: 'Scale Up Program',
        desc: 'Hit targets consistently and your funded account doubles automatically.',
    },
    { Ic: IcGlobe, title: 'Built for Africa', desc: 'Designed for African traders. No geographic restrictions.' },
    { Ic: IcPercent, title: '3% Commission Only', desc: 'We only earn when you trade. Your success is our success.' },
];

const PRIZES = [
    { place: '1st', prize: '$10,000', label: 'Funded Account', gold: true },
    { place: '2nd', prize: '$7,000', label: 'Funded Account', gold: false },
    { place: '3rd', prize: '$5,000', label: 'Funded Account', gold: false },
    { place: '4th', prize: '$3,000', label: 'Funded Account', gold: false },
    { place: '5th', prize: '$2,000', label: 'Funded Account', gold: false },
    { place: '6th–10th', prize: '$1,000', label: 'Funded Account each', gold: false },
    { place: '11th–20th', prize: '2× Balance', label: 'Balance Doubled', gold: false },
];

const STATS = [
    { value: '24/7', label: 'Market Access' },
    { value: '$10K', label: 'Max Funded' },
    { value: '80%', label: 'Profit Split' },
    { value: 'FREE', label: 'To Enter' },
];

// ── Component ─────────────────────────────────────────────────────────────────
const DPAHomepage = observer(() => {
    const { client } = useStore();
    const { is_logged_in } = client;
    const history = useHistory();

    const go = (path: any) => history.push(path);
    const goChallenge = () => (is_logged_in ? go('/challenge') : redirectToLogin(false, getLanguage()));

    // Live feed state
    const [feed, setFeed] = useState(FEED_POOL.slice(0, 6));
    const indexRef = useRef(6);

    useEffect(() => {
        const t = setInterval(() => {
            const next = FEED_POOL[indexRef.current % FEED_POOL.length];
            indexRef.current += 1;
            setFeed(prev => [next, ...prev.slice(0, 5)]);
        }, 3500);
        return () => clearInterval(t);
    }, []);

    return (
        <div className='dpa-home'>
            {/* ── Hero ───────────────────────────────────────────────────── */}
            <section className='dpa-home__hero'>
                <div className='dpa-home__hero-left'>
                    <h1 className='dpa-home__hero-title'>
                        Trade Smarter.
                        <br />
                        <span>Get Funded.</span>
                    </h1>
                    <p className='dpa-home__hero-sub'>
                        Join DerivProAcademy — build your trading bot, compete on the leaderboard, and earn a funded
                        account up to <strong>$10,000</strong>. Completely free.
                    </p>
                    <div className='dpa-home__hero-btns'>
                        <button className='dpa-home__btn primary' onClick={goChallenge}>
                            Start Challenge — FREE
                        </button>
                        <button className='dpa-home__btn secondary' onClick={() => go('/leaderboard')}>
                            Join Competition
                        </button>
                    </div>
                    <div className='dpa-home__stats'>
                        {STATS.map(s => (
                            <div key={s.label} className='dpa-home__stat'>
                                <div className='dpa-home__stat-value'>{s.value}</div>
                                <div className='dpa-home__stat-label'>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Live Feed */}
                <div className='dpa-home__live-feed'>
                    <div className='dpa-home__live-feed-header'>
                        <span className='dpa-home__live-dot' />
                        Live Activity
                    </div>
                    <div className='dpa-home__live-feed-list'>
                        {feed.map((item, i) => (
                            <div
                                key={`${item.loginid}-${i}`}
                                className={`dpa-home__live-item dpa-home__live-item--${item.type} ${i === 0 ? 'new' : ''}`}
                            >
                                <div className='dpa-home__live-avatar'>{item.loginid.charAt(0)}</div>
                                <div className='dpa-home__live-text'>
                                    <span className='dpa-home__live-id'>{item.loginid}</span>
                                    <span className='dpa-home__live-action'>{item.text}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Slider ─────────────────────────────────────────────────── */}
            <HomeSlider />

            {/* ── Live Chart ─────────────────────────────────────────────── */}
            <section className='dpa-home__chart-section'>
                <div className='dpa-home__section-header'>
                    <h2>Live Market Charts</h2>
                    <p>Real-time prices with entry & exit signals — Synthetic Indices, Forex, Gold, Oil</p>
                </div>
                <LiveChart />
            </section>

            {/* ── Two Paths ──────────────────────────────────────────────── */}
            <section className='dpa-home__paths'>
                <div className='dpa-home__path-card dpa-home__path-card--challenge' onClick={goChallenge}>
                    <div className='dpa-home__path-icon'>
                        <IcTrophy />
                    </div>
                    <h3>Funded Challenge</h3>
                    <p>
                        Pass 3 phases at your own pace and earn a funded account up to $10,000. Keep 80% of all profits.
                        Free to enter, no time pressure.
                    </p>
                    <span className='dpa-home__path-link'>Start Challenge &#8594;</span>
                </div>
                <div
                    className='dpa-home__path-card dpa-home__path-card--competition'
                    onClick={() => go('/leaderboard')}
                >
                    <div className='dpa-home__path-icon'>
                        <IcBoard />
                    </div>
                    <h3>Monthly Competition</h3>
                    <p>
                        Compete against all traders every month. Ranked by net profit. Top 20 win cash prizes and funded
                        accounts. Resets every period.
                    </p>
                    <span className='dpa-home__path-link'>View Leaderboard &#8594;</span>
                </div>
            </section>

            {/* ── Prize Tiers ────────────────────────────────────────────── */}
            <section className='dpa-home__prizes'>
                <div className='dpa-home__section-header'>
                    <h2>Competition Prize Tiers</h2>
                    <p>Every month, the top 20 traders win. Here's what's up for grabs.</p>
                </div>
                <div className='dpa-home__prizes-grid'>
                    {PRIZES.map(p => (
                        <div key={p.place} className={`dpa-home__prize-card${p.gold ? ' gold' : ''}`}>
                            <div className='dpa-home__prize-place'>{p.place}</div>
                            <div className='dpa-home__prize-amount'>{p.prize}</div>
                            <div className='dpa-home__prize-label'>{p.label}</div>
                        </div>
                    ))}
                </div>
                <div className='dpa-home__prizes-cta'>
                    <button className='dpa-home__btn primary' onClick={() => go('/leaderboard')}>
                        View Live Leaderboard
                    </button>
                </div>
            </section>

            {/* ── Challenge Phases ───────────────────────────────────────── */}
            <section className='dpa-home__challenge'>
                <div className='dpa-home__section-header'>
                    <h2>The Funded Challenge Path</h2>
                    <p>Three phases stand between you and a funded account.</p>
                </div>
                <div className='dpa-home__phases'>
                    <div className='dpa-home__phase'>
                        <div className='dpa-home__phase-num'>Phase 1</div>
                        <div className='dpa-home__phase-target'>30% Profit</div>
                        <div className='dpa-home__phase-duration'>30 Days</div>
                        <div className='dpa-home__phase-rule'>Max 10% daily loss</div>
                    </div>
                    <div className='dpa-home__phase-arrow'>&#8594;</div>
                    <div className='dpa-home__phase'>
                        <div className='dpa-home__phase-num'>Phase 2</div>
                        <div className='dpa-home__phase-target'>30% Profit</div>
                        <div className='dpa-home__phase-duration'>15 Days</div>
                        <div className='dpa-home__phase-rule'>Prove consistency</div>
                    </div>
                    <div className='dpa-home__phase-arrow'>&#8594;</div>
                    <div className='dpa-home__phase dpa-home__phase--funded'>
                        <div className='dpa-home__phase-num'>Phase 3</div>
                        <div className='dpa-home__phase-target'>Funded!</div>
                        <div className='dpa-home__phase-duration'>Up to $10,000</div>
                        <div className='dpa-home__phase-rule'>80% profit split</div>
                    </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    <button className='dpa-home__btn primary' onClick={goChallenge}>
                        {is_logged_in ? 'Join Challenge Now' : 'Log in to Join — FREE'}
                    </button>
                </div>
            </section>

            {/* ── Features ───────────────────────────────────────────────── */}
            <section className='dpa-home__features'>
                <div className='dpa-home__section-header'>
                    <h2>Everything You Need to Trade</h2>
                    <p>All tools in one powerful platform</p>
                </div>
                <div className='dpa-home__features-grid'>
                    {FEATURES.map(f => (
                        <div key={f.title} className='dpa-home__feature-card' onClick={() => go(f.path)}>
                            <div className='dpa-home__feature-icon'>
                                <f.Ic />
                            </div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Why DPA ────────────────────────────────────────────────── */}
            <section className='dpa-home__why'>
                <div className='dpa-home__section-header light'>
                    <h2>Why DerivProAcademy?</h2>
                </div>
                <div className='dpa-home__why-grid'>
                    {WHY.map(w => (
                        <div key={w.title} className='dpa-home__why-card'>
                            <div className='dpa-home__why-icon'>
                                <w.Ic />
                            </div>
                            <h4>{w.title}</h4>
                            <p>{w.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Testimonials ───────────────────────────────────────────── */}
            <Testimonials />

            {/* ── CTA ────────────────────────────────────────────────────── */}
            <section className='dpa-home__cta'>
                <h2>Ready to get funded?</h2>
                <p>Join hundreds of traders already competing on DerivProAcademy</p>
                <button className='dpa-home__btn white' onClick={goChallenge}>
                    {is_logged_in ? 'Go to Challenge' : 'Get Started — FREE'}
                </button>
            </section>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <footer className='dpa-home__footer'>
                <div className='dpa-home__footer-inner'>
                    <div className='dpa-home__footer-brand'>
                        <span className='name'>DerivPro</span>
                        <span className='academy'>Academy</span>
                    </div>
                    <p>DerivProAcademy is an independent third-party platform. Not affiliated with Deriv Ltd.</p>
                    <p>Trading involves risk. Never trade with money you cannot afford to lose.</p>
                </div>
            </footer>
        </div>
    );
});

export default DPAHomepage;
