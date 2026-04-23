/**
 * Multi-Market Differs Bot Configuration Component
 * Two-column layout: markets list (left) + settings/summary/action sidebar (right)
 */

import React, { useState, useEffect } from 'react';

type Market = {
    symbol: string;
    name: string;
    enabled: boolean;
    targetDigit: number;
    stake: number;
    stopLoss: number;
    takeProfit: number;
    martingaleEnabled: boolean;
    martingaleMultiplier: number;
    martingaleMaxLevels: number;
};

type GlobalConfig = {
    targetDigit: number;
    stake: number;
    stopLoss: number;
    takeProfit: number;
    martingaleEnabled: boolean;
    martingaleMultiplier: number;
    martingaleMaxLevels: number;
};

type Props = {
    onStartBot: (config: any) => void;
    botRunning: boolean;
    onStopBot: () => void;
    errorMessage?: string | null;
    connectionStatus?: 'disconnected' | 'connecting' | 'connected';
};

const makeMarket = (symbol: string, name: string): Market => ({
    symbol,
    name,
    enabled: false,
    targetDigit: 7,
    stake: 1,
    stopLoss: 10,
    takeProfit: 20,
    martingaleEnabled: false,
    martingaleMultiplier: 2,
    martingaleMaxLevels: 5,
});

const fetchVolatilityMarkets = (): Promise<Market[]> =>
    new Promise(resolve => {
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        ws.onopen = () => ws.send(JSON.stringify({ active_symbols: 'brief', product_type: 'basic' }));
        ws.onmessage = e => {
            const data = JSON.parse(e.data);
            if (data.active_symbols) {
                const markets = data.active_symbols
                    .filter(
                        (s: any) =>
                            s.market === 'synthetic_index' &&
                            s.submarket === 'random_index' &&
                            s.display_name.toLowerCase().includes('volatility') &&
                            !s.is_trading_suspended
                    )
                    .sort((a: any, b: any) => a.display_name.localeCompare(b.display_name))
                    .map((s: any) => makeMarket(s.symbol, s.display_name));
                ws.close();
                resolve(markets);
            }
        };
        ws.onerror = () => {
            ws.close();
            resolve([
                makeMarket('R_10', 'Volatility 10 Index'),
                makeMarket('R_25', 'Volatility 25 Index'),
                makeMarket('R_50', 'Volatility 50 Index'),
                makeMarket('R_75', 'Volatility 75 Index'),
                makeMarket('R_100', 'Volatility 100 Index'),
            ]);
        };
    });

const STORAGE_KEY = 'mm_differs_bot_config';
const loadSavedConfig = (): GlobalConfig => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        /* ignore */
    }
    return {
        targetDigit: 7,
        stake: 1,
        stopLoss: 10,
        takeProfit: 20,
        martingaleEnabled: false,
        martingaleMultiplier: 2,
        martingaleMaxLevels: 5,
    };
};

export const BotConfig = ({ onStartBot, botRunning, onStopBot, errorMessage, connectionStatus }: Props) => {
    const [mode, setMode] = useState<'global' | 'individual'>('global');
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loadingMarkets, setLoadingMarkets] = useState(true);
    const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(loadSavedConfig);

    useEffect(() => {
        fetchVolatilityMarkets().then(m => {
            setMarkets(m);
            setLoadingMarkets(false);
        });
    }, []);

    useEffect(() => {
        if (mode === 'global') {
            setMarkets(prev => prev.map(m => ({ ...m, ...globalConfig })));
        }
    }, [mode]);

    const toggleMarket = (index: number) => {
        setMarkets(prev => prev.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m)));
    };

    const updateMarket = (index: number, field: keyof Market, value: any) => {
        setMarkets(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
    };

    const updateGlobal = (field: keyof GlobalConfig, value: any) => {
        const updated = { ...globalConfig, [field]: value };
        setGlobalConfig(updated);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            /* ignore */
        }
        if (mode === 'global') {
            setMarkets(prev => prev.map(m => ({ ...m, [field]: value })));
        }
    };

    const enabledMarkets = markets.filter(m => m.enabled);
    const count = enabledMarkets.length;
    const totalStake = mode === 'global' ? globalConfig.stake * count : enabledMarkets.reduce((s, m) => s + m.stake, 0);
    const totalRisk =
        mode === 'global' ? globalConfig.stopLoss * count : enabledMarkets.reduce((s, m) => s + m.stopLoss, 0);
    const totalProfit =
        mode === 'global' ? globalConfig.takeProfit * count : enabledMarkets.reduce((s, m) => s + m.takeProfit, 0);

    const handleStart = () => {
        if (count === 0) {
            alert('Please select at least one market');
            return;
        }
        const marketsToRun = enabledMarkets.map(m => (mode === 'global' ? { ...m, ...globalConfig } : m));
        onStartBot({ mode, markets: marketsToRun, global: globalConfig });
    };

    const digitOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <div className='mm-differs__config'>
            {/* Header */}
            <div className='mm-differs__config-header'>
                <h2 className='mm-differs__title'>Multi-Market Differs Bot</h2>
                <p className='mm-differs__subtitle'>Differs trades across multiple volatility indices simultaneously</p>
            </div>

            {/* Mode Toggle */}
            <div className='mm-differs__mode-toggle'>
                <button
                    className={`mm-differs__mode-btn ${mode === 'global' ? 'active' : ''}`}
                    onClick={() => setMode('global')}
                    disabled={botRunning}
                >
                    Global Settings
                </button>
                <button
                    className={`mm-differs__mode-btn ${mode === 'individual' ? 'active' : ''}`}
                    onClick={() => setMode('individual')}
                    disabled={botRunning}
                >
                    Individual Settings
                </button>
            </div>

            {/* Two-column body */}
            <div className='mm-differs__config-body'>
                {/* LEFT — Markets list */}
                <div className='mm-differs__markets-col'>
                    <h3 className='mm-differs__section-title'>
                        Select Markets
                        <span className='mm-differs__count-badge'>{count} selected</span>
                    </h3>
                    {loadingMarkets && <p style={{ color: '#a0a0a0' }}>Loading markets...</p>}
                    <div className='mm-differs__markets-list'>
                        {markets.map((market, index) => (
                            <div
                                key={market.symbol}
                                className={`mm-differs__market-card ${market.enabled ? 'enabled' : ''}`}
                            >
                                <label className='mm-differs__market-header'>
                                    <input
                                        type='checkbox'
                                        checked={market.enabled}
                                        onChange={() => toggleMarket(index)}
                                        disabled={botRunning}
                                    />
                                    <span className='mm-differs__market-name'>{market.name}</span>
                                    <span className='mm-differs__market-symbol'>{market.symbol}</span>
                                </label>

                                {market.enabled && mode === 'individual' && (
                                    <div className='mm-differs__market-settings'>
                                        <div className='mm-differs__form-group'>
                                            <label>Target Digit</label>
                                            <select
                                                value={market.targetDigit}
                                                onChange={e =>
                                                    updateMarket(index, 'targetDigit', parseInt(e.target.value))
                                                }
                                                disabled={botRunning}
                                            >
                                                {digitOptions.map(d => (
                                                    <option key={d} value={d}>
                                                        {d}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className='mm-differs__form-group'>
                                            <label>Stake ($)</label>
                                            <input
                                                type='number'
                                                value={market.stake}
                                                onChange={e => updateMarket(index, 'stake', parseFloat(e.target.value))}
                                                min='1'
                                                disabled={botRunning}
                                            />
                                        </div>
                                        <div className='mm-differs__form-row'>
                                            <div className='mm-differs__form-group'>
                                                <label>SL ($)</label>
                                                <input
                                                    type='number'
                                                    value={market.stopLoss}
                                                    onChange={e =>
                                                        updateMarket(index, 'stopLoss', parseFloat(e.target.value))
                                                    }
                                                    min='1'
                                                    disabled={botRunning}
                                                />
                                            </div>
                                            <div className='mm-differs__form-group'>
                                                <label>TP ($)</label>
                                                <input
                                                    type='number'
                                                    value={market.takeProfit}
                                                    onChange={e =>
                                                        updateMarket(index, 'takeProfit', parseFloat(e.target.value))
                                                    }
                                                    min='1'
                                                    disabled={botRunning}
                                                />
                                            </div>
                                        </div>
                                        <div className='mm-differs__form-group'>
                                            <label>Martingale</label>
                                            <label className='mm-differs__switch'>
                                                <input
                                                    type='checkbox'
                                                    checked={market.martingaleEnabled}
                                                    onChange={e =>
                                                        updateMarket(index, 'martingaleEnabled', e.target.checked)
                                                    }
                                                    disabled={botRunning}
                                                />
                                                <span className='mm-differs__slider'></span>
                                            </label>
                                        </div>
                                        {market.martingaleEnabled && (
                                            <div className='mm-differs__form-row'>
                                                <div className='mm-differs__form-group'>
                                                    <label>Multiplier</label>
                                                    <input
                                                        type='number'
                                                        value={market.martingaleMultiplier}
                                                        onChange={e =>
                                                            updateMarket(
                                                                index,
                                                                'martingaleMultiplier',
                                                                parseFloat(e.target.value)
                                                            )
                                                        }
                                                        min='1'
                                                        max='3'
                                                        step='0.5'
                                                        disabled={botRunning}
                                                    />
                                                </div>
                                                <div className='mm-differs__form-group'>
                                                    <label>Max Levels</label>
                                                    <input
                                                        type='number'
                                                        value={market.martingaleMaxLevels}
                                                        onChange={e =>
                                                            updateMarket(
                                                                index,
                                                                'martingaleMaxLevels',
                                                                parseInt(e.target.value)
                                                            )
                                                        }
                                                        min='1'
                                                        max='10'
                                                        disabled={botRunning}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT — Settings + Summary + Action (sticky sidebar) */}
                <div className='mm-differs__sidebar'>
                    {/* Global Settings (only in global mode) */}
                    {mode === 'global' && (
                        <div className='mm-differs__sidebar-section'>
                            <h3 className='mm-differs__section-title'>Settings</h3>

                            <div className='mm-differs__form-group'>
                                <label>Target Digit (0–9)</label>
                                <select
                                    value={globalConfig.targetDigit}
                                    onChange={e => updateGlobal('targetDigit', parseInt(e.target.value))}
                                    disabled={botRunning}
                                >
                                    {digitOptions.map(d => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className='mm-differs__form-group'>
                                <label>Stake per Market ($)</label>
                                <input
                                    type='number'
                                    value={globalConfig.stake}
                                    onChange={e => updateGlobal('stake', parseFloat(e.target.value))}
                                    min='1'
                                    disabled={botRunning}
                                />
                            </div>

                            <div className='mm-differs__form-row'>
                                <div className='mm-differs__form-group'>
                                    <label>Stop Loss ($)</label>
                                    <input
                                        type='number'
                                        value={globalConfig.stopLoss}
                                        onChange={e => updateGlobal('stopLoss', parseFloat(e.target.value))}
                                        min='1'
                                        disabled={botRunning}
                                    />
                                </div>
                                <div className='mm-differs__form-group'>
                                    <label>Take Profit ($)</label>
                                    <input
                                        type='number'
                                        value={globalConfig.takeProfit}
                                        onChange={e => updateGlobal('takeProfit', parseFloat(e.target.value))}
                                        min='1'
                                        disabled={botRunning}
                                    />
                                </div>
                            </div>

                            <div className='mm-differs__form-group'>
                                <label>Martingale</label>
                                <label className='mm-differs__switch'>
                                    <input
                                        type='checkbox'
                                        checked={globalConfig.martingaleEnabled}
                                        onChange={e => updateGlobal('martingaleEnabled', e.target.checked)}
                                        disabled={botRunning}
                                    />
                                    <span className='mm-differs__slider'></span>
                                </label>
                            </div>

                            {globalConfig.martingaleEnabled && (
                                <div className='mm-differs__form-row'>
                                    <div className='mm-differs__form-group'>
                                        <label>Multiplier</label>
                                        <input
                                            type='number'
                                            value={globalConfig.martingaleMultiplier}
                                            onChange={e =>
                                                updateGlobal('martingaleMultiplier', parseFloat(e.target.value))
                                            }
                                            min='1'
                                            max='3'
                                            step='0.5'
                                            disabled={botRunning}
                                        />
                                    </div>
                                    <div className='mm-differs__form-group'>
                                        <label>Max Levels</label>
                                        <input
                                            type='number'
                                            value={globalConfig.martingaleMaxLevels}
                                            onChange={e =>
                                                updateGlobal('martingaleMaxLevels', parseInt(e.target.value))
                                            }
                                            min='1'
                                            max='10'
                                            disabled={botRunning}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    <div className='mm-differs__sidebar-section mm-differs__summary'>
                        <h3 className='mm-differs__section-title'>Summary</h3>
                        <div className='mm-differs__summary-row'>
                            <span>Markets Selected</span>
                            <strong>{count}</strong>
                        </div>
                        <div className='mm-differs__summary-row'>
                            <span>Stake / Market</span>
                            <strong className='positive'>
                                $
                                {(mode === 'global' ? globalConfig.stake : count > 0 ? totalStake / count : 0).toFixed(
                                    2
                                )}
                            </strong>
                        </div>
                        <div className='mm-differs__summary-row'>
                            <span>Total Stake</span>
                            <strong style={{ color: '#a0a0a0' }}>${totalStake.toFixed(2)}</strong>
                        </div>
                        <div className='mm-differs__summary-row'>
                            <span>Total Risk</span>
                            <strong className='negative'>${totalRisk.toFixed(2)}</strong>
                        </div>
                        <div className='mm-differs__summary-row'>
                            <span>Profit Target</span>
                            <strong className='positive'>${totalProfit.toFixed(2)}</strong>
                        </div>
                    </div>

                    {/* Action button */}
                    <div className='mm-differs__sidebar-action'>
                        {connectionStatus === 'connecting' && (
                            <div className='mm-differs__connecting-msg'>⏳ Connecting to Deriv API...</div>
                        )}
                        {errorMessage && <div className='mm-differs__error-msg'>⚠️ {errorMessage}</div>}
                        {!botRunning ? (
                            <button
                                className='mm-differs__btn mm-differs__btn--start'
                                onClick={handleStart}
                                disabled={connectionStatus === 'connecting' || count === 0}
                            >
                                {connectionStatus === 'connecting'
                                    ? '⏳ Connecting...'
                                    : `▶ RUN THE BOT${count > 0 ? ` (${count})` : ''}`}
                            </button>
                        ) : (
                            <button className='mm-differs__btn mm-differs__btn--stop' onClick={onStopBot}>
                                ⏹ STOP ALL MARKETS
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
