import { useState } from 'react';
import './risk-calculator.scss';

type TResult = {
    risk_amount: number;
    potential_profit: number;
    rr_ratio: string;
    max_trades: number;
    recovery_trades: number;
};

const RiskCalculatorPage = () => {
    const [balance, setBalance] = useState('1000');
    const [risk_pct, setRiskPct] = useState('2');
    const [rr, setRr] = useState('2');
    const [stake, setStake] = useState('');
    const [payout, setPayout] = useState('');
    const [result, setResult] = useState<TResult | null>(null);

    const calculate = () => {
        const bal = parseFloat(balance) || 0;
        const rp = parseFloat(risk_pct) || 0;
        const rrv = parseFloat(rr) || 2;

        const risk_amount = (bal * rp) / 100;
        const potential_profit = risk_amount * rrv;
        const max_trades = rp > 0 ? Math.floor(100 / rp) : 0;
        const recovery_trades = Math.ceil(1 / (rrv - 1 > 0 ? rrv - 1 : 1));

        setResult({ risk_amount, potential_profit, rr_ratio: `1:${rrv}`, max_trades, recovery_trades });
    };

    const reset = () => {
        setBalance('1000');
        setRiskPct('2');
        setRr('2');
        setStake('');
        setPayout('');
        setResult(null);
    };

    // Derived stake suggestion
    const suggested_stake = balance && risk_pct ? ((parseFloat(balance) * parseFloat(risk_pct)) / 100).toFixed(2) : '';

    return (
        <div className='dpa-calc'>
            {/* ── Banner ──────────────────────────────────── */}
            <div className='dpa-calc__banner'>
                <div className='dpa-calc__banner-inner'>
                    <span className='dpa-calc__banner-tag'>RISK MANAGEMENT</span>
                    <h1 className='dpa-calc__banner-title'>Risk Calculator</h1>
                    <p className='dpa-calc__banner-sub'>
                        Calculate your optimal stake size and manage your risk like a professional trader.
                    </p>
                </div>
            </div>

            <div className='dpa-calc__content'>
                <div className='dpa-calc__layout'>
                    {/* ── Inputs ──────────────────────────────── */}
                    <div className='dpa-calc__panel'>
                        <h2 className='dpa-calc__panel-title'>Your Parameters</h2>

                        <div className='dpa-calc__field'>
                            <label className='dpa-calc__label'>Account Balance ($)</label>
                            <input
                                className='dpa-calc__input'
                                type='number'
                                min='0'
                                value={balance}
                                onChange={e => setBalance(e.target.value)}
                                placeholder='e.g. 1000'
                            />
                        </div>

                        <div className='dpa-calc__field'>
                            <label className='dpa-calc__label'>
                                Risk per Trade (%)
                                <span className='dpa-calc__label-hint'> — recommended: 1–3%</span>
                            </label>
                            <input
                                className='dpa-calc__input'
                                type='number'
                                min='0.1'
                                max='100'
                                step='0.1'
                                value={risk_pct}
                                onChange={e => setRiskPct(e.target.value)}
                                placeholder='e.g. 2'
                            />
                            <div className='dpa-calc__range-wrap'>
                                <input
                                    type='range'
                                    min='0.5'
                                    max='20'
                                    step='0.5'
                                    value={risk_pct}
                                    onChange={e => setRiskPct(e.target.value)}
                                    className='dpa-calc__range'
                                />
                                <div className='dpa-calc__range-labels'>
                                    <span>Safe 0.5%</span>
                                    <span>Aggressive 20%</span>
                                </div>
                            </div>
                        </div>

                        <div className='dpa-calc__field'>
                            <label className='dpa-calc__label'>
                                Reward:Risk Ratio
                                <span className='dpa-calc__label-hint'> — minimum: 1.5</span>
                            </label>
                            <input
                                className='dpa-calc__input'
                                type='number'
                                min='0.5'
                                step='0.1'
                                value={rr}
                                onChange={e => setRr(e.target.value)}
                                placeholder='e.g. 2'
                            />
                        </div>

                        {suggested_stake && (
                            <div className='dpa-calc__suggestion'>
                                💡 Suggested stake: <strong>${suggested_stake}</strong> based on your balance and risk %
                            </div>
                        )}

                        <div className='dpa-calc__actions'>
                            <button className='dpa-calc__btn dpa-calc__btn--primary' onClick={calculate}>
                                Calculate
                            </button>
                            <button className='dpa-calc__btn dpa-calc__btn--secondary' onClick={reset}>
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* ── Results ─────────────────────────────── */}
                    <div className='dpa-calc__results-panel'>
                        <h2 className='dpa-calc__panel-title'>Results</h2>

                        {!result ? (
                            <div className='dpa-calc__results-placeholder'>
                                <div className='dpa-calc__results-placeholder-icon'>🧮</div>
                                <p>Fill in your parameters and click Calculate to see your risk breakdown.</p>
                            </div>
                        ) : (
                            <div className='dpa-calc__results'>
                                <div className='dpa-calc__result-card dpa-calc__result-card--risk'>
                                    <div className='dpa-calc__result-icon'>⚠️</div>
                                    <div className='dpa-calc__result-body'>
                                        <div className='dpa-calc__result-label'>Risk Amount per Trade</div>
                                        <div className='dpa-calc__result-value'>${result.risk_amount.toFixed(2)}</div>
                                    </div>
                                </div>

                                <div className='dpa-calc__result-card dpa-calc__result-card--profit'>
                                    <div className='dpa-calc__result-icon'>💰</div>
                                    <div className='dpa-calc__result-body'>
                                        <div className='dpa-calc__result-label'>Potential Profit per Win</div>
                                        <div className='dpa-calc__result-value'>
                                            ${result.potential_profit.toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <div className='dpa-calc__result-card'>
                                    <div className='dpa-calc__result-icon'>📊</div>
                                    <div className='dpa-calc__result-body'>
                                        <div className='dpa-calc__result-label'>Reward:Risk Ratio</div>
                                        <div className='dpa-calc__result-value'>{result.rr_ratio}</div>
                                    </div>
                                </div>

                                <div className='dpa-calc__result-card'>
                                    <div className='dpa-calc__result-icon'>🔢</div>
                                    <div className='dpa-calc__result-body'>
                                        <div className='dpa-calc__result-label'>
                                            Max Consecutive Losses before Blowup
                                        </div>
                                        <div className='dpa-calc__result-value'>{result.max_trades} trades</div>
                                    </div>
                                </div>

                                <div className='dpa-calc__result-card'>
                                    <div className='dpa-calc__result-icon'>🔄</div>
                                    <div className='dpa-calc__result-body'>
                                        <div className='dpa-calc__result-label'>Wins Needed to Recover 1 Loss</div>
                                        <div className='dpa-calc__result-value'>{result.recovery_trades} trades</div>
                                    </div>
                                </div>

                                {/* ── Risk level indicator ─────── */}
                                <div className='dpa-calc__risk-indicator'>
                                    <div className='dpa-calc__risk-label'>Your Risk Level</div>
                                    <div className='dpa-calc__risk-bar-wrap'>
                                        <div
                                            className='dpa-calc__risk-bar'
                                            style={{
                                                width: `${Math.min((parseFloat(risk_pct) / 20) * 100, 100)}%`,
                                                background:
                                                    parseFloat(risk_pct) <= 2
                                                        ? '#2e7d32'
                                                        : parseFloat(risk_pct) <= 5
                                                          ? '#f57c00'
                                                          : '#c62828',
                                            }}
                                        />
                                    </div>
                                    <div className='dpa-calc__risk-gauge-labels'>
                                        <span style={{ color: '#2e7d32' }}>Conservative</span>
                                        <span style={{ color: '#f57c00' }}>Moderate</span>
                                        <span style={{ color: '#c62828' }}>Aggressive</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Tips ────────────────────────────────────── */}
                <div className='dpa-calc__tips'>
                    <h3 className='dpa-calc__tips-title'>Risk Management Tips</h3>
                    <div className='dpa-calc__tips-grid'>
                        {[
                            { icon: '✅', tip: 'Never risk more than 2–3% of your account on a single trade.' },
                            { icon: '📉', tip: 'Set a daily loss limit of 5–10% — stop trading if hit.' },
                            {
                                icon: '🔁',
                                tip: 'A 1:2 reward-to-risk ratio means you only need to win 33% of trades to be profitable.',
                            },
                            { icon: '🧊', tip: 'Reduce position size during losing streaks, not increase it.' },
                            {
                                icon: '📒',
                                tip: 'Keep a trade journal — review your entries to find patterns in losses.',
                            },
                            { icon: '🛑', tip: 'Drawdown over 20%? Take a break and analyse before continuing.' },
                        ].map((t, i) => (
                            <div key={i} className='dpa-calc__tip'>
                                <span className='dpa-calc__tip-icon'>{t.icon}</span>
                                <span className='dpa-calc__tip-text'>{t.tip}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskCalculatorPage;
