import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';

const CATEGORIES = {
    Synthetic: [
        { id: 'R_100', label: 'Volatility 100' },
        { id: 'R_50', label: 'Volatility 50' },
        { id: 'R_25', label: 'Volatility 25' },
        { id: '1HZ100V', label: 'Vol 100 (1s)' },
    ],
    Forex: [
        { id: 'frxEURUSD', label: 'EUR/USD' },
        { id: 'frxGBPUSD', label: 'GBP/USD' },
        { id: 'frxUSDJPY', label: 'USD/JPY' },
        { id: 'frxAUDUSD', label: 'AUD/USD' },
    ],
    Commodities: [
        { id: 'frxXAUUSD', label: 'Gold' },
        { id: 'frxXAGUSD', label: 'Silver' },
        { id: 'frxXTIUSD', label: 'Oil (WTI)' },
        { id: 'frxXBRUSD', label: 'Oil (Brent)' },
    ],
};

type Tick = { price: number; time: number };

const W = 1000;
const H = 320;
const PAD_L = 12;
const PAD_R = 64;
const PAD_T = 20;
const PAD_B = 28;

function buildPaths(ticks: Tick[]) {
    if (ticks.length < 2) return { line: '', area: '', labels: [] };

    const prices = ticks.map(t => t.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const cx = (i: number) => PAD_L + (i / (ticks.length - 1)) * (W - PAD_L - PAD_R);
    const cy = (p: number) => PAD_T + (1 - (p - min) / range) * (H - PAD_T - PAD_B);

    const pts = ticks.map((t, i) => `${cx(i).toFixed(1)},${cy(t.price).toFixed(1)}`).join(' ');
    const first = `${cx(0).toFixed(1)},${(H - PAD_B).toFixed(1)}`;
    const last = `${cx(ticks.length - 1).toFixed(1)},${(H - PAD_B).toFixed(1)}`;

    // Y-axis price labels (5 levels)
    const labels = Array.from({ length: 5 }, (_, i) => {
        const p = min + (i / 4) * range;
        const y = cy(p);
        return { y, text: p.toFixed(p < 10 ? 4 : p < 1000 ? 2 : 0) };
    });

    // Entry/exit signals — simple: buy when short MA crosses above long MA
    const signals: { x: number; y: number; type: 'buy' | 'sell' }[] = [];
    const short = 5;
    const long = 20;
    for (let i = long; i < ticks.length - 1; i++) {
        const maS0 = prices.slice(i - short, i).reduce((a, b) => a + b, 0) / short;
        const maS1 = prices.slice(i - short - 1, i - 1).reduce((a, b) => a + b, 0) / short;
        const maL = prices.slice(i - long, i).reduce((a, b) => a + b, 0) / long;
        if (maS1 < maL && maS0 >= maL) signals.push({ x: cx(i), y: cy(ticks[i].price) - 12, type: 'buy' });
        if (maS1 > maL && maS0 <= maL) signals.push({ x: cx(i), y: cy(ticks[i].price) + 20, type: 'sell' });
    }

    return {
        line: `M${pts.split(' ').join(' L')}`,
        area: `M${first} L${pts.split(' ').join(' L')} L${last} Z`,
        labels,
        signals,
    };
}

export default function LiveChart() {
    const [category, setCategory] = useState<keyof typeof CATEGORIES>('Synthetic');
    const [symbol, setSymbol] = useState('R_100');
    const [ticks, setTicks] = useState<Tick[]>([]);
    const [status, setStatus] = useState<'connecting' | 'live' | 'closed'>('connecting');
    const [stats, setStats] = useState({ current: 0, change: 0, high: 0, low: 0 });
    const wsRef = useRef<WebSocket | null>(null);
    const subIdRef = useRef<number | null>(null);

    const connect = useCallback((sym: string) => {
        if (wsRef.current) wsRef.current.close();
        setTicks([]);
        setStatus('connecting');

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(
                JSON.stringify({
                    ticks_history: sym,
                    count: 150,
                    end: 'latest',
                    style: 'ticks',
                })
            );
        };

        ws.onmessage = e => {
            const msg = JSON.parse(e.data);

            if (msg.msg_type === 'history') {
                const prices: number[] = msg.history.prices;
                const times: number[] = msg.history.times;
                const history = prices.map((p, i) => ({ price: p, time: times[i] }));
                setTicks(history);
                const hi = Math.max(...prices);
                const lo = Math.min(...prices);
                setStats({
                    current: prices[prices.length - 1],
                    change: prices[prices.length - 1] - prices[0],
                    high: hi,
                    low: lo,
                });
                setStatus('live');

                // Subscribe to live ticks
                ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
            }

            if (msg.msg_type === 'tick') {
                const { quote, epoch } = msg.tick;
                subIdRef.current = msg.subscription?.id;
                setTicks(prev => {
                    const next = [...prev.slice(-149), { price: quote, time: epoch }];
                    const prices = next.map(t => t.price);
                    setStats({
                        current: quote,
                        change: quote - prices[0],
                        high: Math.max(...prices),
                        low: Math.min(...prices),
                    });
                    return next;
                });
            }

            if (msg.error) {
                setStatus('closed');
            }
        };

        ws.onclose = () => setStatus('closed');
    }, []);

    useEffect(() => {
        connect(symbol);
        return () => {
            wsRef.current?.close();
        };
    }, [symbol, connect]);

    const { line, area, labels = [], signals = [] } = buildPaths(ticks);
    const isUp = stats.change >= 0;

    return (
        <div className='dpa-chart'>
            {/* Header */}
            <div className='dpa-chart__header'>
                <div className='dpa-chart__title-row'>
                    <div className='dpa-chart__live-badge'>
                        <span className={`dpa-chart__dot ${status === 'live' ? 'live' : ''}`} />
                        {status === 'live' ? 'LIVE' : status === 'connecting' ? 'CONNECTING...' : 'OFFLINE'}
                    </div>
                    <div className='dpa-chart__price'>
                        {stats.current > 0 && (
                            <>
                                <span className='dpa-chart__current'>
                                    {stats.current.toFixed(stats.current < 10 ? 5 : stats.current < 1000 ? 3 : 2)}
                                </span>
                                <span className={`dpa-chart__change ${isUp ? 'up' : 'down'}`}>
                                    {isUp ? '▲' : '▼'} {Math.abs(stats.change).toFixed(stats.current < 10 ? 5 : 2)} (
                                    {stats.current > 0
                                        ? ((stats.change / (stats.current - stats.change)) * 100).toFixed(2)
                                        : 0}
                                    %)
                                </span>
                            </>
                        )}
                    </div>
                    <div className='dpa-chart__stats-row'>
                        <span>
                            H: <b>{stats.high > 0 ? stats.high.toFixed(stats.high < 10 ? 4 : 2) : '—'}</b>
                        </span>
                        <span>
                            L: <b>{stats.low > 0 ? stats.low.toFixed(stats.low < 10 ? 4 : 2) : '—'}</b>
                        </span>
                    </div>
                </div>

                {/* Category tabs */}
                <div className='dpa-chart__categories'>
                    {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map(cat => (
                        <button
                            key={cat}
                            className={`dpa-chart__cat-btn${category === cat ? ' active' : ''}`}
                            onClick={() => setCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Symbol buttons */}
                <div className='dpa-chart__symbols'>
                    {CATEGORIES[category].map(s => (
                        <button
                            key={s.id}
                            className={`dpa-chart__sym-btn${symbol === s.id ? ' active' : ''}`}
                            onClick={() => {
                                setSymbol(s.id);
                            }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* SVG Chart */}
            <div className='dpa-chart__canvas-wrap'>
                {status === 'connecting' && <div className='dpa-chart__loading'>Connecting to live market data...</div>}
                {status === 'closed' && (
                    <div className='dpa-chart__loading'>
                        Market closed or unavailable. Try Synthetic indices — available 24/7.
                    </div>
                )}
                {ticks.length > 1 && (
                    <svg className='dpa-chart__svg' viewBox={`0 0 ${W} ${H}`} preserveAspectRatio='xMidYMid meet'>
                        <defs>
                            <linearGradient id='chartGrad' x1='0' y1='0' x2='0' y2='1'>
                                <stop offset='0%' stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity='0.25' />
                                <stop offset='100%' stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity='0.02' />
                            </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        {labels.map((l, i) => (
                            <line
                                key={i}
                                x1={PAD_L}
                                y1={l.y}
                                x2={W - PAD_R}
                                y2={l.y}
                                stroke='rgba(255,255,255,0.08)'
                                strokeWidth='1'
                            />
                        ))}

                        {/* Area fill */}
                        <path d={area} fill='url(#chartGrad)' />

                        {/* Price line */}
                        <path d={line} fill='none' stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth='2' />

                        {/* Current price line */}
                        {ticks.length > 0 &&
                            (() => {
                                const last = ticks[ticks.length - 1];
                                const prices = ticks.map(t => t.price);
                                const min = Math.min(...prices);
                                const max = Math.max(...prices);
                                const range = max - min || 1;
                                const y = PAD_T + (1 - (last.price - min) / range) * (H - PAD_T - PAD_B);
                                return (
                                    <>
                                        <line
                                            x1={PAD_L}
                                            y1={y}
                                            x2={W - PAD_R}
                                            y2={y}
                                            stroke='rgba(255,255,255,0.3)'
                                            strokeWidth='1'
                                            strokeDasharray='4,3'
                                        />
                                        <rect
                                            x={W - PAD_R + 2}
                                            y={y - 10}
                                            width={PAD_R - 4}
                                            height={20}
                                            rx='3'
                                            fill={isUp ? '#22c55e' : '#ef4444'}
                                        />
                                        <text
                                            x={W - PAD_R / 2}
                                            y={y + 4}
                                            textAnchor='middle'
                                            fontSize='9'
                                            fill='#fff'
                                            fontWeight='700'
                                        >
                                            {last.price.toFixed(last.price < 10 ? 4 : last.price < 1000 ? 2 : 0)}
                                        </text>
                                    </>
                                );
                            })()}

                        {/* Y-axis labels */}
                        {labels.map((l, i) => (
                            <text key={i} x={W - PAD_R + 4} y={l.y + 3} fontSize='8' fill='rgba(255,255,255,0.45)'>
                                {l.text}
                            </text>
                        ))}

                        {/* Entry/Exit signals */}
                        {signals.map((s, i) =>
                            s.type === 'buy' ? (
                                <g key={i}>
                                    <polygon
                                        points={`${s.x},${s.y + 10} ${s.x - 7},${s.y + 22} ${s.x + 7},${s.y + 22}`}
                                        fill='#22c55e'
                                    />
                                    <text
                                        x={s.x}
                                        y={s.y + 6}
                                        textAnchor='middle'
                                        fontSize='7'
                                        fill='#22c55e'
                                        fontWeight='800'
                                    >
                                        BUY
                                    </text>
                                </g>
                            ) : (
                                <g key={i}>
                                    <polygon
                                        points={`${s.x},${s.y} ${s.x - 7},${s.y - 12} ${s.x + 7},${s.y - 12}`}
                                        fill='#ef4444'
                                    />
                                    <text
                                        x={s.x}
                                        y={s.y + 10}
                                        textAnchor='middle'
                                        fontSize='7'
                                        fill='#ef4444'
                                        fontWeight='800'
                                    >
                                        SELL
                                    </text>
                                </g>
                            )
                        )}
                    </svg>
                )}
            </div>

            <div className='dpa-chart__footer'>
                Live market data powered by Deriv · Signals are for display purposes only
            </div>
        </div>
    );
}
