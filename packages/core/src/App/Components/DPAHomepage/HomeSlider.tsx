import { useState, useEffect, useCallback } from 'react';

const SLIDES = [
    {
        id: 1,
        tag: 'Live Markets',
        title: 'Real-Time Charts',
        subtitle:
            "Trade Forex, Gold, Oil & Synthetic Indices with live entry and exit signals powered by Deriv's market data.",
        bg: '#800000',
        light: true,
        visual: 'chart',
    },
    {
        id: 2,
        tag: 'Automation',
        title: 'Build Your Trading Bot',
        subtitle:
            'Create automated strategies with no coding required. Rise/Fall, Martingale, Digit Over/Under and more — all free.',
        bg: '#fff',
        light: false,
        visual: 'bot',
        points: ['No coding required', 'Multiple strategies', 'Run 24/7 automatically', 'Track performance live'],
    },
    {
        id: 3,
        tag: 'Monthly Competition',
        title: 'Compete & Win Funded Accounts',
        subtitle: 'Every month, the top 20 traders win cash and funded accounts. Ranked purely by net profit.',
        bg: '#fff',
        light: false,
        visual: 'leaderboard',
        rows: [
            { place: '1st', loginid: 'CR23**01', profit: '+$4,280', prize: '$10K Funded' },
            { place: '2nd', loginid: 'CR88**45', profit: '+$3,150', prize: '$7K Funded' },
            { place: '3rd', loginid: 'CR12**78', profit: '+$2,890', prize: '$5K Funded' },
            { place: '4th', loginid: 'CR56**23', profit: '+$2,100', prize: '$3K Funded' },
            { place: '5th', loginid: 'CR99**67', profit: '+$1,850', prize: '$2K Funded' },
        ],
    },
    {
        id: 4,
        tag: 'Funded Challenge',
        title: 'Your Path to a Funded Account',
        subtitle: 'Three phases stand between you and a $10,000 funded account. Free to enter. Keep 80% of profits.',
        bg: '#800000',
        light: true,
        visual: 'phases',
    },
];

const ChartVisual = () => (
    <div className='dpa-slider__visual dpa-slider__visual--chart'>
        <svg viewBox='0 0 320 160' preserveAspectRatio='none' className='dpa-slider__fake-chart'>
            <defs>
                <linearGradient id='sg' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#22c55e' stopOpacity='0.35' />
                    <stop offset='100%' stopColor='#22c55e' stopOpacity='0' />
                </linearGradient>
            </defs>
            <path
                d='M0,140 L20,120 L40,130 L60,100 L80,110 L100,80 L120,90 L140,60 L160,70 L180,45 L200,55 L220,30 L240,40 L260,20 L280,30 L300,15 L320,20 L320,160 L0,160 Z'
                fill='url(#sg)'
            />
            <path
                d='M0,140 L20,120 L40,130 L60,100 L80,110 L100,80 L120,90 L140,60 L160,70 L180,45 L200,55 L220,30 L240,40 L260,20 L280,30 L300,15 L320,20'
                fill='none'
                stroke='#22c55e'
                strokeWidth='2.5'
            />
            {/* Buy signal */}
            <polygon points='100,75 93,88 107,88' fill='#22c55e' />
            <text x='100' y='72' textAnchor='middle' fontSize='8' fill='#22c55e' fontWeight='800'>
                BUY
            </text>
            {/* Sell signal */}
            <polygon points='220,35 213,22 227,22' fill='#ef4444' />
            <text x='220' y='46' textAnchor='middle' fontSize='8' fill='#ef4444' fontWeight='800'>
                SELL
            </text>
            {/* Price labels */}
            <text x='310' y='24' fontSize='7' fill='rgba(255,255,255,0.5)'>
                High
            </text>
            <text x='310' y='145' fontSize='7' fill='rgba(255,255,255,0.5)'>
                Low
            </text>
        </svg>
        <div className='dpa-slider__ticker'>
            <span className='dpa-slider__ticker-sym'>VOL 100</span>
            <span className='dpa-slider__ticker-price'>8,432.15</span>
            <span className='dpa-slider__ticker-up'>▲ 0.42%</span>
        </div>
    </div>
);

const BotVisual = ({ points }: { points: string[] }) => (
    <div className='dpa-slider__visual dpa-slider__visual--bot'>
        <div className='dpa-slider__bot-card'>
            <div className='dpa-slider__bot-header'>
                <div className='dpa-slider__bot-dot running' />
                <span>Bot Running — Rise/Fall Strategy</span>
            </div>
            <div className='dpa-slider__bot-stats'>
                <div>
                    <span>Trades Today</span>
                    <b>47</b>
                </div>
                <div>
                    <span>Win Rate</span>
                    <b className='green'>68%</b>
                </div>
                <div>
                    <span>Profit</span>
                    <b className='green'>+$124.50</b>
                </div>
            </div>
            <ul className='dpa-slider__points'>
                {points.map(p => (
                    <li key={p}>
                        <svg viewBox='0 0 24 24' fill='currentColor' width='16' height='16'>
                            <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                        </svg>
                        {p}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const LeaderboardVisual = ({ rows }: { rows: (typeof SLIDES)[2]['rows'] }) => (
    <div className='dpa-slider__visual dpa-slider__visual--leaderboard'>
        <table className='dpa-slider__lb-table'>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Trader</th>
                    <th>Profit</th>
                    <th>Prize</th>
                </tr>
            </thead>
            <tbody>
                {rows?.map(r => (
                    <tr key={r.place} className={r.place === '1st' ? 'gold' : ''}>
                        <td>{r.place}</td>
                        <td>{r.loginid}</td>
                        <td className='green'>{r.profit}</td>
                        <td className='prize'>{r.prize}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const PhasesVisual = () => (
    <div className='dpa-slider__visual dpa-slider__visual--phases'>
        {[
            { n: '1', label: 'Phase 1', val: '30% Profit', sub: '30 Days', done: false },
            { n: '2', label: 'Phase 2', val: '30% Profit', sub: '15 Days', done: false },
            { n: '3', label: 'Funded!', val: 'Up to $10K', sub: '80% split', done: true },
        ].map((p, i) => (
            <div key={p.n} className='dpa-slider__phase-item'>
                {i > 0 && <div className='dpa-slider__phase-arrow'>&#8594;</div>}
                <div className={`dpa-slider__phase-box${p.done ? ' funded' : ''}`}>
                    <div className='dpa-slider__phase-label'>{p.label}</div>
                    <div className='dpa-slider__phase-val'>{p.val}</div>
                    <div className='dpa-slider__phase-sub'>{p.sub}</div>
                </div>
            </div>
        ))}
    </div>
);

export default function HomeSlider() {
    const [current, setCurrent] = useState(0);

    const next = useCallback(() => setCurrent(c => (c + 1) % SLIDES.length), []);
    const prev = useCallback(() => setCurrent(c => (c - 1 + SLIDES.length) % SLIDES.length), []);

    useEffect(() => {
        const t = setInterval(next, 6000);
        return () => clearInterval(t);
    }, [next]);

    const slide = SLIDES[current];

    return (
        <div className='dpa-slider' style={{ background: slide.bg }}>
            <div className='dpa-slider__inner'>
                {/* Left content */}
                <div className='dpa-slider__content'>
                    <span
                        className='dpa-slider__tag'
                        style={{
                            color: slide.light ? '#ffd700' : '#800000',
                            borderColor: slide.light ? 'rgba(255,215,0,0.4)' : 'rgba(128,0,0,0.3)',
                        }}
                    >
                        {slide.tag}
                    </span>
                    <h2 className='dpa-slider__title' style={{ color: slide.light ? '#fff' : '#111' }}>
                        {slide.title}
                    </h2>
                    <p
                        className='dpa-slider__subtitle'
                        style={{ color: slide.light ? 'rgba(255,255,255,0.8)' : '#555' }}
                    >
                        {slide.subtitle}
                    </p>
                </div>

                {/* Right visual */}
                {slide.visual === 'chart' && <ChartVisual />}
                {slide.visual === 'bot' && <BotVisual points={slide.points || []} />}
                {slide.visual === 'leaderboard' && <LeaderboardVisual rows={slide.rows || []} />}
                {slide.visual === 'phases' && <PhasesVisual />}
            </div>

            {/* Controls */}
            <button className='dpa-slider__arrow dpa-slider__arrow--prev' onClick={prev}>
                &#8249;
            </button>
            <button className='dpa-slider__arrow dpa-slider__arrow--next' onClick={next}>
                &#8250;
            </button>

            {/* Dots */}
            <div className='dpa-slider__dots'>
                {SLIDES.map((_, i) => (
                    <button
                        key={i}
                        className={`dpa-slider__dot${i === current ? ' active' : ''}`}
                        style={{
                            background: slide.light
                                ? i === current
                                    ? '#ffd700'
                                    : 'rgba(255,255,255,0.4)'
                                : i === current
                                  ? '#800000'
                                  : 'rgba(0,0,0,0.2)',
                        }}
                        onClick={() => setCurrent(i)}
                    />
                ))}
            </div>
        </div>
    );
}
