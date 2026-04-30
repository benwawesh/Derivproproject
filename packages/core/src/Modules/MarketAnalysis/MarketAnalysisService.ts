/**
 * MarketAnalysisService
 * Real-time multi-market analysis: digits (over/under, even/odd, matches/differs),
 * rise/fall, higher/lower. Supports dynamic tick windows, entry/exit tracking,
 * and RSI/SMA technical indicators derived from ticks_history.
 */

export type ContractType = 'digits' | 'rise_fall' | 'higher_lower';
export type DigitSubType = 'over_under' | 'even_odd' | 'matches_differs';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'analyzing';
export type Trend = 'bullish' | 'bearish' | 'neutral';
export type Confidence = 'High' | 'Medium' | 'Low';

export interface DigitStats {
    counts: number[]; // index = digit 0-9
    percentages: number[]; // index = digit 0-9
    total: number;
    overPercentage: number; // digits 5-9
    underPercentage: number; // digits 0-4
    evenPercentage: number; // digits 0,2,4,6,8
    oddPercentage: number; // digits 1,3,5,7,9
    mostFrequent: { digit: number; count: number; percentage: number };
    leastFrequent: { digit: number; count: number; percentage: number };
}

export interface DirectionStats {
    upCount: number;
    downCount: number;
    flatCount: number;
    total: number;
    upPercentage: number;
    downPercentage: number;
}

export interface WindowAnalysis {
    tickCount: number;
    digitStats: DigitStats;
    directionStats: DirectionStats;
    score: number; // 0-100 normalised
    signalLabel: string; // e.g. "Matches 7", "Over 4", "Rise"
    entrySpot: number | null;
    exitSpot: number | null;
}

export interface EntryExitRecord {
    windowTicks: number;
    entrySpot: number;
    exitSpot: number;
    entryDigit: number;
    exitDigit: number;
    priceChange: number;
    priceChangePercent: number;
    direction: 'up' | 'down' | 'flat';
    timestamp: number;
}

export interface TechnicalAnalysis {
    rsi14: number | null;
    sma10: number | null;
    sma20: number | null;
    trend: Trend;
    volatility: number | null;
}

export interface MarketResult {
    symbol: string;
    name: string;
    currentPrice: number;
    windows: WindowAnalysis[];
    entryExitHistory: EntryExitRecord[];
    overallScore: number;
    bestSignal: string;
    confidence: Confidence;
    technical: TechnicalAnalysis;
    rank: number;
}

export interface BestMarket {
    symbol: string;
    name: string;
    signal: string;
    score: number;
    confidence: Confidence;
    entrySpot: number;
    reason: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface WindowEntry {
    entrySpot: number;
    entryTickIndex: number;
}

interface InternalMarketData {
    symbol: string;
    currentPrice: number;
    prevPrice: number | null;
    priceBuffer: number[];
    directionBuffer: ('up' | 'down' | 'flat')[];
    tickIndex: number;
    windowEntries: Map<number, WindowEntry>;
    entryExitHistory: EntryExitRecord[];
}

// ─── Market list ──────────────────────────────────────────────────────────────

export const ALL_MARKETS = [
    { symbol: 'R_10', name: 'Volatility 10' },
    { symbol: 'R_25', name: 'Volatility 25' },
    { symbol: 'R_50', name: 'Volatility 50' },
    { symbol: 'R_75', name: 'Volatility 75' },
    { symbol: 'R_100', name: 'Volatility 100' },
    { symbol: '1HZ10V', name: 'Volatility 10 (1s)' },
    { symbol: '1HZ25V', name: 'Volatility 25 (1s)' },
    { symbol: '1HZ50V', name: 'Volatility 50 (1s)' },
    { symbol: '1HZ75V', name: 'Volatility 75 (1s)' },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s)' },
];

const MARKET_NAME_MAP = new Map(ALL_MARKETS.map(m => [m.symbol, m.name]));

// ─── Service ──────────────────────────────────────────────────────────────────

export class MarketAnalysisService {
    private ws: WebSocket | null = null;
    private token: string;
    private appId: string;
    private isConnected = false;
    private markets: Map<string, InternalMarketData> = new Map();
    private tickWindows: number[] = [10, 50, 100, 500];
    private contractType: ContractType = 'digits';
    private digitSubType: DigitSubType = 'matches_differs';
    private maxBuffer = 5000;
    private activeSymbols: string[] = [];

    private onUpdateCallback?: (results: MarketResult[], best: BestMarket | null) => void;
    private onStatusCallback?: (status: ConnectionStatus, message?: string) => void;

    constructor(token: string) {
        this.token = token;
        this.appId = window.localStorage.getItem('config.app_id') || '36300';
    }

    // ── Public configuration ─────────────────────────────────────────────────

    setContractType(type: ContractType, subType?: DigitSubType) {
        this.contractType = type;
        if (subType) this.digitSubType = subType;
        this.broadcastUpdate();
    }

    setDigitSubType(subType: DigitSubType) {
        this.digitSubType = subType;
        this.broadcastUpdate();
    }

    setTickWindows(windows: number[]) {
        this.tickWindows = [...windows].sort((a, b) => a - b);
        if (this.isConnected) {
            const maxWindow = Math.max(...this.tickWindows);
            this.activeSymbols.forEach(symbol => {
                const data = this.markets.get(symbol);
                if (data && data.priceBuffer.length < maxWindow) {
                    this.fetchHistory(symbol, maxWindow);
                }
            });
        }
        this.broadcastUpdate();
    }

    setUpdateCallback(cb: (results: MarketResult[], best: BestMarket | null) => void) {
        this.onUpdateCallback = cb;
    }

    setStatusCallback(cb: (status: ConnectionStatus, message?: string) => void) {
        this.onStatusCallback = cb;
    }

    // ── Connection ───────────────────────────────────────────────────────────

    async connect(symbols: string[]): Promise<boolean> {
        this.activeSymbols = symbols;
        this.markets.clear();

        symbols.forEach(symbol => {
            this.markets.set(symbol, {
                symbol,
                currentPrice: 0,
                prevPrice: null,
                priceBuffer: [],
                directionBuffer: [],
                tickIndex: 0,
                windowEntries: new Map(),
                entryExitHistory: [],
            });
        });

        this.onStatusCallback?.('connecting', 'Connecting to Deriv API...');

        return new Promise(resolve => {
            let resolved = false;
            const done = (v: boolean) => {
                if (!resolved) {
                    resolved = true;
                    resolve(v);
                }
            };

            try {
                this.ws?.close();
                this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);

                this.ws.onopen = () => {
                    this.onStatusCallback?.('connecting', 'Authorizing...');
                    this.send({ authorize: this.token });
                };

                this.ws.onmessage = e => {
                    try {
                        this.handleMessage(JSON.parse(e.data), done);
                    } catch {
                        /* skip */
                    }
                };

                this.ws.onerror = () => {
                    this.isConnected = false;
                    this.onStatusCallback?.('disconnected', 'Connection error');
                    done(false);
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.onStatusCallback?.('disconnected', 'Disconnected');
                };
            } catch (err: any) {
                this.onStatusCallback?.('disconnected', `Failed: ${err.message}`);
                done(false);
            }
        });
    }

    disconnect() {
        this.isConnected = false;
        this.ws?.close();
        this.ws = null;
        this.markets.clear();
    }

    // ── Message handling ─────────────────────────────────────────────────────

    private handleMessage(msg: any, done?: (v: boolean) => void) {
        switch (msg.msg_type) {
            case 'authorize':
                if (msg.error) {
                    this.onStatusCallback?.('disconnected', `Auth failed: ${msg.error.message}`);
                    done?.(false);
                    return;
                }
                this.isConnected = true;
                this.onStatusCallback?.('connecting', 'Loading tick history...');
                const maxW = Math.max(...this.tickWindows, 500);
                this.activeSymbols.forEach(sym => {
                    this.fetchHistory(sym, maxW);
                    this.send({ ticks: sym, subscribe: 1 });
                });
                this.onStatusCallback?.('analyzing', `Analyzing ${this.activeSymbols.length} markets...`);
                done?.(true);
                break;

            case 'history': {
                const symbol: string = msg.echo_req?.ticks_history;
                const prices: number[] = (msg.history?.prices ?? []).map(Number);
                if (!symbol || !this.markets.has(symbol) || prices.length === 0) break;

                const data = this.markets.get(symbol)!;
                data.priceBuffer = prices.slice(-this.maxBuffer);
                data.directionBuffer = [];
                for (let i = 1; i < data.priceBuffer.length; i++) {
                    const diff = data.priceBuffer[i] - data.priceBuffer[i - 1];
                    data.directionBuffer.push(diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');
                }
                data.currentPrice = prices[prices.length - 1];
                data.prevPrice = prices.length > 1 ? prices[prices.length - 2] : null;
                this.broadcastUpdate();
                break;
            }

            case 'tick':
                if (msg.tick) this.handleTick(msg.tick);
                break;

            case 'error':
                console.error('[MarketAnalysis]', msg.error?.message);
                break;
        }
    }

    private handleTick(tick: any) {
        const symbol: string = tick.symbol;
        const quote = Number(tick.quote);
        if (!symbol || isNaN(quote) || !this.markets.has(symbol)) return;

        const data = this.markets.get(symbol)!;

        const direction: 'up' | 'down' | 'flat' =
            data.prevPrice === null ? 'flat' : quote > data.prevPrice ? 'up' : quote < data.prevPrice ? 'down' : 'flat';

        data.prevPrice = data.currentPrice || null;
        data.currentPrice = quote;
        data.priceBuffer.push(quote);
        data.directionBuffer.push(direction);

        if (data.priceBuffer.length > this.maxBuffer) {
            data.priceBuffer.shift();
            data.directionBuffer.shift();
        }

        data.tickIndex++;

        // Per-window entry/exit tracking
        this.tickWindows.forEach(w => {
            const entry = data.windowEntries.get(w);
            if (!entry) {
                data.windowEntries.set(w, { entrySpot: quote, entryTickIndex: data.tickIndex });
                return;
            }
            const elapsed = data.tickIndex - entry.entryTickIndex;
            if (elapsed >= w) {
                // Record completed cycle
                const entryDigit = parseInt(entry.entrySpot.toString().slice(-1));
                const exitDigit = parseInt(quote.toString().slice(-1));
                const priceChange = quote - entry.entrySpot;
                data.entryExitHistory.unshift({
                    windowTicks: w,
                    entrySpot: entry.entrySpot,
                    exitSpot: quote,
                    entryDigit,
                    exitDigit,
                    priceChange,
                    priceChangePercent: (priceChange / entry.entrySpot) * 100,
                    direction: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'flat',
                    timestamp: Date.now(),
                });
                if (data.entryExitHistory.length > 50) data.entryExitHistory.pop();
                // Start new cycle
                data.windowEntries.set(w, { entrySpot: quote, entryTickIndex: data.tickIndex });
            }
        });

        this.broadcastUpdate();
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    private computeDigitStats(prices: number[]): DigitStats {
        const counts = new Array(10).fill(0);
        prices.forEach(p => {
            counts[parseInt(p.toString().slice(-1))]++;
        });
        const total = prices.length;
        const percentages = counts.map(c => (total > 0 ? (c / total) * 100 : 0));

        const overCount = counts.slice(5).reduce((s, c) => s + c, 0);
        const underCount = counts.slice(0, 5).reduce((s, c) => s + c, 0);
        const evenCount = [0, 2, 4, 6, 8].reduce((s, d) => s + counts[d], 0);
        const oddCount = [1, 3, 5, 7, 9].reduce((s, d) => s + counts[d], 0);

        let mostIdx = 0,
            leastIdx = 0;
        counts.forEach((c, i) => {
            if (c > counts[mostIdx]) mostIdx = i;
            if (c < counts[leastIdx]) leastIdx = i;
        });

        return {
            counts,
            percentages,
            total,
            overPercentage: total > 0 ? (overCount / total) * 100 : 0,
            underPercentage: total > 0 ? (underCount / total) * 100 : 0,
            evenPercentage: total > 0 ? (evenCount / total) * 100 : 0,
            oddPercentage: total > 0 ? (oddCount / total) * 100 : 0,
            mostFrequent: { digit: mostIdx, count: counts[mostIdx], percentage: percentages[mostIdx] },
            leastFrequent: { digit: leastIdx, count: counts[leastIdx], percentage: percentages[leastIdx] },
        };
    }

    private computeDirectionStats(directions: ('up' | 'down' | 'flat')[]): DirectionStats {
        const upCount = directions.filter(d => d === 'up').length;
        const downCount = directions.filter(d => d === 'down').length;
        const flatCount = directions.filter(d => d === 'flat').length;
        const total = directions.length;
        return {
            upCount,
            downCount,
            flatCount,
            total,
            upPercentage: total > 0 ? (upCount / total) * 100 : 0,
            downPercentage: total > 0 ? (downCount / total) * 100 : 0,
        };
    }

    private computeScore(ds: DigitStats, dir: DirectionStats): { score: number; signal: string } {
        if (this.contractType === 'digits') {
            if (this.digitSubType === 'over_under') {
                const dominant = Math.max(ds.overPercentage, ds.underPercentage);
                return {
                    score: Math.max(0, Math.min(100, (dominant - 50) * 2)),
                    signal: ds.overPercentage >= ds.underPercentage ? 'Over 4' : 'Under 5',
                };
            }
            if (this.digitSubType === 'even_odd') {
                const dominant = Math.max(ds.evenPercentage, ds.oddPercentage);
                return {
                    score: Math.max(0, Math.min(100, (dominant - 50) * 2)),
                    signal: ds.evenPercentage >= ds.oddPercentage ? 'Even' : 'Odd',
                };
            }
            // matches_differs
            const matchScore = Math.max(0, Math.min(100, ((ds.mostFrequent.percentage - 10) / 90) * 100));
            const differScore = Math.max(0, Math.min(100, ((10 - ds.leastFrequent.percentage) / 10) * 100));
            if (matchScore >= differScore) {
                return { score: matchScore, signal: `Matches ${ds.mostFrequent.digit}` };
            }
            return { score: differScore, signal: `Differs ${ds.leastFrequent.digit}` };
        }

        // Rise/Fall and Higher/Lower
        const dominant = Math.max(dir.upPercentage, dir.downPercentage);
        const score = Math.max(0, Math.min(100, (dominant - 50) * 2));
        if (this.contractType === 'rise_fall') {
            return { score, signal: dir.upPercentage >= dir.downPercentage ? 'Rise' : 'Fall' };
        }
        return { score, signal: dir.upPercentage >= dir.downPercentage ? 'Higher' : 'Lower' };
    }

    private computeTechnical(prices: number[]): TechnicalAnalysis {
        const rsi14 = this.calcRSI(prices, 14);
        const sma10 = this.calcSMA(prices, 10);
        const sma20 = this.calcSMA(prices, 20);
        const volatility = this.calcVolatility(prices, 20);

        let trend: Trend = 'neutral';
        if (sma10 !== null && sma20 !== null) {
            if (sma10 > sma20 * 1.0005) trend = 'bullish';
            else if (sma10 < sma20 * 0.9995) trend = 'bearish';
        }
        return { rsi14, sma10, sma20, volatility, trend };
    }

    private calcRSI(prices: number[], period: number): number | null {
        if (prices.length < period + 1) return null;
        const slice = prices.slice(-(period + 1));
        let gains = 0,
            losses = 0;
        for (let i = 1; i < slice.length; i++) {
            const d = slice[i] - slice[i - 1];
            if (d > 0) gains += d;
            else losses -= d;
        }
        const avgG = gains / period;
        const avgL = losses / period;
        if (avgL === 0) return 100;
        return 100 - 100 / (1 + avgG / avgL);
    }

    private calcSMA(prices: number[], period: number): number | null {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        return slice.reduce((s, p) => s + p, 0) / period;
    }

    private calcVolatility(prices: number[], period: number): number | null {
        if (prices.length < period) return null;
        const slice = prices.slice(-period);
        const mean = slice.reduce((s, p) => s + p, 0) / period;
        const variance = slice.reduce((s, p) => s + (p - mean) ** 2, 0) / period;
        return Math.sqrt(variance);
    }

    // ── Broadcast ────────────────────────────────────────────────────────────

    private broadcastUpdate() {
        const results: MarketResult[] = [];

        this.markets.forEach((data, symbol) => {
            if (data.priceBuffer.length === 0) return;

            const windows: WindowAnalysis[] = this.tickWindows.map(w => {
                const prices = data.priceBuffer.slice(-w);
                const dirs = data.directionBuffer.slice(-w);
                const ds = this.computeDigitStats(prices);
                const dir = this.computeDirectionStats(dirs);
                const { score, signal } = this.computeScore(ds, dir);
                const entry = data.windowEntries.get(w);
                return {
                    tickCount: w,
                    digitStats: ds,
                    directionStats: dir,
                    score,
                    signalLabel: signal,
                    entrySpot: entry?.entrySpot ?? null,
                    exitSpot: data.currentPrice,
                };
            });

            // Weighted score — larger windows count more
            const totalWeight = windows.reduce((s, w) => s + w.tickCount, 0);
            const overallScore =
                totalWeight > 0 ? windows.reduce((s, w) => s + w.score * w.tickCount, 0) / totalWeight : 0;

            const largestW = windows[windows.length - 1] ?? windows[0];
            const confidence: Confidence = overallScore >= 60 ? 'High' : overallScore >= 30 ? 'Medium' : 'Low';

            results.push({
                symbol,
                name: MARKET_NAME_MAP.get(symbol) ?? symbol,
                currentPrice: data.currentPrice,
                windows,
                entryExitHistory: data.entryExitHistory,
                overallScore,
                bestSignal: largestW.signalLabel,
                confidence,
                technical: this.computeTechnical(data.priceBuffer),
                rank: 0,
            });
        });

        results.sort((a, b) => b.overallScore - a.overallScore);
        results.forEach((r, i) => {
            r.rank = i + 1;
        });

        let best: BestMarket | null = null;
        if (results.length > 0) {
            const top = results[0];
            const lw = top.windows[top.windows.length - 1] ?? top.windows[0];
            best = {
                symbol: top.symbol,
                name: top.name,
                signal: top.bestSignal,
                score: top.overallScore,
                confidence: top.confidence,
                entrySpot: top.currentPrice,
                reason: this.buildReason(top, lw),
            };
        }

        this.onUpdateCallback?.(results, best);
    }

    private buildReason(result: MarketResult, lw: WindowAnalysis): string {
        const parts: string[] = [];
        const ds = lw.digitStats;
        const dir = lw.directionStats;

        if (this.contractType === 'digits') {
            if (this.digitSubType === 'over_under') {
                parts.push(`${ds.overPercentage.toFixed(1)}% Over / ${ds.underPercentage.toFixed(1)}% Under`);
            } else if (this.digitSubType === 'even_odd') {
                parts.push(`${ds.evenPercentage.toFixed(1)}% Even / ${ds.oddPercentage.toFixed(1)}% Odd`);
            } else {
                parts.push(
                    `Digit ${ds.mostFrequent.digit} at ${ds.mostFrequent.percentage.toFixed(1)}% · ` +
                        `Digit ${ds.leastFrequent.digit} least at ${ds.leastFrequent.percentage.toFixed(1)}%`
                );
            }
        } else {
            parts.push(`${dir.upPercentage.toFixed(1)}% Up / ${dir.downPercentage.toFixed(1)}% Down`);
        }

        parts.push(`in last ${lw.tickCount} ticks`);
        const t = result.technical;
        if (t.rsi14 !== null) parts.push(`RSI ${t.rsi14.toFixed(1)}`);
        if (t.trend !== 'neutral') parts.push(`Trend: ${t.trend}`);
        return parts.join(' · ');
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fetchHistory(symbol: string, count: number) {
        this.send({
            ticks_history: symbol,
            adjust_start_time: 1,
            count: Math.min(count, 5000),
            end: 'latest',
            style: 'ticks',
        });
    }

    private send(obj: Record<string, unknown>) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }
}
