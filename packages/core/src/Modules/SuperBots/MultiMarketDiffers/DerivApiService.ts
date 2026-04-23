/**
 * DerivApiService - Multi-market DIGITDIFF bot
 * Uses the same event-driven WebSocket pattern as the working BotEngine in SuperBots.tsx
 * Auto-reconnects on connection drop while bot is running.
 */

type Market = {
    symbol: string;
    name: string;
    targetDigit: number;
    stake: number;
    stopLoss: number;
    takeProfit: number;
    martingaleEnabled: boolean;
    martingaleMultiplier: number;
    martingaleMaxLevels: number;
};

export type TradeResult = {
    contractId: string;
    marketSymbol: string;
    marketName: string;
    targetDigit: number;
    stake: number;
    status: 'pending' | 'running' | 'won' | 'lost' | 'refunded';
    currentProfit: number;
    lastDigit?: number;
    martingaleLevel: number;
    startTime: number;
};

type MarketState = {
    market: Market;
    currentStake: number;
    martingaleLevel: number;
    cumulativeProfit: number;
    stopped: boolean;
    pendingContractId?: string | number;
    tradeCount: number;
};

export class DerivApiService {
    private ws: WebSocket | null = null;
    private token: string;
    private appId: string = '36300';
    private isAuthorized = false;
    private accountCurrency = 'USD';
    private marketStates: Map<string, MarketState> = new Map();
    private ourContractIds: Set<string> = new Set();
    private pendingBuyReqIds: Map<number, string> = new Map();
    private running = false;
    private req_id = 1;
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT = 10;
    private authResolved = false;

    private onTradeUpdate?: (trade: TradeResult) => void;
    private onError?: (error: string) => void;

    constructor(token: string) {
        this.token = token;
        this.appId = window.localStorage.getItem('config.app_id') || '36300';
    }

    setTradeUpdateCallback(cb: (trade: TradeResult) => void) {
        this.onTradeUpdate = cb;
    }
    setErrorCallback(cb: (error: string) => void) {
        this.onError = cb;
    }

    connect(): Promise<boolean> {
        return new Promise(resolve => {
            this.authResolved = false;
            this.openSocket(resolve);
        });
    }

    private openSocket(authResolve?: (v: boolean) => void) {
        try {
            this.ws?.close();
            this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);

            this.ws.onopen = () => {
                console.log('[Bot] WebSocket opened, sending authorize...');
                this.isAuthorized = false;
                this.send({ authorize: this.token });
            };

            this.ws.onmessage = e => {
                const msg = JSON.parse(e.data);
                console.log('[Bot] Message received:', msg.msg_type, msg.error ?? '');
                this.handleMessage(msg, authResolve);
            };

            this.ws.onerror = err => {
                console.error('[Bot] WebSocket error:', err);
                // onerror is always followed by onclose, so let onclose handle reconnect
                if (!this.authResolved && authResolve) {
                    this.authResolved = true;
                    authResolve(false);
                }
            };

            this.ws.onclose = () => {
                this.isAuthorized = false;
                if (this.running && this.reconnectAttempts < this.MAX_RECONNECT) {
                    this.reconnectAttempts++;
                    const delay = Math.min(2000 * this.reconnectAttempts, 10000);
                    console.log(
                        `[Bot] Connection lost — reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT})`
                    );
                    setTimeout(() => this.openSocket(), delay);
                } else if (this.running) {
                    this.running = false;
                    this.onError?.('Connection lost — max reconnect attempts reached. Please restart the bot.');
                }
            };
        } catch (err: any) {
            if (!this.authResolved && authResolve) {
                this.authResolved = true;
                authResolve(false);
            }
            this.onError?.(`Failed to connect: ${err.message}`);
        }
    }

    private handleMessage(msg: any, authResolve?: (v: boolean) => void) {
        if (msg.msg_type === 'authorize') {
            if (msg.error) {
                this.onError?.(`Auth failed: ${msg.error.message}`);
                if (!this.authResolved && authResolve) {
                    this.authResolved = true;
                    authResolve(false);
                }
                return;
            }
            this.isAuthorized = true;
            this.accountCurrency = msg.authorize?.currency ?? 'USD';
            console.log(`[Bot] Authorized | currency: ${this.accountCurrency}`);

            if (!this.authResolved && authResolve) {
                this.authResolved = true;
                authResolve(true);
                return;
            }

            // Reconnect path — resume all active markets
            if (this.running) {
                console.log('[Bot] Reconnected — resuming active markets...');
                this.reconnectAttempts = 0;
                this.pendingBuyReqIds.clear();
                this.ourContractIds.clear();
                for (const [symbol, state] of this.marketStates) {
                    if (!state.stopped) {
                        setTimeout(() => this.placeTradeForMarket(symbol), 300);
                    }
                }
            }
            return;
        }

        if (!this.running) return;

        if (msg.msg_type === 'buy') {
            if (msg.error) {
                const failedSymbol = this.pendingBuyReqIds.get(msg.req_id);
                this.pendingBuyReqIds.delete(msg.req_id);
                console.error(`[Bot] Buy error on ${failedSymbol ?? 'unknown'}: ${msg.error.message}`);
                if (failedSymbol && this.running) {
                    const state = this.marketStates.get(failedSymbol);
                    if (state && !state.stopped) {
                        setTimeout(() => this.placeTradeForMarket(failedSymbol), 2000);
                    }
                }
                return;
            }
            const buy = msg.buy;
            const contractId = String(buy.contract_id);
            this.pendingBuyReqIds.delete(msg.req_id);
            this.ourContractIds.add(contractId);

            const symbol = this.getSymbolFromBuy(buy);
            if (symbol) {
                const state = this.marketStates.get(symbol);
                if (state) {
                    state.pendingContractId = contractId;
                    this.onTradeUpdate?.({
                        contractId,
                        marketSymbol: symbol,
                        marketName: state.market.name,
                        targetDigit: state.market.targetDigit,
                        stake: state.currentStake,
                        status: 'running',
                        currentProfit: state.cumulativeProfit,
                        martingaleLevel: state.martingaleLevel,
                        startTime: Date.now(),
                    });
                }
            }
            this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
        }

        if (msg.msg_type === 'proposal_open_contract') {
            const contract = msg.proposal_open_contract;
            if (!contract || !contract.is_sold) return;

            const contractId = String(contract.contract_id);
            if (!this.ourContractIds.has(contractId)) return;
            this.ourContractIds.delete(contractId);

            const symbol = contract.underlying;
            const state = this.marketStates.get(symbol);
            if (!state) return;

            const profit = parseFloat(contract.profit ?? '0');
            const exitPrice: string = contract.exit_tick?.quote?.toString() ?? '';
            const lastDigit = exitPrice ? parseInt(exitPrice.slice(-1)) : undefined;
            const status = profit > 0 ? 'won' : 'lost';

            state.cumulativeProfit += profit;
            state.tradeCount++;

            if (status === 'lost' && state.market.martingaleEnabled) {
                if (state.martingaleLevel < state.market.martingaleMaxLevels) {
                    state.martingaleLevel++;
                    state.currentStake =
                        state.market.stake * Math.pow(state.market.martingaleMultiplier, state.martingaleLevel);
                }
            } else if (status === 'won') {
                state.martingaleLevel = 0;
                state.currentStake = state.market.stake;
            }

            this.onTradeUpdate?.({
                contractId: String(contractId),
                marketSymbol: symbol,
                marketName: state.market.name,
                targetDigit: state.market.targetDigit,
                stake: parseFloat(contract.buy_price ?? String(state.currentStake)),
                status,
                currentProfit: state.cumulativeProfit,
                lastDigit,
                martingaleLevel: state.martingaleLevel,
                startTime: (contract.purchase_time ?? 0) * 1000,
            });

            // Check stop loss / take profit
            if (state.market.stopLoss > 0 && state.cumulativeProfit <= -state.market.stopLoss) {
                state.stopped = true;
                this.onError?.(`${state.market.name}: Stop Loss hit ($${state.cumulativeProfit.toFixed(2)})`);
                return;
            }
            if (state.market.takeProfit > 0 && state.cumulativeProfit >= state.market.takeProfit) {
                state.stopped = true;
                this.onError?.(`${state.market.name}: Take Profit reached ($${state.cumulativeProfit.toFixed(2)})`);
                return;
            }

            if (this.running && !state.stopped) {
                setTimeout(() => this.placeTradeForMarket(symbol), 500);
            }
        }
    }

    private getSymbolFromBuy(buy: any): string | null {
        const shortcode: string = buy.shortcode ?? '';
        for (const [symbol] of this.marketStates) {
            if (shortcode.includes(symbol)) return symbol;
        }
        return null;
    }

    private send(obj: Record<string, unknown>) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ ...obj, req_id: this.req_id++ }));
        }
    }

    private placeTradeForMarket(symbol: string) {
        const state = this.marketStates.get(symbol);
        if (!state || !this.running || state.stopped) return;

        const stake = Number(state.currentStake);
        if (!stake || stake <= 0) {
            this.onError?.(`Invalid stake for ${symbol}: ${state.currentStake}`);
            return;
        }
        console.log(`[Bot] Placing DIGITDIFF on ${symbol} | stake: $${stake} | digit: ${state.market.targetDigit}`);

        this.pendingBuyReqIds.set(this.req_id, symbol);
        this.send({
            buy: 1,
            price: stake,
            parameters: {
                amount: stake,
                basis: 'stake',
                contract_type: 'DIGITDIFF',
                currency: this.accountCurrency,
                duration: 1,
                duration_unit: 't',
                symbol,
                barrier: String(state.market.targetDigit),
            },
        });
    }

    executeAllMarketsSimultaneously(
        markets: Market[],
        _mode: string,
        _globalTargetDigit?: number
    ): Promise<TradeResult[]> {
        this.running = true;
        this.reconnectAttempts = 0;
        this.marketStates.clear();

        for (const market of markets) {
            const perMarketStake = Number(market.stake);
            console.log(`[Bot] Configuring market ${market.symbol} | stake: $${perMarketStake}`);
            this.marketStates.set(market.symbol, {
                market,
                currentStake: perMarketStake,
                martingaleLevel: 0,
                cumulativeProfit: 0,
                stopped: false,
                tradeCount: 0,
            });
        }

        for (const symbol of this.marketStates.keys()) {
            this.placeTradeForMarket(symbol);
        }

        const initialResults: TradeResult[] = markets.map(m => ({
            contractId: `pending-${m.symbol}`,
            marketSymbol: m.symbol,
            marketName: m.name,
            targetDigit: m.targetDigit,
            stake: m.stake,
            status: 'pending' as const,
            currentProfit: 0,
            martingaleLevel: 0,
            startTime: Date.now(),
        }));

        return Promise.resolve(initialResults);
    }

    stopAllMarkets(): Promise<void> {
        this.running = false;
        for (const state of this.marketStates.values()) {
            state.stopped = true;
        }
        this.ourContractIds.clear();
        this.pendingBuyReqIds.clear();
        return Promise.resolve();
    }

    disconnect() {
        this.running = false;
        this.ourContractIds.clear();
        this.pendingBuyReqIds.clear();
        this.ws?.close();
        this.ws = null;
        this.isAuthorized = false;
    }

    isConnectedToApi(): boolean {
        return this.isAuthorized;
    }
}
