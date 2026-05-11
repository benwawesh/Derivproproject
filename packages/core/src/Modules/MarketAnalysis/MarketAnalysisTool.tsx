/**
 * MarketAnalysisTool
 * Multi-market real-time analysis with:
 * - Contract type: Digits (Over/Under, Even/Odd, Matches/Differs) | Rise/Fall | Higher/Lower
 * - Dynamic tick windows (add/remove)
 * - Best market recommendation with confidence score
 * - Per-window digit stats and direction stats
 * - Entry/Exit spot history
 * - Technical analysis: RSI, SMA, Trend, Volatility
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@deriv/stores';
import {
    MarketAnalysisService,
    ALL_MARKETS,
    type ContractType,
    type DigitSubType,
    type MarketResult,
    type BestMarket,
    type ConnectionStatus,
    type EntryExitRecord,
    type WindowAnalysis,
} from './MarketAnalysisService';
import './MarketAnalysisTool.scss';

// ─── Digit circles panel component ───────────────────────────────────────────

const CirclesPanel = ({ result }: { result: MarketResult }) => {
    const lw = result.windows[result.windows.length - 1] ?? result.windows[0];
    if (!lw || !lw.digitStats || !lw.directionStats) return null;

    const ds = lw.digitStats;
    const dir = lw.directionStats;
    const currentDigit =
        result.currentPrice > 0 ? parseInt(result.currentPrice.toString().replace('.', '').slice(-1)) : -1;

    // Auto recommendation: find strongest signal across all types
    const overPct = ds.overPercentage;
    const underPct = ds.underPercentage;
    const evenPct = ds.evenPercentage;
    const oddPct = ds.oddPercentage;
    const matchPct = ds.mostFrequent.percentage;
    const differPct = ds.leastFrequent.percentage;

    // Score each signal (deviation from neutral)
    const signals: { label: string; pct: number; score: number }[] = [
        { label: `Over 4`, pct: overPct, score: Math.abs(overPct - 50) },
        { label: `Under 5`, pct: underPct, score: Math.abs(underPct - 50) },
        { label: `Even`, pct: evenPct, score: Math.abs(evenPct - 50) },
        { label: `Odd`, pct: oddPct, score: Math.abs(oddPct - 50) },
        { label: `Matches ${ds.mostFrequent.digit}`, pct: matchPct, score: Math.abs(matchPct - 10) * 2 },
        { label: `Differs ${ds.leastFrequent.digit}`, pct: differPct, score: Math.abs(differPct - 10) * 2 },
    ];
    const best = signals.reduce((a, b) => (a.score > b.score ? a : b));
    const safetyLevel =
        best.pct >= 60 || best.score >= 10 ? 'strong' : best.pct >= 55 || best.score >= 5 ? 'moderate' : 'weak';

    return (
        <div className='mat__circles-panel'>
            <div className='mat__circles-panel__header'>
                <span className='mat__circles-panel__title'>
                    Digit Analysis — last {lw.tickCount} ticks ({ds.total} ticks)
                </span>
                <span className='mat__circles-panel__price'>
                    {result.currentPrice > 0 ? result.currentPrice.toFixed(3) : '—'}
                </span>
            </div>

            {/* Digit circles */}
            <div className='mat__circles-row'>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                    const isCurrent = currentDigit === d;
                    const isMost = ds.mostFrequent.digit === d;
                    const isLeast = ds.leastFrequent.digit === d;
                    return (
                        <div key={d} className='mat__circle-item'>
                            {isCurrent && <div className='mat__circle-arrow'>▼</div>}
                            <div
                                className={[
                                    'mat__circle',
                                    isCurrent ? 'mat__circle--current' : '',
                                    !isCurrent && isMost ? 'mat__circle--most' : '',
                                    !isCurrent && isLeast ? 'mat__circle--least' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            >
                                <span className='mat__circle__digit'>{d}</span>
                                <span className='mat__circle__pct'>{ds.percentages[d].toFixed(1)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 6 stat boxes */}
            <div className='mat__stat-boxes'>
                {[
                    { label: 'EVEN', pct: evenPct, dominant: evenPct >= oddPct },
                    { label: 'ODD', pct: oddPct, dominant: oddPct > evenPct },
                    { label: 'RISE', pct: dir.upPercentage, dominant: dir.upPercentage >= dir.downPercentage },
                    { label: 'FALL', pct: dir.downPercentage, dominant: dir.downPercentage > dir.upPercentage },
                    { label: 'OVER 4', pct: overPct, dominant: overPct >= underPct },
                    { label: 'UNDER 5', pct: underPct, dominant: underPct > overPct },
                ].map(({ label, pct, dominant }) => (
                    <div
                        key={label}
                        className={`mat__stat-box ${dominant ? 'mat__stat-box--green' : 'mat__stat-box--red'}`}
                    >
                        <span className='mat__stat-box__label'>{label}</span>
                        <span className='mat__stat-box__value'>{pct.toFixed(1)}%</span>
                    </div>
                ))}
            </div>

            {/* Auto recommendation */}
            <div className={`mat__recommendation mat__recommendation--${safetyLevel}`}>
                <div className='mat__recommendation__signal'>
                    {safetyLevel === 'strong' ? '✅' : safetyLevel === 'moderate' ? '⚠️' : '❌'}
                    &nbsp; Best signal: <b>{best.label}</b> — {best.pct.toFixed(1)}% of last {lw.tickCount} ticks
                </div>
                <div className='mat__recommendation__verdict'>
                    {safetyLevel === 'strong' ? 'Strong signal — Safe to trade' : ''}
                    {safetyLevel === 'moderate' ? 'Moderate signal — Trade with caution' : ''}
                    {safetyLevel === 'weak' ? 'Weak signal — Not recommended to trade' : ''}
                </div>
            </div>
        </div>
    );
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const confidenceColor = (c: string) => (c === 'High' ? '#00e676' : c === 'Medium' ? '#ffb300' : '#ef5350');

const directionArrow = (d: string) => (d === 'up' ? '↑' : d === 'down' ? '↓' : '→');

const fmt = (n: number, decimals = 3) => n.toFixed(decimals);

const scoreColor = (score: number) => {
    if (score >= 60) return '#00e676';
    if (score >= 30) return '#ffb300';
    return '#ef5350';
};

const trendIcon = (trend: string) =>
    trend === 'bullish' ? '↑ Bullish' : trend === 'bearish' ? '↓ Bearish' : '→ Neutral';

const trendColor = (trend: string) => (trend === 'bullish' ? '#00e676' : trend === 'bearish' ? '#ef5350' : '#90a4ae');

// ─── Sub-components ───────────────────────────────────────────────────────────

const DigitBar = ({
    digit,
    percentage,
    isMost,
    isLeast,
}: {
    digit: number;
    percentage: number;
    isMost: boolean;
    isLeast: boolean;
}) => (
    <div className='mat-digit-bar'>
        <span className='mat-digit-bar__label'>{digit}</span>
        <div className='mat-digit-bar__track'>
            <div
                className='mat-digit-bar__fill'
                style={{
                    width: `${Math.min(percentage, 100)}%`,
                    background: isMost ? '#00e676' : isLeast ? '#ef5350' : '#00a8ff',
                }}
            />
        </div>
        <span className='mat-digit-bar__pct' style={{ color: isMost ? '#00e676' : isLeast ? '#ef5350' : '#ccc' }}>
            {percentage.toFixed(1)}%
        </span>
    </div>
);

const WindowCard = ({ w, contractType }: { w: WindowAnalysis; contractType: ContractType }) => {
    const ds = w.digitStats;
    const dir = w.directionStats;
    const showDigits = contractType === 'digits';

    return (
        <div className='mat-window-card'>
            <div className='mat-window-card__header'>
                <span className='mat-window-card__ticks'>{w.tickCount} Ticks</span>
                <span className='mat-window-card__signal'>{w.signalLabel}</span>
                <span className='mat-window-card__score' style={{ color: scoreColor(w.score) }}>
                    {w.score.toFixed(0)}%
                </span>
            </div>
            {w.digitStats.total < 30 && (
                <div className='mat-window-card__warning'>
                    ⚠ Only {w.digitStats.total} ticks — too few for reliable signals
                </div>
            )}

            {showDigits ? (
                <div className='mat-window-card__digits'>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                        <DigitBar
                            key={d}
                            digit={d}
                            percentage={ds.percentages[d]}
                            isMost={ds.mostFrequent.digit === d}
                            isLeast={ds.leastFrequent.digit === d}
                        />
                    ))}
                    <div className='mat-window-card__summary'>
                        <span>
                            Over: <b style={{ color: '#00e676' }}>{ds.overPercentage.toFixed(1)}%</b>
                        </span>
                        <span>
                            Under: <b style={{ color: '#ef5350' }}>{ds.underPercentage.toFixed(1)}%</b>
                        </span>
                        <span>
                            Even: <b style={{ color: '#ffb300' }}>{ds.evenPercentage.toFixed(1)}%</b>
                        </span>
                        <span>
                            Odd: <b style={{ color: '#90a4ae' }}>{ds.oddPercentage.toFixed(1)}%</b>
                        </span>
                    </div>
                </div>
            ) : (
                <div className='mat-window-card__direction'>
                    <div className='mat-dir-row'>
                        <span className='mat-dir-label'>↑ Up</span>
                        <div className='mat-dir-track'>
                            <div className='mat-dir-fill mat-dir-fill--up' style={{ width: `${dir.upPercentage}%` }} />
                        </div>
                        <span className='mat-dir-pct' style={{ color: '#00e676' }}>
                            {dir.upPercentage.toFixed(1)}%
                        </span>
                    </div>
                    <div className='mat-dir-row'>
                        <span className='mat-dir-label'>↓ Down</span>
                        <div className='mat-dir-track'>
                            <div
                                className='mat-dir-fill mat-dir-fill--down'
                                style={{ width: `${dir.downPercentage}%` }}
                            />
                        </div>
                        <span className='mat-dir-pct' style={{ color: '#ef5350' }}>
                            {dir.downPercentage.toFixed(1)}%
                        </span>
                    </div>
                    <div className='mat-window-card__summary'>
                        <span>
                            Total: <b>{dir.total}</b> ticks
                        </span>
                    </div>
                </div>
            )}

            {w.entrySpot !== null && w.entrySpot > 0 && w.exitSpot !== null && w.exitSpot > 0 && (
                <div className='mat-window-card__spots'>
                    <span>
                        Entry: <b className='mat-spot mat-spot--entry'>{fmt(w.entrySpot)}</b>
                    </span>
                    <span>
                        Current: <b className='mat-spot mat-spot--exit'>{fmt(w.exitSpot)}</b>
                    </span>
                </div>
            )}
        </div>
    );
};

const EntryExitRow = ({ rec }: { rec: EntryExitRecord }) => (
    <div className={`mat-ee-row mat-ee-row--${rec.direction}`}>
        <div className='mat-ee-row__window'>{rec.windowTicks}T</div>
        <div className='mat-ee-row__spots'>
            <span className='mat-ee-label'>Entry</span>
            <span className='mat-ee-value'>
                {fmt(rec.entrySpot)} <em>(d{rec.entryDigit})</em>
            </span>
            <span className='mat-ee-arrow'>{directionArrow(rec.direction)}</span>
            <span className='mat-ee-label'>Exit</span>
            <span className='mat-ee-value'>
                {fmt(rec.exitSpot)} <em>(d{rec.exitDigit})</em>
            </span>
        </div>
        <div className={`mat-ee-row__change mat-ee-row__change--${rec.direction}`}>
            {rec.priceChange >= 0 ? '+' : ''}
            {fmt(rec.priceChange, 4)}
            &nbsp;({rec.priceChangePercent >= 0 ? '+' : ''}
            {rec.priceChangePercent.toFixed(3)}%)
        </div>
        <div className='mat-ee-row__time'>{new Date(rec.timestamp).toLocaleTimeString()}</div>
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const MarketAnalysisTool = () => {
    const { client } = useStore();

    // ── State ────────────────────────────────────────────────────────────────
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [statusMsg, setStatusMsg] = useState('');
    const [results, setResults] = useState<MarketResult[]>([]);
    const [best, setBest] = useState<BestMarket | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState('R_50');
    const [contractType, setContractType] = useState<ContractType>('digits');
    const [digitSubType, setDigitSubType] = useState<DigitSubType>('matches_differs');
    const [tickWindows, setTickWindows] = useState<number[]>([10, 50, 100, 500]);
    const [newWindowInput, setNewWindowInput] = useState('');
    const [activeTab, setActiveTab] = useState<'table' | 'detail' | 'entryexit'>('table');

    const serviceRef = useRef<MarketAnalysisService | null>(null);

    // ── Auth token ───────────────────────────────────────────────────────────
    const getToken = useCallback((client: any): string => {
        const fromStore = client.getToken?.();
        if (fromStore) return fromStore;
        try {
            const stored = localStorage.getItem('client.accounts');
            if (stored) {
                const accounts = JSON.parse(stored);
                const activeId = localStorage.getItem('active_loginid') || '';
                if (activeId && accounts[activeId]?.token) return accounts[activeId].token;
                const first = Object.values(accounts as Record<string, any>).find((a: any) => a.token);
                if ((first as any)?.token) return (first as any).token;
            }
        } catch {
            /* ignore */
        }
        return '';
    }, []);

    // ── Init service ─────────────────────────────────────────────────────────
    useEffect(() => {
        const token = getToken(client);
        if (!token) return;

        const svc = new MarketAnalysisService(token);
        svc.setUpdateCallback((r, b) => {
            setResults(r);
            setBest(b);
        });
        svc.setStatusCallback((s, msg) => {
            setStatus(s);
            setStatusMsg(msg || '');
        });
        serviceRef.current = svc;

        return () => {
            svc.disconnect();
        };
    }, [client, getToken]);

    // ── Propagate contract type changes to service ───────────────────────────
    useEffect(() => {
        serviceRef.current?.setContractType(contractType, digitSubType);
    }, [contractType, digitSubType]);

    // ── Propagate window changes to service ──────────────────────────────────
    useEffect(() => {
        serviceRef.current?.setTickWindows(tickWindows);
    }, [tickWindows]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const handleStart = async () => {
        if (!serviceRef.current) return;
        setIsAnalyzing(true);
        setResults([]);
        setBest(null);
        serviceRef.current.setContractType(contractType, digitSubType);
        serviceRef.current.setTickWindows(tickWindows);
        const ok = await serviceRef.current.connect(ALL_MARKETS.map(m => m.symbol));
        if (!ok) setIsAnalyzing(false);
    };

    const handleStop = () => {
        serviceRef.current?.disconnect();
        setIsAnalyzing(false);
        setStatus('disconnected');
        setStatusMsg('');
    };

    const handleAddWindow = () => {
        const n = parseInt(newWindowInput);
        if (!n || n < 1 || n > 5000) return;
        if (!tickWindows.includes(n)) {
            const next = [...tickWindows, n].sort((a, b) => a - b);
            setTickWindows(next);
        }
        setNewWindowInput('');
    };

    const handleRemoveWindow = (w: number) => {
        if (tickWindows.length <= 1) return;
        setTickWindows(tickWindows.filter(x => x !== w));
    };

    // ── Derived ──────────────────────────────────────────────────────────────
    const selectedResult = results.find(r => r.symbol === selectedSymbol);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className='mat'>
            {/* ── Header ── */}
            <div className='mat__header'>
                <div>
                    <h1 className='mat__title'>Market Analysis Tool</h1>
                    <p className='mat__subtitle'>
                        Real-time multi-market analysis · {tickWindows.length} tick window
                        {tickWindows.length !== 1 ? 's' : ''} · {ALL_MARKETS.length} markets
                    </p>
                </div>
                <div className={`mat__status mat__status--${status}`}>{statusMsg || status}</div>
            </div>

            {/* ── Controls ── */}
            <div className='mat__controls'>
                {/* Contract type */}
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Contract Type</label>
                    <div className='mat__tabs'>
                        {(['digits', 'rise_fall', 'higher_lower'] as ContractType[]).map(ct => (
                            <button
                                key={ct}
                                className={`mat__tab ${contractType === ct ? 'mat__tab--active' : ''}`}
                                onClick={() => setContractType(ct)}
                            >
                                {ct === 'digits' ? 'Digits' : ct === 'rise_fall' ? 'Rise / Fall' : 'Higher / Lower'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Digit sub-type (only when digits selected) */}
                {contractType === 'digits' && (
                    <div className='mat__ctrl-group'>
                        <label className='mat__ctrl-label'>Digit Type</label>
                        <div className='mat__tabs'>
                            {(
                                [
                                    ['over_under', 'Over / Under'],
                                    ['even_odd', 'Even / Odd'],
                                    ['matches_differs', 'Matches / Differs'],
                                ] as [DigitSubType, string][]
                            ).map(([st, label]) => (
                                <button
                                    key={st}
                                    className={`mat__tab ${digitSubType === st ? 'mat__tab--active' : ''}`}
                                    onClick={() => setDigitSubType(st)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tick windows */}
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Tick Windows</label>
                    <div className='mat__windows-row'>
                        {tickWindows.map(w => (
                            <div key={w} className='mat__window-chip'>
                                {w}T
                                <button
                                    className='mat__window-chip-remove'
                                    onClick={() => handleRemoveWindow(w)}
                                    title='Remove window'
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <div className='mat__window-add'>
                            <input
                                type='number'
                                min='1'
                                max='5000'
                                placeholder='e.g. 200'
                                value={newWindowInput}
                                onChange={e => setNewWindowInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddWindow()}
                                className='mat__window-input'
                            />
                            <button className='mat__window-add-btn' onClick={handleAddWindow}>
                                + Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Start / Stop */}
                <div className='mat__ctrl-group mat__ctrl-group--action'>
                    {!isAnalyzing ? (
                        <button
                            className='mat__btn mat__btn--start'
                            onClick={handleStart}
                            disabled={status === 'connecting'}
                        >
                            ▶ Start Analysis
                        </button>
                    ) : (
                        <button className='mat__btn mat__btn--stop' onClick={handleStop}>
                            ■ Stop
                        </button>
                    )}
                </div>
            </div>

            {/* ── Best Market Card ── */}
            {best && (
                <div className='mat__best-card'>
                    <div className='mat__best-card__badge'>🏆 Best Market</div>
                    <div className='mat__best-card__body'>
                        <div className='mat__best-card__market'>
                            <span className='mat__best-card__symbol'>{best.symbol}</span>
                            <span className='mat__best-card__name'>{best.name}</span>
                        </div>
                        <div className='mat__best-card__signal'>{best.signal}</div>
                        <div className='mat__best-card__meta'>
                            <span
                                className='mat__best-card__confidence'
                                style={{ background: confidenceColor(best.confidence) }}
                            >
                                {best.confidence} Confidence
                            </span>
                            <span className='mat__best-card__score'>
                                Score: <b style={{ color: scoreColor(best.score) }}>{best.score.toFixed(1)}%</b>
                            </span>
                            <span className='mat__best-card__entry'>
                                Entry Spot: <b>{fmt(best.entrySpot)}</b>
                            </span>
                        </div>
                        <div className='mat__best-card__reason'>{best.reason}</div>
                    </div>
                </div>
            )}

            {/* ── Placeholder when not analysing ── */}
            {!isAnalyzing && results.length === 0 && (
                <div className='mat__placeholder'>
                    <div className='mat__placeholder__icon'>📊</div>
                    <p>
                        Select your contract type, configure tick windows, then click <b>Start Analysis</b>.
                    </p>
                </div>
            )}

            {/* ── Main content ── */}
            {results.length > 0 && (
                <>
                    {/* View tabs */}
                    <div className='mat__view-tabs'>
                        {(
                            [
                                ['table', 'Market Rankings'],
                                ['detail', 'Market Detail'],
                                ['entryexit', 'Entry / Exit History'],
                            ] as [typeof activeTab, string][]
                        ).map(([tab, label]) => (
                            <button
                                key={tab}
                                className={`mat__view-tab ${activeTab === tab ? 'mat__view-tab--active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ── TABLE VIEW ── */}
                    {activeTab === 'table' && (
                        <div className='mat__table-wrap'>
                            <table className='mat__table'>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Market</th>
                                        <th>Price</th>
                                        {tickWindows.map(w => (
                                            <th key={w}>{w}T Score</th>
                                        ))}
                                        <th>Signal</th>
                                        <th>Confidence</th>
                                        {contractType === 'digits' ? (
                                            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => <th key={d}>{d}</th>)
                                        ) : (
                                            <>
                                                <th>RSI</th>
                                                <th>Trend</th>
                                            </>
                                        )}
                                        <th>Entry Spot</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map(r => {
                                        // Use the largest window's digit stats for the table
                                        const lw = r.windows[r.windows.length - 1] ?? r.windows[0];
                                        const ds = lw?.digitStats;
                                        return (
                                            <tr
                                                key={r.symbol}
                                                className={`mat__table-row ${selectedSymbol === r.symbol ? 'mat__table-row--selected' : ''} ${r.rank === 1 ? 'mat__table-row--best' : ''}`}
                                                onClick={() => {
                                                    setSelectedSymbol(r.symbol);
                                                    setActiveTab('detail');
                                                }}
                                            >
                                                <td className='mat__rank'>
                                                    {r.rank === 1
                                                        ? '🥇'
                                                        : r.rank === 2
                                                          ? '🥈'
                                                          : r.rank === 3
                                                            ? '🥉'
                                                            : r.rank}
                                                </td>
                                                <td className='mat__market-cell'>
                                                    <span className='mat__sym'>{r.symbol}</span>
                                                    <span className='mat__mname'>{r.name}</span>
                                                </td>
                                                <td className='mat__price'>{fmt(r.currentPrice)}</td>
                                                {r.windows.map(w => (
                                                    <td key={w.tickCount} style={{ color: scoreColor(w.score) }}>
                                                        {w.score.toFixed(0)}%
                                                    </td>
                                                ))}
                                                <td className='mat__signal'>{r.bestSignal}</td>
                                                <td>
                                                    <span
                                                        className='mat__confidence-badge'
                                                        style={{ background: confidenceColor(r.confidence) }}
                                                    >
                                                        {r.confidence}
                                                    </span>
                                                </td>
                                                {contractType === 'digits' ? (
                                                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                                                        <td
                                                            key={d}
                                                            style={{
                                                                color:
                                                                    ds && ds.mostFrequent.digit === d
                                                                        ? '#00e676'
                                                                        : ds && ds.leastFrequent.digit === d
                                                                          ? '#ef5350'
                                                                          : '#ccc',
                                                                fontWeight:
                                                                    ds &&
                                                                    (ds.mostFrequent.digit === d ||
                                                                        ds.leastFrequent.digit === d)
                                                                        ? 700
                                                                        : 400,
                                                            }}
                                                        >
                                                            {ds ? ds.percentages[d].toFixed(1) + '%' : '—'}
                                                        </td>
                                                    ))
                                                ) : (
                                                    <>
                                                        <td
                                                            style={{
                                                                color:
                                                                    r.technical.rsi14 !== null
                                                                        ? r.technical.rsi14 > 70
                                                                            ? '#ef5350'
                                                                            : r.technical.rsi14 < 30
                                                                              ? '#00e676'
                                                                              : '#ccc'
                                                                        : '#555',
                                                            }}
                                                        >
                                                            {r.technical.rsi14 !== null
                                                                ? r.technical.rsi14.toFixed(1)
                                                                : '—'}
                                                        </td>
                                                        <td style={{ color: trendColor(r.technical.trend) }}>
                                                            {trendIcon(r.technical.trend)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className='mat__entry-spot'>
                                                    {lw?.entrySpot !== null && lw?.entrySpot !== undefined
                                                        ? fmt(lw.entrySpot)
                                                        : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className='mat__table-hint'>Click a row to see full market detail.</p>
                        </div>
                    )}

                    {/* ── DETAIL VIEW ── */}
                    {activeTab === 'detail' && selectedResult && (
                        <div className='mat__detail'>
                            {/* Market selector */}
                            <div className='mat__detail-header'>
                                <select
                                    className='mat__market-select'
                                    value={selectedSymbol}
                                    onChange={e => setSelectedSymbol(e.target.value)}
                                >
                                    {results.map(r => (
                                        <option key={r.symbol} value={r.symbol}>
                                            #{r.rank} {r.symbol} — {r.name} ({r.overallScore.toFixed(0)}%)
                                        </option>
                                    ))}
                                </select>
                                <span className='mat__detail-price'>{fmt(selectedResult.currentPrice)}</span>
                            </div>

                            {/* Digit circles panel (digits mode) OR Technical analysis (rise/fall, higher/lower) */}
                            {contractType === 'digits' ? (
                                <CirclesPanel result={selectedResult} />
                            ) : (
                                <div className='mat__tech-panel'>
                                    <div className='mat__tech-title'>Technical Analysis</div>
                                    <div className='mat__tech-grid'>
                                        <div className='mat__tech-item'>
                                            <span className='mat__tech-label'>RSI (14)</span>
                                            <span
                                                className='mat__tech-val'
                                                style={{
                                                    color:
                                                        selectedResult.technical.rsi14 !== null
                                                            ? selectedResult.technical.rsi14 > 70
                                                                ? '#ef5350'
                                                                : selectedResult.technical.rsi14 < 30
                                                                  ? '#00e676'
                                                                  : '#ffb300'
                                                            : '#555',
                                                }}
                                            >
                                                {selectedResult.technical.rsi14 !== null
                                                    ? selectedResult.technical.rsi14.toFixed(2)
                                                    : '—'}
                                            </span>
                                            <span className='mat__tech-hint'>
                                                {selectedResult.technical.rsi14 !== null
                                                    ? selectedResult.technical.rsi14 > 70
                                                        ? 'Overbought'
                                                        : selectedResult.technical.rsi14 < 30
                                                          ? 'Oversold'
                                                          : 'Neutral'
                                                    : ''}
                                            </span>
                                        </div>
                                        <div className='mat__tech-item'>
                                            <span className='mat__tech-label'>SMA (10)</span>
                                            <span className='mat__tech-val'>
                                                {selectedResult.technical.sma10 !== null
                                                    ? fmt(selectedResult.technical.sma10)
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className='mat__tech-item'>
                                            <span className='mat__tech-label'>SMA (20)</span>
                                            <span className='mat__tech-val'>
                                                {selectedResult.technical.sma20 !== null
                                                    ? fmt(selectedResult.technical.sma20)
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className='mat__tech-item'>
                                            <span className='mat__tech-label'>Trend</span>
                                            <span
                                                className='mat__tech-val'
                                                style={{ color: trendColor(selectedResult.technical.trend) }}
                                            >
                                                {trendIcon(selectedResult.technical.trend)}
                                            </span>
                                        </div>
                                        <div className='mat__tech-item'>
                                            <span className='mat__tech-label'>Volatility</span>
                                            <span className='mat__tech-val'>
                                                {selectedResult.technical.volatility !== null
                                                    ? selectedResult.technical.volatility.toFixed(4)
                                                    : '—'}
                                            </span>
                                        </div>
                                        <div className='mat__tech-item'>
                                            <span className='mat__tech-label'>Overall Score</span>
                                            <span
                                                className='mat__tech-val'
                                                style={{ color: scoreColor(selectedResult.overallScore) }}
                                            >
                                                {selectedResult.overallScore.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Per-window analysis cards */}
                            <div className='mat__windows-grid'>
                                {selectedResult.windows.map(w => (
                                    <WindowCard key={w.tickCount} w={w} contractType={contractType} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── ENTRY/EXIT VIEW ── */}
                    {activeTab === 'entryexit' && (
                        <div className='mat__ee-section'>
                            <div className='mat__ee-header'>
                                <select
                                    className='mat__market-select'
                                    value={selectedSymbol}
                                    onChange={e => setSelectedSymbol(e.target.value)}
                                >
                                    {results.map(r => (
                                        <option key={r.symbol} value={r.symbol}>
                                            {r.symbol} — {r.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedResult && selectedResult.entryExitHistory.length > 0 ? (
                                <>
                                    <div className='mat__ee-legend'>
                                        <span>Window · Entry Spot (digit) → Exit Spot (digit) · Change · Time</span>
                                    </div>
                                    <div className='mat__ee-list'>
                                        {selectedResult.entryExitHistory.map((rec, i) => (
                                            <EntryExitRow key={i} rec={rec} />
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className='mat__ee-empty'>
                                    Waiting for first window cycle to complete…
                                    <br />
                                    <small>
                                        Entry/exit records appear after each tick window completes its full cycle.
                                    </small>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── Disclaimer ── */}
            <p className='mat__disclaimer'>
                Analysis is based on historical tick patterns. Past performance does not guarantee future results. This
                tool is for educational and informational purposes only.
            </p>
        </div>
    );
};
