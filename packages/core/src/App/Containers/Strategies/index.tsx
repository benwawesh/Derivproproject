import { useState } from 'react';
import './strategies.scss';

const STRATEGIES = [
    {
        id: 1,
        name: 'Martingale',
        category: 'Recovery',
        difficulty: 'Intermediate',
        summary: 'Double your stake after every loss to recover all losses with a single win.',
        how_it_works: [
            'Start with a base stake (e.g. $1).',
            'If you lose, double the stake for the next trade.',
            'If you win, return to the base stake.',
            'A single win always recovers all previous losses plus the base profit.',
        ],
        pros: ['Quick recovery after losses', 'Simple to execute', 'Works with any trade type'],
        cons: ['Exponential stake growth', 'Can blow account fast on long losing streak', 'Requires large buffer'],
        best_market: 'Volatility 100 / 50',
        risk: 'High',
        is_popular: true,
        example: 'Stake: $1 → Loss → $2 → Loss → $4 → Win → Profit: $1',
    },
    {
        id: 2,
        name: "D'Alembert",
        category: 'Recovery',
        difficulty: 'Beginner',
        summary: 'Increase stake by 1 unit after a loss, decrease by 1 unit after a win. Gentler than Martingale.',
        how_it_works: [
            'Set a unit size (e.g. $1).',
            'After a loss: add 1 unit to your next stake.',
            'After a win: subtract 1 unit from your next stake.',
            'Minimum stake is always the base unit.',
        ],
        pros: ['Much slower stake growth than Martingale', 'Easy to manage', 'Good for even/odd markets'],
        cons: ['Slower recovery', 'Requires more wins to break even', 'Not as aggressive'],
        best_market: 'Even/Odd on Volatility 25',
        risk: 'Medium',
        is_popular: false,
        example: 'Stake: $1 → Loss → $2 → Loss → $3 → Win → $2 → Win → $1',
    },
    {
        id: 3,
        name: 'Trend Following',
        category: 'Technical',
        difficulty: 'Beginner',
        summary: 'Trade in the direction of the prevailing market trend using moving averages or price action.',
        how_it_works: [
            'Identify the trend direction (up = bullish, down = bearish).',
            'Enter Rise trades in an uptrend, Fall trades in a downtrend.',
            'Use the Analysis Tool to confirm the dominant signal.',
            'Exit when the trend weakens or a reversal signal appears.',
        ],
        pros: ['High win rate in trending markets', 'Logical and easy to understand', 'Works on all markets'],
        cons: ['Struggles in ranging/sideways markets', 'Requires patience to wait for clear trends'],
        best_market: 'EUR/USD, Gold (XAU)',
        risk: 'Low',
        is_popular: true,
        example: 'Gold trending up → Buy Rise → Profit → Continue with trend',
    },
    {
        id: 4,
        name: 'Over 2 Strategy',
        category: 'Signal',
        difficulty: 'Beginner',
        summary: 'Consistently trade "Over 2" on Volatility 100 when the signal shows 80%+ hit rate.',
        how_it_works: [
            'Open the Analysis Tool and select Volatility 100 → Over/Under.',
            "Check the Over 2 hit rate — only trade when it's above 80%.",
            'Use a fixed stake (1–2% of balance).',
            'Trade in batches of 10–20 trades, then review performance.',
        ],
        pros: ['High historical accuracy', 'Simple signal to identify', 'Works well with small accounts'],
        cons: ['Market conditions can shift', 'Requires monitoring hit rate regularly'],
        best_market: 'Volatility 100',
        risk: 'Low',
        is_popular: true,
        example: 'Analysis shows Over 2 = 87% → Trade Over 2 with $10 stake',
    },
    {
        id: 5,
        name: 'Fibonacci Retracement',
        category: 'Technical',
        difficulty: 'Advanced',
        summary: 'Use Fibonacci levels to identify high-probability entry points for Rise/Fall trades.',
        how_it_works: [
            'Identify a recent swing high and swing low.',
            'Draw Fibonacci retracement levels (23.6%, 38.2%, 61.8%).',
            'Enter Rise trades when price bounces from 61.8% in an uptrend.',
            'Enter Fall trades when price rejects from 61.8% in a downtrend.',
        ],
        pros: ['Very precise entries', 'Works on forex and commodity pairs', 'Strong risk/reward potential'],
        cons: ['Requires chart analysis skills', 'Not directly applicable on all Deriv products'],
        best_market: 'EUR/USD, GBP/USD, Gold (XAU)',
        risk: 'Medium',
        is_popular: false,
        example: 'EUR/USD retraces to 61.8% level in uptrend → Trade Rise',
    },
    {
        id: 6,
        name: 'Fixed Stake Conservative',
        category: 'Money Management',
        difficulty: 'Beginner',
        summary: 'Use 1% of your account balance per trade — the safest approach to preserve capital.',
        how_it_works: [
            'Calculate 1% of your current balance.',
            'Use that fixed amount as your stake on every trade.',
            'Recalculate after every 10 trades.',
            'Never deviate from the fixed percentage.',
        ],
        pros: ['Almost impossible to blow account', 'Sustainable long-term', 'Great for beginners'],
        cons: ['Slow profit growth', 'Feels conservative — requires patience'],
        best_market: 'Any',
        risk: 'Low',
        is_popular: false,
        example: '$1000 balance → $10 stake → Win → $1010 balance → New stake: $10.10',
    },
];

const CATEGORIES = ['All', 'Recovery', 'Technical', 'Signal', 'Money Management'];
const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const RISK_COLORS: Record<string, string> = {
    Low: '#2e7d32',
    Medium: '#f57c00',
    High: '#c62828',
};

const DIFF_COLORS: Record<string, string> = {
    Beginner: '#2e7d32',
    Intermediate: '#f57c00',
    Advanced: '#c62828',
};

const StrategiesPage = () => {
    const [category, setCategory] = useState('All');
    const [difficulty, setDifficulty] = useState('All');
    const [expanded, setExpanded] = useState<number | null>(null);

    const filtered = STRATEGIES.filter(s => {
        const matchCat = category === 'All' || s.category === category;
        const matchDiff = difficulty === 'All' || s.difficulty === difficulty;
        return matchCat && matchDiff;
    });

    return (
        <div className='dpa-strat'>
            <div className='dpa-strat__banner'>
                <div className='dpa-strat__banner-inner'>
                    <span className='dpa-strat__banner-tag'>TRADING EDUCATION</span>
                    <h1 className='dpa-strat__banner-title'>Trading Strategies</h1>
                    <p className='dpa-strat__banner-sub'>
                        Learn proven trading strategies used by top DPA traders. From beginner to advanced.
                    </p>
                </div>
            </div>

            <div className='dpa-strat__content'>
                {/* ── Filters ───────────────────────────────── */}
                <div className='dpa-strat__filters'>
                    <div className='dpa-strat__filter-group'>
                        <span className='dpa-strat__filter-label'>Category:</span>
                        {CATEGORIES.map(c => (
                            <button
                                key={c}
                                className={`dpa-strat__filter-btn${category === c ? ' active' : ''}`}
                                onClick={() => setCategory(c)}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                    <div className='dpa-strat__filter-group'>
                        <span className='dpa-strat__filter-label'>Difficulty:</span>
                        {DIFFICULTIES.map(d => (
                            <button
                                key={d}
                                className={`dpa-strat__filter-btn${difficulty === d ? ' active' : ''}`}
                                onClick={() => setDifficulty(d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Strategy cards ────────────────────────── */}
                <div className='dpa-strat__list'>
                    {filtered.map(s => (
                        <div key={s.id} className={`dpa-strat__card${expanded === s.id ? ' expanded' : ''}`}>
                            <div
                                className='dpa-strat__card-header'
                                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                            >
                                <div className='dpa-strat__card-title-row'>
                                    {s.is_popular && <span className='dpa-strat__popular-badge'>🔥 Popular</span>}
                                    <h3 className='dpa-strat__card-name'>{s.name}</h3>
                                    <span className='dpa-strat__card-category'>{s.category}</span>
                                </div>
                                <div className='dpa-strat__card-meta'>
                                    <span
                                        className='dpa-strat__diff-badge'
                                        style={{
                                            color: DIFF_COLORS[s.difficulty],
                                            background: `${DIFF_COLORS[s.difficulty]}18`,
                                        }}
                                    >
                                        {s.difficulty}
                                    </span>
                                    <span
                                        className='dpa-strat__risk-badge'
                                        style={{ color: RISK_COLORS[s.risk], background: `${RISK_COLORS[s.risk]}18` }}
                                    >
                                        {s.risk} Risk
                                    </span>
                                    <span className='dpa-strat__market-badge'>{s.best_market}</span>
                                    <span className={`dpa-strat__chevron${expanded === s.id ? ' open' : ''}`}>▾</span>
                                </div>
                            </div>

                            <p className='dpa-strat__summary'>{s.summary}</p>

                            {expanded === s.id && (
                                <div className='dpa-strat__details'>
                                    <div className='dpa-strat__example'>
                                        <strong>Example:</strong> {s.example}
                                    </div>

                                    <div className='dpa-strat__detail-grid'>
                                        <div className='dpa-strat__detail-section'>
                                            <h4>How it works</h4>
                                            <ol className='dpa-strat__steps'>
                                                {s.how_it_works.map((step, i) => (
                                                    <li key={i}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>
                                        <div>
                                            <div className='dpa-strat__detail-section'>
                                                <h4>Pros</h4>
                                                <ul className='dpa-strat__pros'>
                                                    {s.pros.map((p, i) => (
                                                        <li key={i}>✓ {p}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className='dpa-strat__detail-section'>
                                                <h4>Cons</h4>
                                                <ul className='dpa-strat__cons'>
                                                    {s.cons.map((c, i) => (
                                                        <li key={i}>✗ {c}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StrategiesPage;
