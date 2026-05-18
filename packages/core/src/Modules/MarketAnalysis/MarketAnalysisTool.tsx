import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@deriv/stores';
import {
    MarketAnalysisService,
    ALL_MARKETS,
    ENSEMBLE_KEYS,
    type MarketResult,
    type BestMarket,
    type ConnectionStatus,
    type DeepScanResult,
    type AdvancedMetrics,
    type MLPrediction,
    type EnsembleKey,
} from './MarketAnalysisService';
import { ENSEMBLE_LABELS } from './MarketAnalysisMLEngine';
import './MarketAnalysisTool.scss';

// ─── Types ────────────────────────────────────────────────────────────────────
type SectionTab = 'rankings' | 'circles' | 'graphical' | 'deepscan' | 'aiscan' | 'ourec';

interface AIScanCategoryScore {
    label: string; // e.g. "Even/Odd"
    score: number;
    signalLabel: string; // e.g. "Odd (57.0%)"
    confidence: string;
}

interface AIScanResult {
    symbol: string;
    name: string;
    currentPrice: number;
    rank: number;
    masterScore: number;
    formulaScore: number;
    nnScore: number;
    ensembleScore: number;
    nnAccuracy: number;
    trainingTicks: number;
    bestFormulaLabel: string;
    bestFormulaConfidence: string;
    nnLabel: string;
    ensembleLabel: string;
    nnRiseLabel: string; // NN rise/fall prediction label
    nnRiseScore: number; // NN rise/fall confidence (0–100)
    agree: boolean;
    // populated only in "all" mode — best signal per trade type category
    categoryScores?: AIScanCategoryScore[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
// Deriv brand palette
const confidenceColor = (c: string) => (c === 'High' ? '#4bb543' : c === 'Medium' ? '#f0a500' : '#ff444f');

const scoreColor = (score: number) => (score >= 65 ? '#4bb543' : score >= 40 ? '#f0a500' : '#ff444f');

const masterColor = (s: number) => (s >= 65 ? '#2e7d32' : s >= 45 ? '#e65100' : '#c62828');
const masterBg = (s: number) => (s >= 65 ? '#e8f5e9' : s >= 45 ? '#fff3e0' : '#ffebee');

const fmt = (n: number, d = 3) => n.toFixed(d);

// ─── Shared: pick best signal for a given trade type filter ──────────────────
const pickBest = (r: MarketResult, filter: string) => {
    if (filter === 'over_under') {
        const ouSignals = r.liveSignals.filter(s => s.subType === 'over_under');
        return ouSignals.sort((a, b) => b.score - a.score)[0] ?? r.liveSignals[0];
    }
    if (filter === 'all') return r.liveSignals[0];
    return r.liveSignals.find(s => s.subType === filter) ?? r.liveSignals[0];
};

// ─── Market Rankings section ──────────────────────────────────────────────────
const RankingsSection = ({
    results,
    onSelectMarket,
    tradeTypeFilter,
}: {
    results: MarketResult[];
    onSelectMarket: (symbol: string) => void;
    tradeTypeFilter: string;
}) => {
    const sorted = [...results].sort((a, b) => {
        const aScore = pickBest(a, tradeTypeFilter)?.score ?? 0;
        const bScore = pickBest(b, tradeTypeFilter)?.score ?? 0;
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
                    const best = pickBest(r, tradeTypeFilter);
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
    { value: 'even_odd', label: 'Even / Odd' },
    { value: 'over_under', label: 'Over / Under' },
    { value: 'rise_fall', label: 'Rise / Fall' },
    { value: 'higher_lower', label: 'Higher / Lower' },
    { value: 'neural_net', label: '🤖 Neural Network' },
    { value: 'ensemble', label: '🎯 Ensemble AI' },
];

// ─── ML Panel sub-component ───────────────────────────────────────────────────
const MLPanel = ({ ml }: { ml: MLPrediction }) => {
    const evenPct = ml.evenProb * 100;
    const oddPct = (1 - ml.evenProb) * 100;
    const ensEvenPct = ml.ensembleEvenProb * 100;
    const ensOddPct = 100 - ensEvenPct;
    const ensLabel = ml.ensembleEvenProb >= 0.5 ? 'Even' : 'Odd';
    const totalW = (Object.values(ml.weights) as number[]).reduce((s, w) => s + w, 0);

    return (
        <div className='mat__ml-panel'>
            <div className='mat__ml-panel__title'>🤖 Neural Network &amp; Ensemble AI</div>
            <div className='mat__ml-panel__meta'>
                <span>
                    Trained on <b>{ml.trainingTicks.toLocaleString()}</b> ticks
                </span>
                <span>
                    NN accuracy:{' '}
                    <b
                        style={{
                            color: ml.nnAccuracy >= 0.55 ? '#00e676' : ml.nnAccuracy >= 0.52 ? '#ffb300' : '#ef5350',
                        }}
                    >
                        {(ml.nnAccuracy * 100).toFixed(1)}%
                    </b>
                </span>
            </div>

            <div className='mat__ml-section-label'>Neural Network Prediction (Even / Odd)</div>
            <div className='mat__ml-prob-row'>
                <span className='mat__ml-prob-name'>Even</span>
                <div className='mat__ml-bar-track'>
                    <div className='mat__ml-bar-fill mat__ml-bar-fill--even' style={{ width: `${evenPct}%` }} />
                </div>
                <span className='mat__ml-prob-val'>{evenPct.toFixed(1)}%</span>
            </div>
            <div className='mat__ml-prob-row'>
                <span className='mat__ml-prob-name'>Odd</span>
                <div className='mat__ml-bar-track'>
                    <div className='mat__ml-bar-fill mat__ml-bar-fill--odd' style={{ width: `${oddPct}%` }} />
                </div>
                <span className='mat__ml-prob-val'>{oddPct.toFixed(1)}%</span>
            </div>

            <div className='mat__ml-section-label'>
                Ensemble Vote: <b style={{ color: '#9c6fff' }}>{ensLabel}</b> — {ml.ensembleEvenScore.toFixed(1)}%
                confidence
                {totalW === 0 && <span className='mat__ml-hint'> (calibrating — collecting accuracy data…)</span>}
            </div>
            <div className='mat__ml-prob-row'>
                <span className='mat__ml-prob-name'>Even</span>
                <div className='mat__ml-bar-track'>
                    <div className='mat__ml-bar-fill mat__ml-bar-fill--ensemble' style={{ width: `${ensEvenPct}%` }} />
                </div>
                <span className='mat__ml-prob-val'>{ensEvenPct.toFixed(1)}%</span>
            </div>
            <div className='mat__ml-prob-row'>
                <span className='mat__ml-prob-name'>Odd</span>
                <div className='mat__ml-bar-track'>
                    <div className='mat__ml-bar-fill mat__ml-bar-fill--ensemble' style={{ width: `${ensOddPct}%` }} />
                </div>
                <span className='mat__ml-prob-val'>{ensOddPct.toFixed(1)}%</span>
            </div>

            <div className='mat__ml-section-label'>Formula Weights (based on rolling accuracy)</div>
            <div className='mat__ml-weights'>
                {(ENSEMBLE_KEYS as readonly EnsembleKey[]).map(key => {
                    const acc = ml.accuracies[key];
                    const wt = ml.weights[key];
                    const accColor = acc >= 0.55 ? '#00e676' : acc >= 0.52 ? '#ffb300' : '#ef5350';
                    return (
                        <div key={key} className='mat__ml-weight-row'>
                            <span className='mat__ml-weight-label'>{ENSEMBLE_LABELS[key]}</span>
                            <span className='mat__ml-weight-acc' style={{ color: accColor }}>
                                {(acc * 100).toFixed(0)}%
                            </span>
                            <div className='mat__ml-weight-bar-track'>
                                <div
                                    className='mat__ml-weight-bar-fill'
                                    style={{ width: `${Math.min(wt * 50, 100)}%`, background: accColor }}
                                />
                            </div>
                            <span className='mat__ml-weight-val'>{wt.toFixed(2)}×</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Circle Analysis section ──────────────────────────────────────────────────
const CirclesSection = ({
    results,
    selectedSymbol,
    onSymbolChange,
    tradeTypeFilter,
    onTradeTypeChange,
    overBarrier,
    underBarrier,
    overEnabled,
    underEnabled,
}: {
    results: MarketResult[];
    selectedSymbol: string;
    onSymbolChange: (s: string) => void;
    tradeTypeFilter: string;
    onTradeTypeChange: (t: string) => void;
    overBarrier: number;
    underBarrier: number;
    overEnabled: boolean;
    underEnabled: boolean;
}) => {
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
        tradeTypeFilter === 'all' ? result.liveSignals : result.liveSignals.filter(s => s.subType === tradeTypeFilter);

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
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Trade Type</label>
                    <select
                        className='mat__market-select'
                        value={tradeTypeFilter}
                        onChange={e => onTradeTypeChange(e.target.value)}
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
                        {dir &&
                            (() => {
                                const overCount = ds.counts.slice(overBarrier + 1).reduce((s, c) => s + c, 0);
                                const underCount = ds.counts.slice(0, underBarrier).reduce((s, c) => s + c, 0);
                                const overPct = ds.total > 0 ? (overCount / ds.total) * 100 : 0;
                                const underPct = ds.total > 0 ? (underCount / ds.total) * 100 : 0;
                                const overExpected = ((9 - overBarrier) / 10) * 100;
                                const underExpected = (underBarrier / 10) * 100;
                                const statBoxes = [
                                    {
                                        label: 'EVEN',
                                        pct: ds.evenPercentage,
                                        dominant: ds.evenPercentage >= ds.oddPercentage,
                                        show: true,
                                    },
                                    {
                                        label: 'ODD',
                                        pct: ds.oddPercentage,
                                        dominant: ds.oddPercentage > ds.evenPercentage,
                                        show: true,
                                    },
                                    {
                                        label: 'RISE',
                                        pct: dir.upPercentage,
                                        dominant: dir.upPercentage >= dir.downPercentage,
                                        show: true,
                                    },
                                    {
                                        label: 'FALL',
                                        pct: dir.downPercentage,
                                        dominant: dir.downPercentage > dir.upPercentage,
                                        show: true,
                                    },
                                    {
                                        label: `OVER ${overBarrier}`,
                                        pct: overPct,
                                        dominant: overPct >= overExpected,
                                        show: overEnabled,
                                    },
                                    {
                                        label: `UNDER ${underBarrier}`,
                                        pct: underPct,
                                        dominant: underPct >= underExpected,
                                        show: underEnabled,
                                    },
                                ].filter(b => b.show);
                                return (
                                    <div className='mat__stat-boxes'>
                                        {statBoxes.map(({ label, pct, dominant }) => (
                                            <div
                                                key={label}
                                                className={`mat__stat-box ${dominant ? 'mat__stat-box--green' : 'mat__stat-box--red'}`}
                                            >
                                                <span className='mat__stat-box__label'>{label}</span>
                                                <span className='mat__stat-box__value'>{pct.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                    </div>

                    {/* Signal cards */}
                    <div className='mat__signal-cards'>
                        <div className='mat__signal-cards__title'>
                            {tradeTypeFilter === 'all'
                                ? 'All Signals'
                                : TRADE_TYPE_OPTS.find(o => o.value === tradeTypeFilter)?.label + ' Signals'}{' '}
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

                    {/* ML Panel — shown when NN has trained on ≥30 ticks */}
                    {result.mlPrediction && result.mlPrediction.trainingTicks >= 30 && (
                        <MLPanel ml={result.mlPrediction} />
                    )}
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
    tradeTypeFilter,
}: {
    results: MarketResult[];
    onSelectMarket: (symbol: string) => void;
    tradeTypeFilter: string;
}) => {
    const sorted = [...results].sort((a, b) => {
        const aScore = pickBest(a, tradeTypeFilter)?.score ?? 0;
        const bScore = pickBest(b, tradeTypeFilter)?.score ?? 0;
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
                    const best = pickBest(r, tradeTypeFilter);
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

const DeepScanSection = ({
    results,
    service,
    overBarrier,
    underBarrier,
    tradeTypeFilter,
}: {
    results: MarketResult[];
    service: MarketAnalysisService | null;
    overBarrier: number;
    underBarrier: number;
    tradeTypeFilter: string;
}) => {
    const [scanResults, setScanResults] = useState<DeepScanResult[] | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const hasRanRef = useRef(false);
    const hasData = results.some(r => r.liveSignals.length > 0);
    // Live ML predictions — updated every 2 s from the results ticker
    const mlBySymbol = new Map(results.filter(r => r.mlPrediction).map(r => [r.symbol, r.mlPrediction!]));

    const runScan = () => {
        if (!service) return;
        setIsScanning(true);
        setTimeout(() => {
            setScanResults(service.deepScanAll());
            hasRanRef.current = true;
            setIsScanning(false);
        }, 50);
    };

    // Auto-refresh formula data when live results update (after first manual run)
    useEffect(() => {
        if (hasRanRef.current && service && !isScanning) {
            setScanResults(service.deepScanAll());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [results]);

    return (
        <div className='mat__deepscan'>
            {/* Intro */}
            <div className='mat__deepscan__intro'>
                <h2 className='mat__deepscan__intro-title'>Deep Mathematical Scan</h2>
                <p className='mat__deepscan__intro-desc'>
                    Applies all 9 advanced formulas simultaneously: <b>Chi-Square</b> deviation, <b>Shannon Entropy</b>,{' '}
                    <b>Z-Score</b> significance, <b>Markov Chain</b> transitions, <b>Runs Test</b> clustering,{' '}
                    <b>Digit RSI</b> (Even/Odd &amp; Over/Under), <b>Exponential Decay Weighting</b>,{' '}
                    <b>Binomial Confidence</b>, and <b>Multi-Window Consistency</b>. Markets are ranked across{' '}
                    <b>Even/Odd, Over/Under, Rise/Fall, Higher/Lower</b> — Matches/Differs is excluded because it
                    inflates scores by nature (9-in-10 base-rate advantage).
                </p>
                <div className='mat__deepscan__barrier-info'>
                    Current Over/Under barriers:{' '}
                    <b>
                        Over {overBarrier} / Under {underBarrier}
                    </b>
                    <span className='mat__deepscan__barrier-hint'>
                        {' '}
                        — change via the barrier control in the controls bar above.
                    </span>
                </div>
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
                        scanResults.map(r => {
                            const ml = mlBySymbol.get(r.symbol);
                            return (
                                <div key={r.symbol} className='mat__deepscan__card'>
                                    {/* Card header */}
                                    <div className='mat__deepscan__card-header'>
                                        <span className='mat__deepscan__card-rank'>#{r.rank}</span>
                                        <div className='mat__deepscan__card-market'>
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

                                    {/* Signal scores — filtered to selected trade type */}
                                    <div className='mat__deepscan__all-signals'>
                                        <div className='mat__deepscan__signals-title'>
                                            {tradeTypeFilter === 'all'
                                                ? 'All Trade Type Signals:'
                                                : `${TRADE_TYPE_OPTS.find(o => o.value === tradeTypeFilter)?.label ?? ''} Signals:`}
                                        </div>
                                        <div className='mat__deepscan__signals-list'>
                                            {(tradeTypeFilter === 'all'
                                                ? r.allSignals.filter(s => s.subType !== 'matches_differs')
                                                : r.allSignals.filter(s => s.subType === tradeTypeFilter).length > 0
                                                  ? r.allSignals.filter(s => s.subType === tradeTypeFilter)
                                                  : r.allSignals.filter(s => s.subType !== 'matches_differs')
                                            ).map((s, i) => (
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

                                    {/* AI Prediction — all trade types ranked by confidence */}
                                    {ml &&
                                        ml.trainingTicks >= 30 &&
                                        (() => {
                                            const rows = [
                                                { label: 'NN Even', value: ml.evenProb * 100, color: '#4bb4b3' },
                                                { label: 'NN Odd', value: (1 - ml.evenProb) * 100, color: '#ff444f' },
                                                { label: 'NN Rise', value: ml.riseProb * 100, color: '#4bb543' },
                                                { label: 'NN Fall', value: (1 - ml.riseProb) * 100, color: '#f06292' },
                                                {
                                                    label: 'Ensemble',
                                                    value: ml.ensembleEvenScore,
                                                    color: '#f0a500',
                                                    valLabel: `${ml.ensembleEvenProb >= 0.5 ? 'Even' : 'Odd'} ${ml.ensembleEvenScore.toFixed(1)}%`,
                                                },
                                            ].sort((a, b) => b.value - a.value);
                                            return (
                                                <div className='mat__deepscan__ml'>
                                                    <div className='mat__deepscan__ml-title'>
                                                        🤖 AI Prediction — {r.name}
                                                    </div>
                                                    {rows.map(row => (
                                                        <div key={row.label} className='mat__deepscan__ml-row'>
                                                            <span className='mat__deepscan__ml-label'>{row.label}</span>
                                                            <div className='mat__deepscan__ml-bar-track'>
                                                                <div
                                                                    className='mat__deepscan__ml-bar-fill'
                                                                    style={{
                                                                        width: `${row.value}%`,
                                                                        background: row.color,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span
                                                                className='mat__deepscan__ml-val'
                                                                style={{
                                                                    color: (row as any).valLabel
                                                                        ? row.color
                                                                        : undefined,
                                                                }}
                                                            >
                                                                {(row as any).valLabel ?? `${row.value.toFixed(1)}%`}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className='mat__deepscan__ml-meta'>
                                                        NN accuracy: {(ml.nnAccuracy * 100).toFixed(1)}% · Trained on{' '}
                                                        {ml.trainingTicks.toLocaleString()} ticks
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

// ─── AI Scan: compute master scores ──────────────────────────────────────────
function computeAIScan(results: MarketResult[], tradeTypeFilter: string): AIScanResult[] {
    const out: AIScanResult[] = [];

    const isRiseFall = tradeTypeFilter === 'rise_fall' || tradeTypeFilter === 'higher_lower';
    const isOverUnder = tradeTypeFilter === 'over_under';

    // Category definitions for "all" mode
    const ALL_CATS = [
        { key: 'even_odd', label: 'Even / Odd' },
        { key: 'over_under', label: 'Over / Under' },
        { key: 'rise_fall', label: 'Rise / Fall' },
        { key: 'higher_lower', label: 'Higher / Lower' },
    ];

    for (const r of results) {
        const ml = r.mlPrediction;
        if (!ml || ml.trainingTicks < 50) continue;

        // Always exclude matches_differs and AI subtypes
        const nonAISigs = r.liveSignals.filter(
            s => s.subType !== 'neural_net' && s.subType !== 'ensemble' && s.subType !== 'matches_differs'
        );

        // ── NN predictions (always computed) ─────────────────────────────────
        const nnEvenConf = Math.max(ml.evenProb, 1 - ml.evenProb) * 100;
        const nnRiseConf = Math.max(ml.riseProb, 1 - ml.riseProb) * 100;
        const nnEvenLabel =
            ml.evenProb >= 0.5
                ? `Even (${(ml.evenProb * 100).toFixed(1)}%)`
                : `Odd (${((1 - ml.evenProb) * 100).toFixed(1)}%)`;
        const nnRiseLabel =
            ml.riseProb >= 0.5
                ? `Rise (${(ml.riseProb * 100).toFixed(1)}%)`
                : `Fall (${((1 - ml.riseProb) * 100).toFixed(1)}%)`;
        const ensembleLabel =
            ml.ensembleEvenProb >= 0.5
                ? `Even (${ml.ensembleEvenScore.toFixed(1)}%)`
                : `Odd (${ml.ensembleEvenScore.toFixed(1)}%)`;
        const nnWeight = Math.min(1, Math.max(0, (ml.nnAccuracy - 0.5) / 0.15));

        // ── ALL TRADE TYPES mode: show best from each category ────────────────
        if (tradeTypeFilter === 'all') {
            const categoryScores: AIScanCategoryScore[] = [];
            const catFormulaScores: number[] = [];

            for (const cat of ALL_CATS) {
                const sigs = nonAISigs.filter(s => s.subType === cat.key);
                const best = sigs[0];
                const score = best?.score ?? 0;
                if (score > 0) {
                    categoryScores.push({
                        label: cat.label,
                        score,
                        signalLabel: best?.label ?? '—',
                        confidence: best?.confidence ?? 'Low',
                    });
                    catFormulaScores.push(score);
                }
            }

            // Formula score = average across all categories with data
            const avgFormula =
                catFormulaScores.length > 0 ? catFormulaScores.reduce((a, b) => a + b, 0) / catFormulaScores.length : 0;

            // AI: average of even/odd NN + rise/fall NN + ensemble (all equally relevant)
            const nnAvg = (nnEvenConf + nnRiseConf) / 2;
            const aiComponent = (ml.ensembleEvenScore * 0.4 + nnAvg * 0.6) * (0.4 + nnWeight * 0.6);
            const masterScore = Math.min(100, avgFormula * 0.55 + aiComponent * 0.45);

            // Best individual signal for reference
            const bestFormula = nonAISigs[0];

            out.push({
                symbol: r.symbol,
                name: r.name,
                currentPrice: r.currentPrice,
                rank: 0,
                masterScore,
                formulaScore: avgFormula,
                nnScore: nnEvenConf,
                nnRiseScore: nnRiseConf,
                ensembleScore: ml.ensembleEvenScore,
                nnAccuracy: ml.nnAccuracy,
                trainingTicks: ml.trainingTicks,
                bestFormulaLabel: bestFormula?.label ?? '—',
                bestFormulaConfidence: bestFormula?.confidence ?? 'Low',
                nnLabel: nnEvenLabel,
                nnRiseLabel,
                ensembleLabel,
                agree: false,
                categoryScores,
            });
            continue;
        }

        // ── SPECIFIC TRADE TYPE mode ──────────────────────────────────────────
        const typedSigs = nonAISigs.filter(s => s.subType === tradeTypeFilter);
        const formulaSigs = typedSigs.length > 0 ? typedSigs : nonAISigs;
        const bestFormula = formulaSigs[0];
        const formulaScore = bestFormula?.score ?? 0;

        const nnProb = isRiseFall ? ml.riseProb : ml.evenProb;
        const nnConfidence = Math.max(nnProb, 1 - nnProb) * 100;
        const nnLabel = isRiseFall
            ? nnRiseLabel
            : isOverUnder
              ? `Digit bias: ${nnProb >= 0.5 ? 'Even' : 'Odd'} (${nnConfidence.toFixed(1)}%)`
              : nnEvenLabel;

        const ensembleScore = isRiseFall ? 50 : ml.ensembleEvenScore;
        const ensLbl = isRiseFall
            ? '— (N/A for Rise/Fall)'
            : isOverUnder
              ? `Digit pattern: ${ml.ensembleEvenProb >= 0.5 ? 'Even' : 'Odd'} (${ml.ensembleEvenScore.toFixed(1)}%)`
              : ensembleLabel;

        let masterScore: number;
        if (isRiseFall) {
            masterScore = Math.min(100, formulaScore * 0.6 + nnConfidence * (0.4 + nnWeight * 0.6) * 0.4);
        } else if (isOverUnder) {
            const aiComponent = (ensembleScore * 0.55 + nnConfidence * 0.45) * (0.4 + nnWeight * 0.6);
            masterScore = Math.min(100, formulaScore * 0.65 + aiComponent * 0.35);
        } else {
            const aiComponent = (ensembleScore * 0.55 + nnConfidence * 0.45) * (0.4 + nnWeight * 0.6);
            masterScore = Math.min(100, formulaScore * 0.45 + aiComponent * 0.55);
        }

        let agree = false;
        if (bestFormula) {
            const lbl = bestFormula.label.toLowerCase();
            if (isRiseFall) {
                agree = (lbl.startsWith('rise') || lbl.startsWith('higher')) === nnProb >= 0.5;
            } else if (!isOverUnder) {
                const formulaEven = lbl.startsWith('even');
                agree = formulaEven === nnProb >= 0.5 && formulaEven === ml.ensembleEvenProb >= 0.5;
            }
        }

        out.push({
            symbol: r.symbol,
            name: r.name,
            currentPrice: r.currentPrice,
            rank: 0,
            masterScore,
            formulaScore,
            nnScore: nnConfidence,
            nnRiseScore: nnRiseConf,
            ensembleScore: isRiseFall ? 0 : ensembleScore,
            nnAccuracy: ml.nnAccuracy,
            trainingTicks: ml.trainingTicks,
            bestFormulaLabel: bestFormula?.label ?? '—',
            bestFormulaConfidence: bestFormula?.confidence ?? 'Low',
            nnLabel,
            nnRiseLabel,
            ensembleLabel: ensLbl,
            agree,
        });
    }

    out.sort((a, b) => b.masterScore - a.masterScore);
    out.forEach((r, i) => {
        r.rank = i + 1;
    });
    return out;
}

// ─── AI Scan section component ────────────────────────────────────────────────
const AIScanSection = ({ results, tradeTypeFilter }: { results: MarketResult[]; tradeTypeFilter: string }) => {
    const [scanResults, setScanResults] = useState<AIScanResult[]>([]);
    const [hasRun, setHasRun] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const prevFilterRef = useRef(tradeTypeFilter);

    // Reset results when the trade type filter changes — old results would be for the wrong type
    useEffect(() => {
        if (prevFilterRef.current !== tradeTypeFilter) {
            prevFilterRef.current = tradeTypeFilter;
            setScanResults([]);
            setHasRun(false);
        }
    }, [tradeTypeFilter]);

    // Auto-refresh when market results update (after first run)
    useEffect(() => {
        if (hasRun) {
            setScanResults(computeAIScan(results, tradeTypeFilter));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [results]);

    const runScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            setScanResults(computeAIScan(results, tradeTypeFilter));
            setHasRun(true);
            setIsScanning(false);
        }, 60);
    };

    const eligibleCount = results.filter(r => r.mlPrediction && r.mlPrediction.trainingTicks >= 50).length;
    const hasEnough = eligibleCount > 0;

    // masterColor / masterBg are module-level — see below AIScanSection

    const isRiseFall = tradeTypeFilter === 'rise_fall' || tradeTypeFilter === 'higher_lower';
    const isOverUnder = tradeTypeFilter === 'over_under';
    const formulaNote = isRiseFall
        ? '60% Formula strength + 40% Neural Network (Ensemble N/A for Rise/Fall)'
        : isOverUnder
          ? '65% Formula strength + 35% AI (Ensemble + NN as proxy) · scaled by NN accuracy'
          : '45% Formula strength + 30% Ensemble AI + 25% Neural Network · scaled by NN accuracy';

    const tradeTypeLabel = TRADE_TYPE_OPTS.find(o => o.value === tradeTypeFilter)?.label ?? 'All Trade Types';

    return (
        <div className='mat__aiscan'>
            {/* Intro */}
            <div className='mat__aiscan__intro'>
                <h2 className='mat__aiscan__title'>🤖 AI Deep Scan — {tradeTypeLabel}</h2>
                <p className='mat__aiscan__desc'>
                    Combines <b>9 statistical formulas</b> with the <b>Neural Network</b> and <b>Ensemble AI</b> into
                    one unified master score. Signals are filtered to <b>{tradeTypeLabel}</b> only — the scan ranks
                    markets by how strongly that specific trade type is supported by both formulas and AI.
                </p>
                <div className='mat__aiscan__formula-note'>
                    <b>Master Score</b> = {formulaNote}.
                </div>
                <div className='mat__aiscan__eligibility'>
                    {eligibleCount} / {results.length} markets have enough AI training data (50+ ticks)
                </div>
                <button
                    className={`mat__btn ${isScanning ? 'mat__btn--scanning' : 'mat__btn--scan'}`}
                    onClick={runScan}
                    disabled={isScanning || !hasEnough}
                >
                    {isScanning ? '⏳ Scanning…' : '🤖 Run AI Scan'}
                </button>
                {!hasEnough && (
                    <p className='mat__aiscan__no-data'>
                        Let the analysis run for at least 1 minute so the Neural Network can train on enough ticks.
                    </p>
                )}
            </div>

            {/* Results */}
            {hasRun && !isScanning && (
                <div className='mat__aiscan__results'>
                    {scanResults.length === 0 ? (
                        <div className='mat__placeholder'>
                            <p>No markets have enough AI training data yet. Wait for more ticks.</p>
                        </div>
                    ) : (
                        scanResults.map(r => (
                            <div key={r.symbol} className='mat__aiscan__card'>
                                {/* Header */}
                                <div className='mat__aiscan__card-header'>
                                    <span className='mat__aiscan__rank'>#{r.rank}</span>
                                    <div className='mat__aiscan__market'>
                                        <span className='mat__aiscan__name'>{r.name}</span>
                                        <span className='mat__aiscan__price'>{fmt(r.currentPrice)}</span>
                                    </div>
                                    {/* Master score badge */}
                                    <div
                                        className='mat__aiscan__master'
                                        style={{
                                            background: masterBg(r.masterScore),
                                            borderColor: masterColor(r.masterScore),
                                        }}
                                    >
                                        <span className='mat__aiscan__master-label'>Master Score</span>
                                        <span
                                            className='mat__aiscan__master-val'
                                            style={{ color: masterColor(r.masterScore) }}
                                        >
                                            {r.masterScore.toFixed(1)}%
                                        </span>
                                    </div>
                                    {/* Agreement badge */}
                                    <div
                                        className={`mat__aiscan__agree ${r.agree ? 'mat__aiscan__agree--yes' : 'mat__aiscan__agree--no'}`}
                                    >
                                        {r.agree ? '✓ All agree' : '⚠ Mixed'}
                                    </div>
                                </div>

                                {/* Component scores */}
                                <div className='mat__aiscan__components'>
                                    {tradeTypeFilter === 'all' && r.categoryScores && r.categoryScores.length > 0 ? (
                                        <>
                                            {/* Per-category formula bars */}
                                            {r.categoryScores.map((cat, ci) => {
                                                const catColors = ['#1565c0', '#6a1b9a', '#2e7d32', '#b5451b'];
                                                const c = catColors[ci % catColors.length];
                                                return (
                                                    <div key={cat.label} className='mat__aiscan__comp'>
                                                        <div className='mat__aiscan__comp-header'>
                                                            <span
                                                                className='mat__aiscan__comp-label'
                                                                style={{ color: c }}
                                                            >
                                                                {cat.label}
                                                            </span>
                                                            <span className='mat__aiscan__comp-signal'>
                                                                {cat.signalLabel}
                                                            </span>
                                                            <span
                                                                className='mat__aiscan__comp-val'
                                                                style={{ color: c }}
                                                            >
                                                                {cat.score.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <div className='mat__aiscan__comp-track'>
                                                            <div
                                                                className='mat__aiscan__comp-fill'
                                                                style={{ width: `${cat.score}%`, background: c }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {/* NN Even/Odd */}
                                            <div className='mat__aiscan__comp'>
                                                <div className='mat__aiscan__comp-header'>
                                                    <span
                                                        className='mat__aiscan__comp-label'
                                                        style={{ color: '#6a1b9a' }}
                                                    >
                                                        NN Even/Odd
                                                    </span>
                                                    <span className='mat__aiscan__comp-signal'>{r.nnLabel}</span>
                                                    <span
                                                        className='mat__aiscan__comp-val'
                                                        style={{ color: '#6a1b9a' }}
                                                    >
                                                        {r.nnScore.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className='mat__aiscan__comp-track'>
                                                    <div
                                                        className='mat__aiscan__comp-fill'
                                                        style={{ width: `${r.nnScore}%`, background: '#6a1b9a' }}
                                                    />
                                                </div>
                                            </div>
                                            {/* NN Rise/Fall */}
                                            <div className='mat__aiscan__comp'>
                                                <div className='mat__aiscan__comp-header'>
                                                    <span
                                                        className='mat__aiscan__comp-label'
                                                        style={{ color: '#00838f' }}
                                                    >
                                                        NN Rise/Fall
                                                    </span>
                                                    <span className='mat__aiscan__comp-signal'>{r.nnRiseLabel}</span>
                                                    <span
                                                        className='mat__aiscan__comp-val'
                                                        style={{ color: '#00838f' }}
                                                    >
                                                        {r.nnRiseScore.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className='mat__aiscan__comp-track'>
                                                    <div
                                                        className='mat__aiscan__comp-fill'
                                                        style={{ width: `${r.nnRiseScore}%`, background: '#00838f' }}
                                                    />
                                                </div>
                                            </div>
                                            {/* Ensemble */}
                                            <div className='mat__aiscan__comp'>
                                                <div className='mat__aiscan__comp-header'>
                                                    <span
                                                        className='mat__aiscan__comp-label'
                                                        style={{ color: '#00695c' }}
                                                    >
                                                        Ensemble AI
                                                    </span>
                                                    <span className='mat__aiscan__comp-signal'>{r.ensembleLabel}</span>
                                                    <span
                                                        className='mat__aiscan__comp-val'
                                                        style={{ color: '#00695c' }}
                                                    >
                                                        {r.ensembleScore.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className='mat__aiscan__comp-track'>
                                                    <div
                                                        className='mat__aiscan__comp-fill'
                                                        style={{ width: `${r.ensembleScore}%`, background: '#00695c' }}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        [
                                            {
                                                label: isOverUnder
                                                    ? 'Over/Under'
                                                    : isRiseFall
                                                      ? 'Rise/Fall'
                                                      : '9 Formulas',
                                                value: r.formulaScore,
                                                signal: r.bestFormulaLabel,
                                                color: '#1565c0',
                                                na: false,
                                            },
                                            {
                                                label: isOverUnder ? 'Digit Dist.' : 'Neural Net',
                                                value: r.nnScore,
                                                signal: r.nnLabel,
                                                color: '#6a1b9a',
                                                na: false,
                                            },
                                            {
                                                label: isOverUnder ? 'Digit Pattern' : 'Ensemble AI',
                                                value: r.ensembleScore,
                                                signal: r.ensembleLabel,
                                                color: '#00695c',
                                                na: isRiseFall,
                                            },
                                        ].map(({ label, value, signal, color, na }) => (
                                            <div
                                                key={label}
                                                className={`mat__aiscan__comp${na ? ' mat__aiscan__comp--na' : ''}`}
                                            >
                                                <div className='mat__aiscan__comp-header'>
                                                    <span
                                                        className='mat__aiscan__comp-label'
                                                        style={{ color: na ? '#aaa' : color }}
                                                    >
                                                        {label}
                                                    </span>
                                                    <span className='mat__aiscan__comp-signal'>
                                                        {na ? 'N/A' : signal}
                                                    </span>
                                                    <span
                                                        className='mat__aiscan__comp-val'
                                                        style={{ color: na ? '#aaa' : color }}
                                                    >
                                                        {na ? '—' : `${value.toFixed(1)}%`}
                                                    </span>
                                                </div>
                                                <div className='mat__aiscan__comp-track'>
                                                    {!na && (
                                                        <div
                                                            className='mat__aiscan__comp-fill'
                                                            style={{ width: `${value}%`, background: color }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* NN meta */}
                                <div className='mat__aiscan__meta'>
                                    NN accuracy:{' '}
                                    <b
                                        style={{
                                            color:
                                                r.nnAccuracy >= 0.55
                                                    ? '#2e7d32'
                                                    : r.nnAccuracy >= 0.52
                                                      ? '#e65100'
                                                      : '#c62828',
                                        }}
                                    >
                                        {(r.nnAccuracy * 100).toFixed(1)}%
                                    </b>
                                    &nbsp;· Trained on <b>{r.trainingTicks.toLocaleString()}</b> ticks
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Over/Under Recovery Scanner ─────────────────────────────────────────────

// Valid barrier ranges — exclude low-payout extremes (Over 0/1, Under 8/9)
const OU_OVER_MIN = 2;
const OU_OVER_MAX = 7;
const OU_UNDER_MIN = 2;
const OU_UNDER_MAX = 7;

interface OUBarrierScore {
    type: 'over' | 'under';
    barrier: number;
    label: string;
    hitRate: number; // actual % of recent digits that win
    theoreticalRate: number; // purely statistical expected rate
    edge: number; // hitRate − theoreticalRate
    shortEdge: number; // edge over last ~20 ticks (recent trend)
    windowAgree: boolean; // short-term and long-term edge agree in direction
    payout: number; // total return multiplier (e.g. 1.90)
    edgeScore: number; // composite 0–100
}

interface OURecoveryResult {
    symbol: string;
    name: string;
    currentPrice: number;
    rank: number;
    sampleSize: number;
    entry: OUBarrierScore;
    recovery: OUBarrierScore | null; // null = no clean recovery available
    recoveryStake: number;
    stakeMultiplier: number; // recoveryStake / baseStake
}

// Deriv approximate payout: 0.95 / theoretical_probability, rounded to 2dp
function ouPayout(type: 'over' | 'under', barrier: number): number {
    const prob = type === 'over' ? (9 - barrier) / 10 : barrier / 10;
    if (prob <= 0) return 0;
    return Math.round((0.95 / prob) * 100) / 100;
}

// Compute wins for a barrier from a digit counts array
function ouWins(type: 'over' | 'under', barrier: number, counts: number[]): number {
    if (type === 'over') return counts.slice(barrier + 1).reduce((s, c) => s + c, 0);
    return counts.slice(0, barrier).reduce((s, c) => s + c, 0);
}

// Smart composite edge score for a single barrier
// Weights: edge significance (sample-adjusted) > short-term trend agreement > payout attractiveness
function computeEdgeScore(
    edge: number,
    shortEdge: number,
    windowAgree: boolean,
    payout: number,
    total: number
): number {
    if (edge <= 0) return 0; // never score a negative-edge barrier

    // Sample-weighted significance: more ticks = more reliable edge
    const sampleFactor = Math.min(1, Math.sqrt(total / 200)); // saturates at ~200 ticks
    const weightedEdge = edge * sampleFactor;

    // Short-term trend: if recent 20 ticks agree, add bonus; if they disagree, penalise
    const trendBonus = shortEdge > 0 ? Math.min(shortEdge * 2, 15) : -10;

    // Cross-window consistency bonus
    const consistencyBonus = windowAgree ? 8 : 0;

    // Payout attractiveness (favours barriers with better reward for similar edge)
    // Scaled so Over 4/5 (1.9–2.4×) get a meaningful bonus without dominating
    const payoutBonus = Math.min(12, (payout - 1.3) * 5);

    const raw = weightedEdge * 5 + trendBonus + consistencyBonus + payoutBonus;
    return Math.min(100, Math.max(0, raw));
}

// Score all valid Over/Under barriers for a market using two windows (long + short)
function scoreValidBarriers(
    longCounts: number[],
    longTotal: number,
    shortCounts: number[],
    shortTotal: number
): OUBarrierScore[] {
    const scores: OUBarrierScore[] = [];

    const assess = (type: 'over' | 'under', barrier: number) => {
        const theoretical = type === 'over' ? ((9 - barrier) / 10) * 100 : (barrier / 10) * 100;
        const payout = ouPayout(type, barrier);
        if (payout <= 0) return;

        const longWins = ouWins(type, barrier, longCounts);
        const hitRate = (longWins / longTotal) * 100;
        const edge = hitRate - theoretical;

        // Short-term edge (recent ~20 ticks)
        let shortEdge = 0;
        if (shortTotal >= 10) {
            const shortWins = ouWins(type, barrier, shortCounts);
            shortEdge = (shortWins / shortTotal) * 100 - theoretical;
        }

        const windowAgree = edge > 0 && shortEdge > 0;
        const edgeScore = computeEdgeScore(edge, shortEdge, windowAgree, payout, longTotal);

        // Only include if it has a positive long-term edge
        if (edge > 0) {
            scores.push({
                type,
                barrier,
                label: `${type === 'over' ? 'Over' : 'Under'} ${barrier}`,
                hitRate,
                theoreticalRate: theoretical,
                edge,
                shortEdge,
                windowAgree,
                payout,
                edgeScore,
            });
        }
    };

    for (let b = OU_OVER_MIN; b <= OU_OVER_MAX; b++) assess('over', b);
    for (let b = OU_UNDER_MIN; b <= OU_UNDER_MAX; b++) assess('under', b);

    return scores.sort((a, b) => b.edgeScore - a.edgeScore);
}

function computeOURecovery(results: MarketResult[], baseStake: number): OURecoveryResult[] {
    const out: OURecoveryResult[] = [];

    for (const r of results) {
        if (!r.windows || r.windows.length === 0) continue;

        // Long window = largest available; short window = smallest available (~10–20T)
        const longWin = r.windows[r.windows.length - 1];
        const shortWin = r.windows[0];

        if (!longWin.digitStats || longWin.digitStats.total < 30) continue;

        const longCounts = longWin.digitStats.counts;
        const longTotal = longWin.digitStats.total;
        const shortCounts = shortWin?.digitStats?.counts ?? longCounts;
        const shortTotal = shortWin?.digitStats?.total ?? 0;

        const validBarriers = scoreValidBarriers(longCounts, longTotal, shortCounts, shortTotal);
        if (validBarriers.length === 0) continue; // no positive-edge barrier exists

        const entry = validBarriers[0];

        // Recovery: best remaining barrier that:
        // 1. Is different from entry
        // 2. Has positive edge
        // 3. Produces a stake multiplier ≤ 4× (keeps recovery sane)
        // Recovery target = recover lost stake + the profit entry would have made
        const entryTargetProfit = baseStake * (entry.payout - 1);
        const needed = baseStake + entryTargetProfit;

        let recovery: OUBarrierScore | null = null;
        let recoveryStake = 0;
        let stakeMultiplier = 0;

        for (const candidate of validBarriers) {
            if (candidate.label === entry.label) continue;
            const netPerUnit = candidate.payout - 1;
            const stakeNeeded = needed / netPerUnit;
            const mult = stakeNeeded / baseStake;
            if (mult <= 4) {
                recovery = candidate;
                recoveryStake = Math.ceil(stakeNeeded * 100) / 100;
                stakeMultiplier = Math.round(mult * 10) / 10;
                break;
            }
        }
        // If no candidate within 4× multiplier, try up to 6× before giving up
        if (!recovery) {
            for (const candidate of validBarriers) {
                if (candidate.label === entry.label) continue;
                const netPerUnit = candidate.payout - 1;
                const stakeNeeded = needed / netPerUnit;
                const mult = stakeNeeded / baseStake;
                if (mult <= 6) {
                    recovery = candidate;
                    recoveryStake = Math.ceil(stakeNeeded * 100) / 100;
                    stakeMultiplier = Math.round(mult * 10) / 10;
                    break;
                }
            }
        }

        out.push({
            symbol: r.symbol,
            name: r.name,
            currentPrice: r.currentPrice,
            rank: 0,
            sampleSize: longTotal,
            entry,
            recovery,
            recoveryStake,
            stakeMultiplier,
        });
    }

    out.sort((a, b) => b.entry.edgeScore - a.entry.edgeScore);
    out.forEach((r, i) => {
        r.rank = i + 1;
    });
    return out;
}

const edgeColor = (edge: number) => (edge >= 5 ? '#2e7d32' : edge >= 2 ? '#e65100' : '#c62828');
const hitColor = (hit: number, theo: number) => (hit >= theo + 3 ? '#2e7d32' : hit >= theo ? '#e65100' : '#c62828');

const OURecoverySection = ({ results }: { results: MarketResult[] }) => {
    const [stake, setStake] = useState('1.00');
    const [stakeVal, setStakeVal] = useState(1.0);
    const [scanResults, setScanResults] = useState<OURecoveryResult[]>([]);
    const [hasRun, setHasRun] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // Auto-refresh when live results update (after first run)
    const hasRunRef = useRef(false);
    useEffect(() => {
        if (hasRunRef.current && results.length > 0) {
            setScanResults(computeOURecovery(results, stakeVal));
        }
    }, [results, stakeVal]);

    const handleScan = () => {
        setIsScanning(true);
        setTimeout(() => {
            setScanResults(computeOURecovery(results, stakeVal));
            setHasRun(true);
            hasRunRef.current = true;
            setIsScanning(false);
        }, 120);
    };

    return (
        <div className='mat__aiscan'>
            <div className='mat__aiscan__header'>
                <div>
                    <h3 className='mat__aiscan__title'>⚡ Over/Under Recovery Scanner</h3>
                    <p className='mat__aiscan__desc'>
                        Scans all Over and Under barriers across every market. Finds the strongest statistical edge as
                        the entry, then picks the best recovery trade in case of a loss — direction and barrier are
                        fully market-driven, nothing is hardcoded.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <label style={{ fontSize: 12, color: '#888' }}>Base Stake ($)</label>
                    <input
                        type='number'
                        min='0.35'
                        step='0.01'
                        value={stake}
                        onChange={e => {
                            setStake(e.target.value);
                            const n = parseFloat(e.target.value);
                            if (!isNaN(n) && n > 0) setStakeVal(n);
                        }}
                        onBlur={() => {
                            const n = parseFloat(stake);
                            const safe = isNaN(n) || n <= 0 ? 1 : Math.round(n * 100) / 100;
                            setStakeVal(safe);
                            setStake(safe.toFixed(2));
                        }}
                        style={{
                            width: 72,
                            padding: '4px 6px',
                            borderRadius: 5,
                            border: '1px solid #ccc',
                            fontSize: 13,
                            textAlign: 'right',
                        }}
                    />
                    <button
                        className='mat__aiscan__run-btn'
                        onClick={handleScan}
                        disabled={isScanning || results.length === 0}
                    >
                        {isScanning ? '⏳ Scanning…' : hasRun ? '🔄 Re-Scan' : '▶ Run Scan'}
                    </button>
                </div>
            </div>

            {!hasRun && !isScanning && (
                <div className='mat__placeholder'>
                    <div className='mat__placeholder__icon'>⚡</div>
                    <p>
                        Click <b>Run Scan</b> to find the best Over/Under entry + recovery for every market.
                    </p>
                </div>
            )}
            {isScanning && (
                <div className='mat__placeholder'>
                    <p>Analysing all barriers across {results.length} markets…</p>
                </div>
            )}

            {hasRun && !isScanning && (
                <div className='mat__aiscan__results'>
                    {scanResults.length === 0 ? (
                        <div className='mat__placeholder'>
                            <p>
                                No markets have a positive statistical edge right now in the Over 2–7 / Under 2–7 range.
                                Wait for more ticks or try again shortly.
                            </p>
                        </div>
                    ) : (
                        scanResults.map(r => {
                            const entryProfit = (stakeVal * (r.entry.payout - 1)).toFixed(2);
                            const recNetProfit = r.recovery
                                ? (r.recoveryStake * (r.recovery.payout - 1) - stakeVal).toFixed(2)
                                : null;
                            return (
                                <div key={r.symbol} className='mat__aiscan__card'>
                                    {/* Header */}
                                    <div className='mat__aiscan__card-header'>
                                        <span className='mat__aiscan__rank'>#{r.rank}</span>
                                        <div className='mat__aiscan__market'>
                                            <span className='mat__aiscan__name'>{r.name}</span>
                                            <span className='mat__aiscan__price'>{fmt(r.currentPrice)}</span>
                                        </div>
                                        <div
                                            className='mat__aiscan__master'
                                            style={{
                                                background: masterBg(r.entry.edgeScore),
                                                borderColor: masterColor(r.entry.edgeScore),
                                            }}
                                        >
                                            <span className='mat__aiscan__master-label'>Edge Score</span>
                                            <span
                                                className='mat__aiscan__master-val'
                                                style={{ color: masterColor(r.entry.edgeScore) }}
                                            >
                                                {r.entry.edgeScore.toFixed(0)}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 11, color: '#aaa' }}>{r.sampleSize} ticks</span>
                                    </div>

                                    {/* Entry row */}
                                    <div className='mat__ou-row mat__ou-row--entry'>
                                        <div className='mat__ou-row__badge mat__ou-row__badge--entry'>ENTRY</div>
                                        <div className='mat__ou-row__info'>
                                            <span className='mat__ou-row__label'>{r.entry.label}</span>
                                            <span className='mat__ou-row__stake'>${stakeVal.toFixed(2)}</span>
                                            <span className='mat__ou-row__payout'>×{r.entry.payout.toFixed(2)}</span>
                                            <span className='mat__ou-row__profit' style={{ color: '#2e7d32' }}>
                                                +${entryProfit} if win
                                            </span>
                                            {r.entry.windowAgree && (
                                                <span style={{ fontSize: 10, color: '#2e7d32', fontWeight: 700 }}>
                                                    ✓ Trend confirmed
                                                </span>
                                            )}
                                            {!r.entry.windowAgree && (
                                                <span style={{ fontSize: 10, color: '#e65100' }}>
                                                    ⚠ Short-term mixed
                                                </span>
                                            )}
                                        </div>
                                        <div className='mat__ou-row__stats'>
                                            <span style={{ color: hitColor(r.entry.hitRate, r.entry.theoreticalRate) }}>
                                                Hit: {r.entry.hitRate.toFixed(1)}%
                                            </span>
                                            <span style={{ color: '#aaa' }}>
                                                (exp {r.entry.theoreticalRate.toFixed(0)}%)
                                            </span>
                                            <span style={{ color: edgeColor(r.entry.edge) }}>
                                                Edge: +{r.entry.edge.toFixed(1)}%
                                            </span>
                                            {r.entry.shortEdge !== 0 && (
                                                <span
                                                    style={{
                                                        color: r.entry.shortEdge > 0 ? '#2e7d32' : '#c62828',
                                                        fontSize: 10,
                                                    }}
                                                >
                                                    Recent: {r.entry.shortEdge >= 0 ? '+' : ''}
                                                    {r.entry.shortEdge.toFixed(1)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className='mat__ou-row__bar-wrap'>
                                            <div
                                                className='mat__ou-row__bar'
                                                style={{
                                                    width: `${Math.min(100, r.entry.hitRate)}%`,
                                                    background: '#1565c0',
                                                }}
                                            />
                                            <div
                                                className='mat__ou-row__bar-theo'
                                                style={{ left: `${r.entry.theoreticalRate}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Recovery row */}
                                    {r.recovery ? (
                                        <>
                                            <div className='mat__ou-row mat__ou-row--rec'>
                                                <div className='mat__ou-row__badge mat__ou-row__badge--rec'>
                                                    RECOVERY
                                                </div>
                                                <div className='mat__ou-row__info'>
                                                    <span className='mat__ou-row__label'>{r.recovery.label}</span>
                                                    <span className='mat__ou-row__stake'>
                                                        ${r.recoveryStake.toFixed(2)}
                                                    </span>
                                                    <span className='mat__ou-row__payout'>
                                                        ×{r.recovery.payout.toFixed(2)}
                                                    </span>
                                                    <span className='mat__ou-row__profit' style={{ color: '#f0a500' }}>
                                                        +${recNetProfit} net
                                                    </span>
                                                    <span style={{ fontSize: 10, color: '#aaa' }}>
                                                        ({r.stakeMultiplier}× stake)
                                                    </span>
                                                </div>
                                                <div className='mat__ou-row__stats'>
                                                    <span
                                                        style={{
                                                            color: hitColor(
                                                                r.recovery.hitRate,
                                                                r.recovery.theoreticalRate
                                                            ),
                                                        }}
                                                    >
                                                        Hit: {r.recovery.hitRate.toFixed(1)}%
                                                    </span>
                                                    <span style={{ color: '#aaa' }}>
                                                        (exp {r.recovery.theoreticalRate.toFixed(0)}%)
                                                    </span>
                                                    <span style={{ color: edgeColor(r.recovery.edge) }}>
                                                        Edge: +{r.recovery.edge.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className='mat__ou-row__bar-wrap'>
                                                    <div
                                                        className='mat__ou-row__bar'
                                                        style={{
                                                            width: `${Math.min(100, r.recovery.hitRate)}%`,
                                                            background: '#6a1b9a',
                                                        }}
                                                    />
                                                    <div
                                                        className='mat__ou-row__bar-theo'
                                                        style={{ left: `${r.recovery.theoreticalRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className='mat__aiscan__meta' style={{ marginTop: 4 }}>
                                                If entry loses → <b>{r.recovery.label}</b> at{' '}
                                                <b>${r.recoveryStake.toFixed(2)}</b> → 1 win covers loss + returns{' '}
                                                <b style={{ color: '#f0a500' }}>${recNetProfit}</b> net profit
                                            </div>
                                        </>
                                    ) : (
                                        <div className='mat__ou-row mat__ou-row--rec' style={{ opacity: 0.6 }}>
                                            <div className='mat__ou-row__badge mat__ou-row__badge--rec'>RECOVERY</div>
                                            <div className='mat__ou-row__info'>
                                                <span style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>
                                                    ⚠ No clean recovery available — all other barriers either have no
                                                    edge or require &gt;6× stake
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <p style={{ fontSize: 11, color: '#aaa', marginTop: 8, padding: '0 4px' }}>
                Valid range: Over 2–7 · Under 2–7. Entry = highest composite edge score across all valid barriers.
                Recovery = best positive-edge barrier that covers loss + entry profit in one win (stake ≤ 6×). "Trend
                confirmed" means both short-term (recent ~10 ticks) and long-term windows agree. For analysis only — not
                financial advice.
            </p>
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
    const [overBarrier, setOverBarrier] = useState(4);
    const [underBarrier, setUnderBarrier] = useState(4);
    const [overInput, setOverInput] = useState('4'); // raw string for the input field
    const [underInput, setUnderInput] = useState('4'); // raw string for the input field
    const [overEnabled, setOverEnabled] = useState(true);
    const [underEnabled, setUnderEnabled] = useState(true);
    const [tradeTypeFilter, setTradeTypeFilter] = useState('all');

    const serviceRef = useRef<MarketAnalysisService | null>(null);
    const latestResultsRef = useRef<MarketResult[]>([]);
    const uiTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        // Store results in a ref on every tick — no re-render per tick
        svc.setUpdateCallback((r: MarketResult[], _b: BestMarket | null) => {
            latestResultsRef.current = r;
        });
        svc.setStatusCallback((s: ConnectionStatus, msg?: string) => {
            setStatus(s);
            setStatusMsg(msg || '');
        });
        svc.setBarriers(overBarrier, underBarrier);
        serviceRef.current = svc;

        // Refresh UI at a steady 2-second interval — no flicker
        uiTickerRef.current = setInterval(() => {
            if (latestResultsRef.current.length > 0) {
                setResults([...latestResultsRef.current]);
            }
        }, 2000);

        return () => {
            svc.disconnect();
            if (uiTickerRef.current) clearInterval(uiTickerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, getToken]);

    // Sync barriers to service whenever user changes them
    useEffect(() => {
        serviceRef.current?.setBarriers(overBarrier, underBarrier);
    }, [overBarrier, underBarrier]);

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

    // Strip Matches/Differs everywhere + apply Over/Under toggles
    const visibleResults = results.map(r => ({
        ...r,
        liveSignals: r.liveSignals.filter(s => {
            if (s.subType === 'matches_differs') return false;
            if (s.subType !== 'over_under') return true;
            if (!overEnabled && s.label.startsWith('Over')) return false;
            if (!underEnabled && s.label.startsWith('Under')) return false;
            return true;
        }),
    }));

    const SECTION_TABS: { key: SectionTab; label: string }[] = [
        { key: 'rankings', label: '🏆 Market Rankings' },
        { key: 'circles', label: '🔵 Circle Analysis' },
        { key: 'graphical', label: '📊 Graphical View' },
        { key: 'deepscan', label: '🔬 Deep Scan' },
        { key: 'aiscan', label: '🤖 AI Scan' },
        { key: 'ourec', label: '⚡ OU Recovery' },
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

            {/* ── Global controls bar ── */}
            <div className='mat__global-controls'>
                {/* Over digit — toggle + free-type input */}
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Over Digit (0–8)</label>
                    <div className='mat__barrier-row'>
                        <button
                            className={`mat__barrier-toggle mat__barrier-toggle--over ${overEnabled ? 'mat__barrier-toggle--on' : ''}`}
                            onClick={() => setOverEnabled(v => !v)}
                            title='Toggle Over analysis on/off'
                        >
                            {overEnabled ? 'ON' : 'OFF'}
                        </button>
                        <span className='mat__barrier-preview mat__barrier-preview--over'>Over</span>
                        <input
                            type='number'
                            value={overInput}
                            disabled={!overEnabled}
                            onChange={e => {
                                setOverInput(e.target.value);
                                const n = parseInt(e.target.value, 10);
                                if (!isNaN(n) && n >= 0 && n <= 8) setOverBarrier(n);
                            }}
                            onBlur={() => {
                                const n = parseInt(overInput, 10);
                                const safe = isNaN(n) ? 4 : Math.max(0, Math.min(8, n));
                                setOverBarrier(safe);
                                setOverInput(String(safe));
                            }}
                            className={`mat__barrier-input mat__barrier-input--over ${!overEnabled ? 'mat__barrier-input--disabled' : ''}`}
                        />
                    </div>
                </div>
                {/* Under digit — toggle + free-type input */}
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Under Digit (1–9)</label>
                    <div className='mat__barrier-row'>
                        <button
                            className={`mat__barrier-toggle mat__barrier-toggle--under ${underEnabled ? 'mat__barrier-toggle--on' : ''}`}
                            onClick={() => setUnderEnabled(v => !v)}
                            title='Toggle Under analysis on/off'
                        >
                            {underEnabled ? 'ON' : 'OFF'}
                        </button>
                        <span className='mat__barrier-preview mat__barrier-preview--under'>Under</span>
                        <input
                            type='number'
                            value={underInput}
                            disabled={!underEnabled}
                            onChange={e => {
                                setUnderInput(e.target.value);
                                const n = parseInt(e.target.value, 10);
                                if (!isNaN(n) && n >= 1 && n <= 9) setUnderBarrier(n);
                            }}
                            onBlur={() => {
                                const n = parseInt(underInput, 10);
                                const safe = isNaN(n) ? 4 : Math.max(1, Math.min(9, n));
                                setUnderBarrier(safe);
                                setUnderInput(String(safe));
                            }}
                            className={`mat__barrier-input mat__barrier-input--under ${!underEnabled ? 'mat__barrier-input--disabled' : ''}`}
                        />
                    </div>
                </div>
                <div className='mat__ctrl-group'>
                    <label className='mat__ctrl-label'>Trade Type Focus</label>
                    <select
                        className='mat__market-select mat__market-select--sm'
                        value={tradeTypeFilter}
                        onChange={e => setTradeTypeFilter(e.target.value)}
                    >
                        {TRADE_TYPE_OPTS.map(o => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
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
            {sectionTab === 'rankings' && (
                <RankingsSection
                    results={visibleResults}
                    onSelectMarket={handleSelectMarket}
                    tradeTypeFilter={tradeTypeFilter}
                />
            )}
            {sectionTab === 'circles' && (
                <CirclesSection
                    results={visibleResults}
                    selectedSymbol={selectedSymbol}
                    onSymbolChange={setSelectedSymbol}
                    tradeTypeFilter={tradeTypeFilter}
                    onTradeTypeChange={setTradeTypeFilter}
                    overBarrier={overBarrier}
                    underBarrier={underBarrier}
                    overEnabled={overEnabled}
                    underEnabled={underEnabled}
                />
            )}
            {sectionTab === 'graphical' && (
                <GraphicalSection
                    results={visibleResults}
                    onSelectMarket={handleSelectMarket}
                    tradeTypeFilter={tradeTypeFilter}
                />
            )}
            {sectionTab === 'deepscan' && (
                <DeepScanSection
                    results={visibleResults}
                    service={serviceRef.current}
                    overBarrier={overBarrier}
                    underBarrier={underBarrier}
                    tradeTypeFilter={tradeTypeFilter}
                />
            )}

            {sectionTab === 'aiscan' && <AIScanSection results={visibleResults} tradeTypeFilter={tradeTypeFilter} />}

            {sectionTab === 'ourec' && <OURecoverySection results={results} />}

            {/* ── Disclaimer ── */}
            <p className='mat__disclaimer'>
                Analysis is based on historical tick patterns. Past performance does not guarantee future results. This
                tool is for educational and informational purposes only.
            </p>
        </div>
    );
};
