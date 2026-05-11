/**
 * MultiMarketDiffersBot - Main container component
 */

import React, { useState, useEffect } from 'react';
import { BotConfig } from './BotConfig';
import { BotDashboard, MarketStat } from './BotDashboard';
import { DerivApiService } from './DerivApiService';
import { useStore } from '@deriv/stores';
import './MultiMarketDiffersBot.scss';

type BotConfigData = {
    mode: 'global' | 'individual';
    markets: any[];
    global: {
        targetDigit: number;
        stake: number;
        stopLoss: number;
        takeProfit: number;
        martingaleEnabled: boolean;
        martingaleMultiplier: number;
        martingaleMaxLevels: number;
    };
};

// Get auth token — same method used by the working BotEngine in SuperBots.tsx
const getAuthToken = (client: any): string => {
    const fromStore = client.getToken?.();
    if (fromStore) return fromStore;

    const fromSession = sessionStorage.getItem('client.tokens');
    if (fromSession) return fromSession;

    try {
        const stored = localStorage.getItem('client.accounts');
        if (stored) {
            const accounts = JSON.parse(stored);
            const activeId = localStorage.getItem('active_loginid') || '';
            if (activeId && accounts[activeId]?.token) return accounts[activeId].token;
            const first = Object.values(accounts as Record<string, any>).find((a: any) => a.token);
            if ((first as any)?.token) return (first as any).token;
        }
    } catch (e) {
        /* ignore */
    }

    return '';
};

export const MultiMarketDiffersBot = () => {
    const { client } = useStore();
    const [botRunning, setBotRunning] = useState(false);
    const [marketStats, setMarketStats] = useState<Record<string, MarketStat>>({});
    const apiServiceRef = React.useRef<DerivApiService | null>(null);
    const [config, setConfig] = useState<BotConfigData | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>(
        'disconnected'
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const errorSetRef = React.useRef(false);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            apiServiceRef.current?.disconnect();
        };
    }, []);

    const handleTradeUpdate = (tradeResult: any) => {
        setMarketStats(prev => {
            const symbol = tradeResult.marketSymbol;
            const existing = prev[symbol] || {
                marketSymbol: symbol,
                marketName: tradeResult.marketName,
                runs: 0,
                wins: 0,
                losses: 0,
                profit: 0,
                status: 'active' as const,
                martingaleLevel: 0,
            };

            const isSettled = tradeResult.status === 'won' || tradeResult.status === 'lost';
            const isWin = tradeResult.status === 'won';
            const isLoss = tradeResult.status === 'lost';

            return {
                ...prev,
                [symbol]: {
                    ...existing,
                    runs: isSettled ? existing.runs + 1 : existing.runs,
                    wins: isWin ? existing.wins + 1 : existing.wins,
                    losses: isLoss ? existing.losses + 1 : existing.losses,
                    profit: tradeResult.currentProfit,
                    lastDigit: tradeResult.lastDigit ?? existing.lastDigit,
                    martingaleLevel: tradeResult.martingaleLevel,
                    status: (tradeResult.status === 'stopped' ? 'stopped' : 'active') as 'active' | 'stopped',
                },
            };
        });
    };

    const handleStartBot = async (botConfig: BotConfigData) => {
        setErrorMessage(null);
        errorSetRef.current = false;
        setConfig(botConfig);
        setConnectionStatus('connecting');
        setMarketStats({});

        apiServiceRef.current?.disconnect();

        const token = getAuthToken(client);
        console.log('[Bot] Token found:', token ? `${token.substring(0, 8)}...` : 'EMPTY');

        if (!token) {
            setErrorMessage('Not logged in — please log into your Deriv account first');
            errorSetRef.current = true;
            setConnectionStatus('disconnected');
            return;
        }

        const service = new DerivApiService(token);
        service.setErrorCallback((error: string) => {
            console.error('[Bot Error]', error);
            if (!errorSetRef.current) {
                setErrorMessage(error);
                errorSetRef.current = true;
            }
        });
        service.setTradeUpdateCallback(handleTradeUpdate);
        apiServiceRef.current = service;

        try {
            const connected = await Promise.race([
                service.connect(),
                new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 10000)),
            ]);

            if (!connected) {
                if (!errorSetRef.current) {
                    setErrorMessage('Failed to connect to Deriv API — check your login status');
                    errorSetRef.current = true;
                }
                setConnectionStatus('disconnected');
                return;
            }

            setConnectionStatus('connected');
            setBotRunning(true);

            // Initialize market stats rows immediately so table shows all markets
            const initialStats: Record<string, MarketStat> = {};
            botConfig.markets.forEach((m: any) => {
                initialStats[m.symbol] = {
                    marketSymbol: m.symbol,
                    marketName: m.name,
                    runs: 0,
                    wins: 0,
                    losses: 0,
                    profit: 0,
                    status: 'active',
                    martingaleLevel: 0,
                };
            });
            setMarketStats(initialStats);

            await service.executeAllMarketsSimultaneously(
                botConfig.markets,
                botConfig.mode,
                botConfig.global.targetDigit
            );
        } catch (error) {
            console.error('[Bot] Failed to start:', error);
            if (!errorSetRef.current) {
                setErrorMessage(`Failed to start bot: ${error}`);
            }
            setBotRunning(false);
            setConnectionStatus('disconnected');
        }
    };

    const handleStopBot = async () => {
        await apiServiceRef.current?.stopAllMarkets();
        setBotRunning(false);
        setConnectionStatus('disconnected');
    };

    const clearError = () => {
        setErrorMessage(null);
        errorSetRef.current = false;
    };

    return (
        <div className='mm-differs-bot'>
            <div className='mm-differs-bot__container'>
                {/* Header */}
                <div className='mm-differs-bot__header'>
                    <h1 className='mm-differs-bot__title'>Multi-Market Differs Super Bot</h1>
                    <div className='mm-differs-bot__status'>
                        <span className={`mm-differs-bot__status-badge ${botRunning ? 'running' : 'stopped'}`}>
                            {botRunning ? '🟢 Running' : '⏸ Stopped'}
                        </span>
                        {connectionStatus === 'connecting' && (
                            <span className='mm-differs-bot__connection-badge connecting'>Connecting...</span>
                        )}
                        {connectionStatus === 'connected' && (
                            <span className='mm-differs-bot__connection-badge connected'>✓ Connected</span>
                        )}
                    </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className='mm-differs-bot__error'>
                        <span className='mm-differs-bot__error-icon'>⚠️</span>
                        <span className='mm-differs-bot__error-message'>{errorMessage}</span>
                        <button className='mm-differs-bot__error-close' onClick={clearError}>
                            ✕
                        </button>
                    </div>
                )}

                {/* Main Content — split when running */}
                <div className={botRunning ? 'mm-differs-bot__split' : ''}>
                    {/* Config panel — always visible */}
                    <div className={botRunning ? 'mm-differs-bot__config-side' : 'mm-differs-bot__config-panel'}>
                        <BotConfig
                            onStartBot={handleStartBot}
                            botRunning={botRunning}
                            onStopBot={handleStopBot}
                            errorMessage={errorMessage}
                            connectionStatus={connectionStatus}
                        />
                    </div>

                    {/* Live stats table — only when running */}
                    {botRunning && (
                        <div className='mm-differs-bot__stats-side'>
                            <BotDashboard
                                marketStats={marketStats}
                                mode={config?.mode || 'global'}
                                globalTargetDigit={config?.global?.targetDigit}
                                onStop={handleStopBot}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
