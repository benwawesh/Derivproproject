import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@deriv/stores';
import {
    MarketAnalysisService,
    ALL_MARKETS,
    type MarketResult,
    type BestMarket,
    type ConnectionStatus,
    type DeepScanResult,
    type AdvancedMetrics,
} from './MarketAnalysisService';
import './MarketAnalysisTool.scss';

// ─── Types ────────────────────────────────────────────────────────────────────
type SectionTab = 'rankings' | 'circles' | 'graphical' | 'deepscan';

// ─── Shared helpers ───────────────────────────────────────────────────────────
const confidenceColor = (c: string) => (c === 'High' ? '#00e676' : c === 'Medium' ? '#ffb300' : '#ef5350');

const scoreColor = (score: number) => (score >= 65 ? '#00e676' : score >= 40 ? '#ffb300' : '#ef5350');

const fmt = (n: number, d = 3) => n.toFixed(d);

// ─── Market Rankings section ──────────────────────────────────────────────────
const RankingsSection = ({
    results,
    onSelectMarket,
}: {
    results: MarketResult[];
    onSelectMarket: (symbol: string) => void;
}) => {
    const sorted = [...results].sort((a, b) => {
        const aScore = a.liveSignals[0]?.score ?? 0;
        const bScore = b.liveSignals[0]?.score ?? 0;
        return bScore - aScore;
    });

    if (sorted.length === 0) {
        return (
            <div className='mat__placeholder'>
                <div className='mat__placeholder__icon'>📊</div>
                <p>
                    Click <b>Start Analysis</b> to see live market rankings.
                </p>
            </div>
        );
    }

    return (
        <div className='mat__rankings'>
            <div className='mat__rankings-grid'>
                {sorted.map((r, idx) => {
                    const best = r.liveSignals[0];
                    const score = best?.score ?? 0;
                    return (
                        <div
                            key={r.symbol}
                            className={`mat__rank-card ${idx === 0 ? 'mat__rank-card--gold' : idx === 1 ? 'mat__rank-card--silver' : idx === 2 ? 'mat__rank-card--bronze' : ''}`}
                            onClick={() => onSelectMarket(r.symbol)}
                        >
                            <div className='mat__rank-card__rank'>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </div>
                            <div className='mat__rank-card__info'>
                                <div className='mat__rank-card__market'>
                                    <span className='mat__rank-card__symbol'>{r.symbol}</span>
                                    <span className='mat__rank-card__name'>{r.name}</span>
                                    <span className='mat__rank-card__price'>{fmt(r.currentPrice)}</span>
                                </div>
                                {best ? (
                                    <div className='mat__rank-card__signal-row'>
                                        <span
                                            className='mat__conf-badge'
                                            style={{ background: confidenceColor(best.confidence) }}
                                        >
                                            {best.confidence}
                                        </span>
                                        <span className='mat__rank-card__signal-label'>{best.label}</span>
                                    </div>
                                ) : (
                                    <div className='mat__rank-card__collecting'>Collecting ticks…</div>
                                )}
                                <div className='mat__rank-card__bar-row'>
                                    <div className='mat__rank-card__bar-track'>
                                        <div
                                            className='mat__rank-card__bar-fill'
                                            style={{
                                                width: `${score}%`,
                                                background: best ? confidenceColor(best.confidence) : '#2a2a2a',
                                            }}
                                        />
                                    </div>
                                    <span
                                        className='mat__rank-card__score'
                                        style={{ color: best ? scoreColor(score) : '#555' }}
                                    >
                                        {best ? `${score.toFixed(1)}%` : '—'}
                                    </span>
                                </div>
                                {r.liveSignals.length > 0 && (
                                    <div className='mat__rank-card__badges'>
                                        {r.liveSignals.slice(0, 4).map((s, i) => (
                                            <span
                                                key={i}
                                                className='mat__sig-badge'
                                                style={{ borderColor: confidenceColor(s.confidence) }}
                                            >
                                                {s.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className='mat__hint'>Click any card to open Circle Analysis for that market.</p>
        </div>
    );
};

// ─── Circle Analysis section ──────────────────────────────────────────────────
const TRADE_TYPE_OPTS = [
    { value: 'all', label: 'All Trade Types' },
    { value: 'matches_differs', label: 'Matches / Differs' },
    { value: 'even_odd', label: 'Even / Odd' },
    { value: 'over_under', label: 'Over / Under' },
    { value: 'rise_fall', label: 'Rise / Fall' },
    { value: 'higher_lower', label: 'Higher / Lower' },
];

const CirclesSection = ({
    results,
    selectedSymbol,
    onSymbolChange,
}: {
    results: MarketResult[];
    selectedSymbol: string;
    onSymbolChange: (s: string) => void;
}) => {
    const [tradeFilter, setTradeFilter] = useState('all');
    const result = results.find(r => r.symbol === selectedSymbol) ?? results[0];

    if (!result) {
        return (
            <div className='mat__placeholder'>
                <div className='mat__placeholder__icon'>🔵</div>
                <p>
                    Click <b>Start Analysis</b> to see circle analysis.
                </p>
            </div>
        );
    }

    const lw = result.windows[result.windows.length - 1] ?? result.windows[0];
    const ds = lw?.digitStats;
    const dir = lw?.directionStats;
    const hasData = ds && ds.total > 0;

    const currentDigit =
        result.currentPrice > 0 ? parseInt(result.currentPrice.toString().replace('.', '').slice(-1)) : -1;

    const filteredSignals =
        tradeFilter === 'all' ? result.liveSignals : result.liveSignals.filter(s => s.subType === tradeFilter);

    return (
        <div className='mat__circles-section'>
            {/* Controls row */}
            <div className='mat__circles-controls'>
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Market</label>
                    <select
                        className='mat__market-select'
                        value={result.symbol}
                        onChange={e => onSymbolChange(e.target.value)}
                    >
                        {results.map(r => (
                            <option key={r.symbol} value={r.symbol}>
                                {r.symbol} — {r.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Trade Type</label>
                    <select
                        className='mat__market-select'
                        value={tradeFilter}
                        onChange={e => setTradeFilter(e.target.value)}
                    >
                        {TRADE_TYPE_OPTS.map(o => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className='mat__circles-price'>
                    <span className='mat__circles-price__label'>Current Price</span>
                    <span className='mat__circles-price__value'>{fmt(result.currentPrice)}</span>
                </div>
            </div>

            {hasData ? (
                <>
                    {/* Digit circles */}
                    <div className='mat__circles-panel'>
                        <div className='mat__circles-panel__title'>Digit Distribution — last {ds.total} ticks</div>
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

                        {/* Stat boxes */}
                        {dir && (
                            <div className='mat__stat-boxes'>
                                {[
                                    {
                                        label: 'EVEN',
                                        pct: ds.evenPercentage,
                                        dominant: ds.evenPercentage >= ds.oddPercentage,
                                    },
                                    {
                                        label: 'ODD',
                                        pct: ds.oddPercentage,
                                        dominant: ds.oddPercentage > ds.evenPercentage,
                                    },
                                    {
                                        label: 'RISE',
                                        pct: dir.upPercentage,
                                        dominant: dir.upPercentage >= dir.downPercentage,
                                    },
                                    {
                                        label: 'FALL',
                                        pct: dir.downPercentage,
                                        dominant: dir.downPercentage > dir.upPercentage,
                                    },
                                    {
                                        label: 'OVER 4',
                                        pct: ds.overPercentage,
                                        dominant: ds.overPercentage >= ds.underPercentage,
                                    },
                                    {
                                        label: 'UNDER 5',
                                        pct: ds.underPercentage,
                                        dominant: ds.underPercentage > ds.overPercentage,
                                    },
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
                        )}
                    </div>

                    {/* Signal cards */}
                    <div className='mat__signal-cards'>
                        <div className='mat__signal-cards__title'>
                            {tradeFilter === 'all'
                                ? 'All Signals'
                                : TRADE_TYPE_OPTS.find(o => o.value === tradeFilter)?.label + ' Signals'}{' '}
                            — ranked by strength
                        </div>
                        {filteredSignals.length === 0 ? (
                            <div className='mat__signal-cards__empty'>
                                No signals yet for this trade type. Collect more ticks.
                            </div>
                        ) : (
                            filteredSignals.map((sig, i) => (
                                <div
                                    key={i}
                                    className={`mat__signal-card ${i === 0 ? 'mat__signal-card--best' : ''}`}
                                    style={{ borderLeftColor: confidenceColor(sig.confidence) }}
                                >
                                    <div className='mat__signal-card__header'>
                                        <span
                                            className='mat__conf-badge'
                                            style={{ background: confidenceColor(sig.confidence) }}
                                        >
                                            {sig.confidence}
                                        </span>
                                        <span className='mat__signal-card__label'>{sig.label}</span>
                                        <span
                                            className='mat__signal-card__score'
                                            style={{ color: scoreColor(sig.score) }}
                                        >
                                            {sig.score.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className='mat__signal-card__bar-track'>
                                        <div
                                            className='mat__signal-card__bar-fill'
                                            style={{
                                                width: `${sig.score}%`,
                                                background: confidenceColor(sig.confidence),
                                            }}
                                        />
                                    </div>
                                    <div className='mat__signal-card__explanation'>{sig.explanation}</div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className='mat__placeholder'>
                    <div className='mat__placeholder__icon'>⏳</div>
                    <p>Collecting ticks for {result.name}…</p>
                </div>
            )}
        </div>
    );
};

// ─── Graphical View section ───────────────────────────────────────────────────
const GraphicalSection = ({
    results,
    onSelectMarket,
}: {
    results: MarketResult[];
    onSelectMarket: (symbol: string) => void;
}) => {
    const sorted = [...results].sort((a, b) => {
        const aScore = a.liveSignals[0]?.score ?? 0;
        const bScore = b.liveSignals[0]?.score ?? 0;
        return bScore - aScore;
    });

    if (sorted.length === 0) {
        return (
            <div className='mat__placeholder'>
                <div className='mat__placeholder__icon'>📈</div>
                <p>
                    Click <b>Start Analysis</b> to see the graphical view.
                </p>
            </div>
        );
    }

    const maxScore = Math.max(...sorted.map(r => r.liveSignals[0]?.score ?? 0), 1);

    return (
        <div className='mat__graphical'>
            {/* Legend */}
            <div className='mat__graphical__legend'>
                <span style={{ color: '#00e676' }}>■ High Confidence</span>
                <span style={{ color: '#ffb300' }}>■ Medium Confidence</span>
                <span style={{ color: '#ef5350' }}>■ Low Confidence</span>
            </div>

            {/* Market strength bars */}
            <div className='mat__graphical__bars'>
                {sorted.map((r, idx) => {
                    const best = r.liveSignals[0];
                    const score = best?.score ?? 0;
                    const color = best ? confidenceColor(best.confidence) : '#2a2a2a';
                    const barWidth = (score / maxScore) * 100;
                    return (
                        <div key={r.symbol} className='mat__graphical__row' onClick={() => onSelectMarket(r.symbol)}>
                            <div className='mat__graphical__rank'>#{idx + 1}</div>
                            <div className='mat__graphical__market'>
                                <span className='mat__graphical__symbol'>{r.symbol}</span>
                                <span className='mat__graphical__mname'>{r.name}</span>
                            </div>
                            <div className='mat__graphical__bar-area'>
                                <div className='mat__graphical__bar-track'>
                                    <div
                                        className='mat__graphical__bar-fill'
                                        style={{ width: `${barWidth}%`, background: color }}
                                    />
                                </div>
                                <div className='mat__graphical__bar-meta'>
                                    {best ? (
                                        <>
                                            <span className='mat__graphical__sig-label'>{best.label}</span>
                                            <span className='mat__graphical__score-val' style={{ color }}>
                                                {score.toFixed(1)}%
                                            </span>
                                        </>
                                    ) : (
                                        <span className='mat__graphical__collecting'>Collecting…</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* All-signal breakdown per market */}
            <div className='mat__graphical__breakdown'>
                <div className='mat__graphical__breakdown-title'>All Signals per Market</div>
                {sorted.map(r => (
                    <div key={r.symbol} className='mat__graphical__breakdown-row'>
                        <span className='mat__graphical__breakdown-sym'>{r.symbol}</span>
                        <div className='mat__graphical__breakdown-badges'>
                            {r.liveSignals.slice(0, 6).map((s, i) => (
                                <span
                                    key={i}
                                    className='mat__sig-badge'
                                    style={{ borderColor: confidenceColor(s.confidence) }}
                                >
                                    {s.label}&nbsp;<b style={{ color: scoreColor(s.score) }}>{s.score.toFixed(0)}%</b>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <p className='mat__hint'>Click any row to open Circle Analysis for that market.</p>
        </div>
    );
};

// ─── Deep Scan section ────────────────────────────────────────────────────────
const METRIC_DEFS: { key: string; label: string; hint: string; format: (m: AdvancedMetrics) => string }[] = [
    {
        key: 'chiSquare',
        label: 'Chi-Square (χ²)',
        hint: 'Σ (O−E)²/E — how far digit distribution deviates from uniform. Higher = stronger pattern.',
        format: m => m.chiSquare.toFixed(3),
    },
    {
        key: 'entropy',
        label: 'Shannon Entropy (H)',
        hint: 'H = −Σ p(i) × log₂(p(i)) — bits of randomness. Max = 3.32 bits. Lower = more predictable.',
        format: m => m.entropy.toFixed(4) + ' bits',
    },
    {
        key: 'bestZ',
        label: 'Best Z-Score',
        hint: 'Z = (p_obs − 0.10) / √(0.10×0.90/n) — statistical significance. |Z| > 2 = significant bias.',
        format: m => `Z = ${(m.zScores[m.bestZDigit] ?? 0).toFixed(2)} on digit ${m.bestZDigit}`,
    },
    {
        key: 'runsTest',
        label: 'Runs Test Z',
        hint: 'Detects even/odd clustering. Negative Z = digits cluster = bias exists. |Z| > 1.96 = significant.',
        format: m => m.evenOddRunsZ.toFixed(3),
    },
    {
        key: 'digitRsiEO',
        label: 'Digit RSI — Even/Odd',
        hint: '>70 = too many Even ticks → trade Odd. <30 = too many Odd ticks → trade Even.',
        format: m => m.digitRsiEvenOdd.toFixed(1),
    },
    {
        key: 'digitRsiOU',
        label: 'Digit RSI — Over/Under',
        hint: '>70 = too many Over ticks → trade Under. <30 = too many Under → trade Over.',
        format: m => m.digitRsiOverUnder.toFixed(1),
    },
    {
        key: 'markov',
        label: 'Markov Chain',
        hint: '10×10 transition matrix. Shows the strongest digit-to-digit prediction.',
        format: m => `${m.markovBestFrom} → ${m.markovBestTo}  (${(m.markovBestProb * 100).toFixed(1)}% probability)`,
    },
    {
        key: 'mwc',
        label: 'Multi-Window Consistency',
        hint: 'How consistently all time windows (10T, 50T, 100T, 500T) agree on the best signal.',
        format: m => m.multiWindowConsistency.toFixed(0) + '%',
    },
    {
        key: 'binomial',
        label: 'Binomial Confidence',
        hint: 'Normal approximation to binomial — statistical proof the pattern is not random. >80% = highly significant.',
        format: m => m.binomialConfidence.toFixed(0) + '%',
    },
    {
        key: 'volatility',
        label: 'Volatility Score',
        hint: '100 = extremely stable price. Lower = higher price volatility.',
        format: m => m.volatilityScore.toFixed(0) + ' / 100',
    },
];

const DeepScanSection = ({ results, service }: { results: MarketResult[]; service: MarketAnalysisService | null }) => {
    const [scanResults, setScanResults] = useState<DeepScanResult[] | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const hasData = results.some(r => r.liveSignals.length > 0);

    const runScan = () => {
        if (!service) return;
        setIsScanning(true);
        // Brief async tick so React renders "Scanning…" before CPU-bound work starts
        setTimeout(() => {
            const r = service.deepScanAll();
            setScanResults(r);
            setIsScanning(false);
        }, 50);
    };

    return (
        <div className='mat__deepscan'>
            {/* Intro */}
            <div className='mat__deepscan__intro'>
                <h2 className='mat__deepscan__intro-title'>Deep Mathematical Scan</h2>
                <p className='mat__deepscan__intro-desc'>
                    Applies all 9 advanced formulas simultaneously: <b>Chi-Square</b> deviation, <b>Shannon Entropy</b>,{' '}
                    <b>Z-Score</b> significance, <b>Markov Chain</b> transitions, <b>Runs Test</b> clustering,{' '}
                    <b>Digit RSI</b> (Even/Odd &amp; Over/Under), <b>Exponential Decay Weighting</b>,{' '}
                    <b>Binomial Confidence</b>, and <b>Multi-Window Consistency</b>. Every market is then ranked by
                    composite signal strength.
                </p>
                <button
                    className={`mat__btn ${isScanning ? 'mat__btn--scanning' : 'mat__btn--scan'}`}
                    onClick={runScan}
                    disabled={isScanning || !hasData || !service}
                >
                    {isScanning ? '⏳ Scanning…' : '🔬 Run Deep Scan'}
                </button>
                {!hasData && (
                    <p className='mat__deepscan__no-data'>
                        Start analysis and collect at least 50 ticks per market before running a deep scan.
                    </p>
                )}
            </div>

            {/* Results */}
            {scanResults && !isScanning && (
                <div className='mat__deepscan__results'>
                    {scanResults.length === 0 ? (
                        <div className='mat__placeholder'>
                            <p>No markets have enough data yet. Collect at least 50 ticks per market first.</p>
                        </div>
                    ) : (
                        scanResults.map(r => (
                            <div key={r.symbol} className='mat__deepscan__card'>
                                {/* Card header */}
                                <div className='mat__deepscan__card-header'>
                                    <span className='mat__deepscan__card-rank'>#{r.rank}</span>
                                    <div className='mat__deepscan__card-market'>
                                        <span className='mat__deepscan__card-symbol'>{r.symbol}</span>
                                        <span className='mat__deepscan__card-name'>{r.name}</span>
                                        <span className='mat__deepscan__card-price'>{fmt(r.currentPrice)}</span>
                                    </div>
                                    <div className='mat__deepscan__best'>
                                        <span
                                            className='mat__conf-badge'
                                            style={{ background: confidenceColor(r.bestSignal.confidence) }}
                                        >
                                            {r.bestSignal.confidence}
                                        </span>
                                        <span className='mat__deepscan__best-label'>{r.bestSignal.label}</span>
                                        <span
                                            className='mat__deepscan__best-score'
                                            style={{ color: scoreColor(r.bestSignal.score) }}
                                        >
                                            {r.bestSignal.score.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Plain English explanation */}
                                <div className='mat__deepscan__explanation'>{r.bestSignal.explanation}</div>

                                {/* All signal scores */}
                                <div className='mat__deepscan__all-signals'>
                                    <div className='mat__deepscan__signals-title'>All Trade Type Signals:</div>
                                    <div className='mat__deepscan__signals-list'>
                                        {r.allSignals.map((s, i) => (
                                            <div key={i} className='mat__deepscan__sig-row'>
                                                <span
                                                    className='mat__conf-badge mat__conf-badge--sm'
                                                    style={{ background: confidenceColor(s.confidence) }}
                                                >
                                                    {s.confidence}
                                                </span>
                                                <span className='mat__deepscan__sig-label'>{s.label}</span>
                                                <div className='mat__deepscan__sig-bar-track'>
                                                    <div
                                                        className='mat__deepscan__sig-bar-fill'
                                                        style={{
                                                            width: `${s.score}%`,
                                                            background: confidenceColor(s.confidence),
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    className='mat__deepscan__sig-score'
                                                    style={{ color: scoreColor(s.score) }}
                                                >
                                                    {s.score.toFixed(1)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Formula breakdown — collapsible */}
                                <details className='mat__deepscan__metrics-details'>
                                    <summary className='mat__deepscan__metrics-summary'>
                                        Formula Breakdown (9 metrics)
                                    </summary>
                                    <div className='mat__deepscan__metrics-grid'>
                                        {METRIC_DEFS.map(def => (
                                            <div key={def.key} className='mat__deepscan__metric'>
                                                <div className='mat__deepscan__metric-label'>{def.label}</div>
                                                <div className='mat__deepscan__metric-value'>
                                                    {def.format(r.metrics)}
                                                </div>
                                                <div className='mat__deepscan__metric-hint'>{def.hint}</div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────
export const MarketAnalysisTool = () => {
    const { client } = useStore();

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [statusMsg, setStatusMsg] = useState('');
    const [results, setResults] = useState<MarketResult[]>([]);
    const [sectionTab, setSectionTab] = useState<SectionTab>('rankings');
    const [selectedSymbol, setSelectedSymbol] = useState('R_50');

    const serviceRef = useRef<MarketAnalysisService | null>(null);

    const getToken = useCallback((c: any): string => {
        const fromStore = c.getToken?.();
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

    useEffect(() => {
        const token = getToken(client);
        if (!token) return;
        const svc = new MarketAnalysisService(token);
        svc.setUpdateCallback((r: MarketResult[], _b: BestMarket | null) => {
            setResults(r);
        });
        svc.setStatusCallback((s: ConnectionStatus, msg?: string) => {
            setStatus(s);
            setStatusMsg(msg || '');
        });
        serviceRef.current = svc;
        return () => {
            svc.disconnect();
        };
    }, [client, getToken]);

    const handleStart = async () => {
        if (!serviceRef.current) return;
        setIsAnalyzing(true);
        setResults([]);
        serviceRef.current.setTickWindows([10, 50, 100, 500]);
        const ok = await serviceRef.current.connect(ALL_MARKETS.map(m => m.symbol));
        if (!ok) setIsAnalyzing(false);
    };

    const handleStop = () => {
        serviceRef.current?.disconnect();
        setIsAnalyzing(false);
        setStatus('disconnected');
        setStatusMsg('');
    };

    const handleSelectMarket = (symbol: string) => {
        setSelectedSymbol(symbol);
        setSectionTab('circles');
    };

    const SECTION_TABS: { key: SectionTab; label: string }[] = [
        { key: 'rankings', label: '🏆 Market Rankings' },
        { key: 'circles', label: '🔵 Circle Analysis' },
        { key: 'graphical', label: '📊 Graphical View' },
        { key: 'deepscan', label: '🔬 Deep Scan' },
    ];

    return (
        <div className='mat'>
            {/* ── Header ── */}
            <div className='mat__header'>
                <div>
                    <h1 className='mat__title'>Market Analysis Tool</h1>
                    <p className='mat__subtitle'>
                        Advanced mathematical analysis · {ALL_MARKETS.length} markets · 9 formulas
                    </p>
                </div>
                <div className='mat__header-right'>
                    <div className={`mat__status mat__status--${status}`}>{statusMsg || status}</div>
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

            {/* ── Section tabs ── */}
            <div className='mat__view-tabs'>
                {SECTION_TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        className={`mat__view-tab ${sectionTab === key ? 'mat__view-tab--active' : ''}`}
                        onClick={() => setSectionTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Section content ── */}
            {sectionTab === 'rankings' && <RankingsSection results={results} onSelectMarket={handleSelectMarket} />}
            {sectionTab === 'circles' && (
                <CirclesSection results={results} selectedSymbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />
            )}
            {sectionTab === 'graphical' && <GraphicalSection results={results} onSelectMarket={handleSelectMarket} />}
            {sectionTab === 'deepscan' && <DeepScanSection results={results} service={serviceRef.current} />}

            {/* ── Disclaimer ── */}
            <p className='mat__disclaimer'>
                Analysis is based on historical tick patterns. Past performance does not guarantee future results. This
                tool is for educational and informational purposes only.
            </p>
        </div>
    );
};
