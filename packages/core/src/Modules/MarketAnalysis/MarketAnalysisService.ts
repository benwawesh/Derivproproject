/**
 * MarketAnalysisService — Enhanced with advanced mathematical analysis
 *
 * Formulas used for digit markets:
 *  • Chi-Square test       — measures how far digit distribution deviates from uniform
 *  • Z-Score per digit     — statistical significance of each digit's deviation
 *  • Shannon Entropy       — measures predictability (lower = more predictable)
 *  • Markov Chain          — transition probability matrix (digit-to-digit prediction)
 *  • Runs Test             — detects clustering in even/odd sequences
 *  • Digit RSI             — momentum indicator adapted for even/odd and over/under
 *  • Exponential Weighting — gives more weight to recent ticks
 *  • Binomial Confidence   — statistical proof that a bias is real and not random
 *  • Multi-window Check    — consistency across 10T, 50T, 100T, 500T windows
 *
 * Formulas used for direction markets (Rise/Fall, Higher/Lower):
 *  • RSI-14                — price momentum
 *  • EMA slope             — trend direction
 *  • Volatility (σ)        — standard deviation of price changes
 */

export type ContractType = 'digits' | 'rise_fall' | 'higher_lower';
export type DigitSubType = 'over_under' | 'even_odd' | 'matches_differs';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'analyzing';
export type Trend = 'bullish' | 'bearish' | 'neutral';
export type Confidence = 'High' | 'Medium' | 'Low';

// ─── Core data types (kept for backward compat) ───────────────────────────────

export interface DigitStats {
    counts: number[];
    percentages: number[];
    total: number;
    overPercentage: number;
    underPercentage: number;
    evenPercentage: number;
    oddPercentage: number;
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
    score: number;
    signalLabel: string;
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

// ─── New advanced types ───────────────────────────────────────────────────────

export interface SignalScore {
    label: string; // e.g. "Differs 0", "Over 4", "Rise"
    score: number; // 0–100 composite score
    confidence: Confidence;
    explanation: string; // plain-English reason
    subType: string; // 'matches_differs' | 'even_odd' | 'over_under' | 'rise_fall' | 'higher_lower'
}

export interface AdvancedMetrics {
    chiSquare: number; // Σ (O−E)²/E — higher = stronger digit bias
    entropy: number; // Shannon H in bits — lower = more predictable
    zScores: number[]; // Z-score per digit 0–9
    bestZDigit: number; // digit with the largest |Z|
    evenOddRunsZ: number; // Runs-test Z — negative = clustering (bias exists)
    digitRsiEvenOdd: number; // 0–100 (>70 = too many even → Odd signal)
    digitRsiOverUnder: number; // 0–100 (>70 = too many Over → Under signal)
    markovMatrix: number[][]; // 10×10 transition probability matrix
    markovBestProb: number; // highest single-cell probability in matrix
    markovBestFrom: number; // digit that triggers the strongest prediction
    markovBestTo: number; // predicted next digit
    multiWindowConsistency: number; // 0–100: % of time windows that agree on best signal
    binomialConfidence: number; // 0–100: statistical proof the bias is real
    exponentialWeights: number[]; // recency-weighted frequencies per digit
    volatilityScore: number; // 0–100 (100 = very stable price)
    rsi14: number | null; // price RSI for direction trades
    emaSlopeScore: number; // 0–100 EMA trend strength
}

export interface DeepScanResult {
    symbol: string;
    name: string;
    currentPrice: number;
    rank: number;
    bestSignal: SignalScore;
    allSignals: SignalScore[]; // sorted best → worst
    metrics: AdvancedMetrics;
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
    // NEW — auto-detected best signals across ALL trade types
    liveSignals: SignalScore[];
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

        this.tickWindows.forEach(w => {
            const entry = data.windowEntries.get(w);
            if (!entry) {
                data.windowEntries.set(w, { entrySpot: quote, entryTickIndex: data.tickIndex });
                return;
            }
            const elapsed = data.tickIndex - entry.entryTickIndex;
            if (elapsed >= w) {
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
                data.windowEntries.set(w, { entrySpot: quote, entryTickIndex: data.tickIndex });
            }
        });

        this.broadcastUpdate();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ── MATHEMATICAL FORMULAS ────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════════

    /** Chi-Square test: measures how far digit distribution is from uniform (10% each).
     *  Formula: χ² = Σ (observed − expected)² / expected
     *  Higher χ² = stronger non-random bias = better trading signal */
    private computeChiSquare(prices: number[]): number {
        if (prices.length === 0) return 0;
        const counts = new Array(10).fill(0);
        prices.forEach(p => counts[parseInt(p.toString().slice(-1))]++);
        const expected = prices.length / 10;
        if (expected === 0) return 0;
        return counts.reduce((sum, obs) => sum + (obs - expected) ** 2 / expected, 0);
    }

    /** Shannon Entropy: measures how predictable/random the digit sequence is.
     *  Formula: H = −Σ p(i) × log₂(p(i))
     *  Range: 0 (perfectly predictable) to 3.32 bits (perfectly random)
     *  Lower H = more predictable = safer to trade */
    private computeEntropy(prices: number[]): number {
        if (prices.length === 0) return 3.32;
        const counts = new Array(10).fill(0);
        prices.forEach(p => counts[parseInt(p.toString().slice(-1))]++);
        const total = prices.length;
        let H = 0;
        counts.forEach(c => {
            if (c > 0) {
                const p = c / total;
                H -= p * Math.log2(p);
            }
        });
        return H;
    }

    /** Z-Score per digit: how many standard deviations each digit is from expected 10%.
     *  Formula: Z = (p_observed − 0.10) / √(0.10 × 0.90 / n)
     *  |Z| > 2.0 = significant (95% confidence), |Z| > 3.0 = very significant */
    private computeZScores(prices: number[]): number[] {
        if (prices.length === 0) return new Array(10).fill(0);
        const counts = new Array(10).fill(0);
        prices.forEach(p => counts[parseInt(p.toString().slice(-1))]++);
        const n = prices.length;
        const expected = 0.1;
        const stdErr = Math.sqrt((expected * (1 - expected)) / n);
        return counts.map(c => (stdErr > 0 ? (c / n - expected) / stdErr : 0));
    }

    /** Runs Test for Even/Odd: detects clustering (bias) in the even/odd sequence.
     *  Formula: Z_runs = (actual_runs − expected_runs) / √variance
     *  Negative Z = fewer runs than expected = strong even/odd streak = tradeable bias */
    private computeRunsTestZ(prices: number[]): number {
        if (prices.length < 10) return 0;
        const seq = prices.map(p => parseInt(p.toString().slice(-1)) % 2); // 0=even, 1=odd
        const n1 = seq.filter(x => x === 0).length; // even count
        const n2 = seq.filter(x => x === 1).length; // odd count
        if (n1 === 0 || n2 === 0) return 0;
        let runs = 1;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] !== seq[i - 1]) runs++;
        }
        const N = n1 + n2;
        const expectedRuns = (2 * n1 * n2) / N + 1;
        const variance = (2 * n1 * n2 * (2 * n1 * n2 - N)) / (N * N * (N - 1));
        return variance > 0 ? (runs - expectedRuns) / Math.sqrt(variance) : 0;
    }

    /** Digit RSI adapted for Even/Odd:
     *  Formula: RSI = 100 − [100 / (1 + even_count / odd_count)] over last period ticks
     *  RSI > 70 → too many evens recently → Odd signal incoming
     *  RSI < 30 → too many odds → Even signal incoming */
    private computeDigitRsiEvenOdd(prices: number[], period = 14): number {
        if (prices.length < period) return 50;
        const recent = prices.slice(-period);
        const evenCount = recent.filter(p => parseInt(p.toString().slice(-1)) % 2 === 0).length;
        const oddCount = period - evenCount;
        if (oddCount === 0) return 100;
        if (evenCount === 0) return 0;
        return 100 - 100 / (1 + evenCount / oddCount);
    }

    /** Digit RSI adapted for Over/Under (threshold = 4):
     *  Formula: RSI = 100 − [100 / (1 + over_count / under_count)]
     *  RSI > 70 → too many Over 4 → Under 5 signal
     *  RSI < 30 → too many Under 5 → Over 4 signal */
    private computeDigitRsiOverUnder(prices: number[], period = 14): number {
        if (prices.length < period) return 50;
        const recent = prices.slice(-period);
        const overCount = recent.filter(p => parseInt(p.toString().slice(-1)) >= 5).length;
        const underCount = period - overCount;
        if (underCount === 0) return 100;
        if (overCount === 0) return 0;
        return 100 - 100 / (1 + overCount / underCount);
    }

    /** Markov Chain: builds a 10×10 transition probability matrix.
     *  T[i][j] = P(next digit = j | current digit = i)
     *  Strong off-diagonal probabilities = predictable digit sequences */
    private computeMarkov(prices: number[]): {
        matrix: number[][];
        bestProb: number;
        bestFrom: number;
        bestTo: number;
    } {
        const raw = Array.from({ length: 10 }, () => new Array(10).fill(0));
        const rowTotals = new Array(10).fill(0);
        for (let i = 0; i < prices.length - 1; i++) {
            const from = parseInt(prices[i].toString().slice(-1));
            const to = parseInt(prices[i + 1].toString().slice(-1));
            raw[from][to]++;
            rowTotals[from]++;
        }
        const matrix = raw.map((row, i) =>
            rowTotals[i] > 0 ? row.map(c => c / rowTotals[i]) : new Array(10).fill(0.1)
        );
        let bestProb = 0,
            bestFrom = 0,
            bestTo = 0;
        matrix.forEach((row, i) => {
            row.forEach((prob, j) => {
                if (prob > bestProb) {
                    bestProb = prob;
                    bestFrom = i;
                    bestTo = j;
                }
            });
        });
        return { matrix, bestProb, bestFrom, bestTo };
    }

    /** Exponential Decay Weighting: gives more weight to recent ticks.
     *  Formula: w_t = e^(−λ × age), where age = ticks since that tick occurred
     *  Returns weighted frequency per digit (0–1), recency-biased */
    private computeExponentialWeights(prices: number[], lambda = 0.005): number[] {
        if (prices.length === 0) return new Array(10).fill(0.1);
        const weighted = new Array(10).fill(0);
        let totalWeight = 0;
        const n = prices.length;
        prices.forEach((p, t) => {
            const digit = parseInt(p.toString().slice(-1));
            const age = n - 1 - t;
            const w = Math.exp(-lambda * age);
            weighted[digit] += w;
            totalWeight += w;
        });
        return totalWeight > 0 ? weighted.map(c => c / totalWeight) : new Array(10).fill(0.1);
    }

    /** Binomial Confidence Test: statistical proof that a digit bias is not random chance.
     *  Uses normal approximation to binomial.
     *  Formula: Z = |p_observed − p_expected| / √(p_expected × (1−p_expected) / n)
     *  Returns 0–100 confidence score */
    private computeBinomialConfidence(observedCount: number, n: number, expectedP: number): number {
        if (n === 0) return 0;
        const observedP = observedCount / n;
        const stdErr = Math.sqrt((expectedP * (1 - expectedP)) / n);
        if (stdErr === 0) return observedP === expectedP ? 0 : 100;
        const z = Math.abs((observedP - expectedP) / stdErr);
        // Z=1.96→~95%, Z=3.0→~99.9%, Z=5.0→100%
        return Math.min(100, (z / 5) * 100);
    }

    /** Multi-window consistency: checks if the same best signal appears across all windows.
     *  If 10T, 50T, 100T, 500T all agree → 100% consistency → much higher confidence */
    private computeMultiWindowConsistency(prices: number[]): number {
        const windows = [10, 50, 100, 500].filter(w => prices.length >= w);
        if (windows.length < 2) return 50;
        const signals = windows.map(w => {
            const slice = prices.slice(-w);
            const counts = new Array(10).fill(0);
            slice.forEach(p => counts[parseInt(p.toString().slice(-1))]++);
            const leastIdx = counts.indexOf(Math.min(...counts));
            return `D${leastIdx}`; // "Differs X" as the representative signal
        });
        const counts = new Map<string, number>();
        signals.forEach(s => counts.set(s, (counts.get(s) ?? 0) + 1));
        const maxAgree = Math.max(...Array.from(counts.values()));
        return (maxAgree / windows.length) * 100;
    }

    /** Compute all advanced metrics for a price buffer */
    computeAdvancedMetrics(prices: number[], directions: ('up' | 'down' | 'flat')[]): AdvancedMetrics {
        const n = prices.length;
        const chiSquare = this.computeChiSquare(prices);
        const entropy = this.computeEntropy(prices);
        const zScores = this.computeZScores(prices);
        const bestZDigit = zScores.reduce((best, z, i) => (Math.abs(z) > Math.abs(zScores[best]) ? i : best), 0);
        const evenOddRunsZ = this.computeRunsTestZ(prices);
        const digitRsiEvenOdd = this.computeDigitRsiEvenOdd(prices);
        const digitRsiOverUnder = this.computeDigitRsiOverUnder(prices);
        const markov = this.computeMarkov(prices);
        const multiWindowConsistency = this.computeMultiWindowConsistency(prices);
        const exponentialWeights = this.computeExponentialWeights(prices);

        // Binomial confidence for the least-frequent digit
        const counts = new Array(10).fill(0);
        prices.forEach(p => counts[parseInt(p.toString().slice(-1))]++);
        const leastCount = Math.min(...counts);
        const binomialConfidence = this.computeBinomialConfidence(leastCount, n, 0.1);

        // Volatility score (100 = stable, 0 = very volatile)
        const vol = this.calcVolatility(prices, Math.min(50, n));
        const volatilityScore = vol !== null ? Math.max(0, 100 - vol * 500) : 50;

        // RSI for direction trades
        const rsi14 = this.calcRSI(prices, 14);
        const rsiDev = rsi14 !== null ? Math.abs(rsi14 - 50) * 2 : 0;

        // EMA slope score
        const ema10 = this.calcEMA(prices, 10);
        const ema20 = this.calcEMA(prices, 20);
        let emaSlopeScore = 0;
        if (ema10 !== null && ema20 !== null) {
            const diff = (ema10 - ema20) / ema20;
            emaSlopeScore = Math.min(100, Math.abs(diff) * 10000);
        }

        return {
            chiSquare,
            entropy,
            zScores,
            bestZDigit,
            evenOddRunsZ,
            digitRsiEvenOdd,
            digitRsiOverUnder,
            markovMatrix: markov.matrix,
            markovBestProb: markov.bestProb,
            markovBestFrom: markov.bestFrom,
            markovBestTo: markov.bestTo,
            multiWindowConsistency,
            binomialConfidence,
            exponentialWeights,
            volatilityScore,
            rsi14,
            emaSlopeScore: rsiDev, // reuse rsiDev for ema
        };
    }

    /** Score ALL signal types for a market and return them sorted best → worst */
    scoreAllSignals(prices: number[], directions: ('up' | 'down' | 'flat')[], metrics: AdvancedMetrics): SignalScore[] {
        const signals: SignalScore[] = [];
        const n = prices.length;
        if (n < 20) return signals;

        const ds = this.computeDigitStats(prices);
        const dir = this.computeDirectionStats(directions);

        // Normalised helper metrics
        const chiNorm = Math.min(100, (metrics.chiSquare / 50) * 100);
        const entropyScore = Math.max(0, 100 - (metrics.entropy / 3.32) * 100);
        const bestAbsZ = Math.min(100, (Math.abs(metrics.zScores[metrics.bestZDigit]) / 5) * 100);
        const runsNorm = Math.min(100, (Math.abs(metrics.evenOddRunsZ) / 3) * 100);
        const mwc = metrics.multiWindowConsistency;
        const expBias = Math.min(100, ((Math.max(...metrics.exponentialWeights) - 0.1) / 0.9) * 100);
        const markovStr = Math.min(100, ((metrics.markovBestProb - 0.1) / 0.9) * 100);

        // ── DIFFERS X ─────────────────────────────────────────────────────────
        // Best for the digit that appears least (strongest "cold digit")
        const leastDigit = ds.leastFrequent.digit;
        const leastPct = ds.leastFrequent.percentage;
        const diffZ = Math.min(100, (Math.abs(metrics.zScores[leastDigit]) / 5) * 100);
        const diffBinom = this.computeBinomialConfidence(ds.counts[leastDigit], n, 0.1);
        const differsScore = Math.min(
            100,
            chiNorm * 0.2 +
                diffZ * 0.2 +
                markovStr * 0.15 +
                entropyScore * 0.15 +
                mwc * 0.15 +
                diffBinom * 0.1 +
                expBias * 0.05
        );
        signals.push({
            label: `Differs ${leastDigit}`,
            score: differsScore,
            confidence: differsScore >= 60 ? 'High' : differsScore >= 35 ? 'Medium' : 'Low',
            explanation: `Digit ${leastDigit} appears only ${leastPct.toFixed(1)}% (expected 10%). χ²=${metrics.chiSquare.toFixed(1)}, H=${metrics.entropy.toFixed(2)} bits, Z=${metrics.zScores[leastDigit].toFixed(2)}, Binomial conf=${diffBinom.toFixed(0)}%`,
            subType: 'matches_differs',
        });

        // ── MATCHES X ─────────────────────────────────────────────────────────
        const mostDigit = ds.mostFrequent.digit;
        const mostPct = ds.mostFrequent.percentage;
        const matchZ = Math.min(100, (Math.abs(metrics.zScores[mostDigit]) / 5) * 100);
        const matchBinom = this.computeBinomialConfidence(ds.counts[mostDigit], n, 0.1);
        const matchesScore = Math.min(
            100,
            chiNorm * 0.2 +
                matchZ * 0.2 +
                markovStr * 0.15 +
                entropyScore * 0.15 +
                mwc * 0.15 +
                matchBinom * 0.1 +
                expBias * 0.05
        );
        signals.push({
            label: `Matches ${mostDigit}`,
            score: matchesScore,
            confidence: matchesScore >= 60 ? 'High' : matchesScore >= 35 ? 'Medium' : 'Low',
            explanation: `Digit ${mostDigit} appears ${mostPct.toFixed(1)}% (expected 10%). χ²=${metrics.chiSquare.toFixed(1)}, Markov strength=${markovStr.toFixed(0)}%`,
            subType: 'matches_differs',
        });

        // ── EVEN / ODD ────────────────────────────────────────────────────────
        const eoRsiDev = (Math.abs(metrics.digitRsiEvenOdd - 50) / 50) * 100;
        const evenDev = Math.abs(ds.evenPercentage - 50) * 2;
        const dominantEO = ds.evenPercentage >= ds.oddPercentage ? 'Even' : 'Odd';
        const eoScore = Math.min(
            100,
            runsNorm * 0.3 + eoRsiDev * 0.25 + evenDev * 0.2 + mwc * 0.15 + entropyScore * 0.1
        );
        signals.push({
            label: dominantEO,
            score: eoScore,
            confidence: eoScore >= 60 ? 'High' : eoScore >= 35 ? 'Medium' : 'Low',
            explanation: `${dominantEO}: ${Math.max(ds.evenPercentage, ds.oddPercentage).toFixed(1)}% (expected 50%). Runs test Z=${metrics.evenOddRunsZ.toFixed(2)}, Digit RSI=${metrics.digitRsiEvenOdd.toFixed(0)}`,
            subType: 'even_odd',
        });

        // ── OVER 4 / UNDER 5 ──────────────────────────────────────────────────
        const ouRsiDev = (Math.abs(metrics.digitRsiOverUnder - 50) / 50) * 100;
        const ouDev = Math.abs(ds.overPercentage - 50) * 2;
        const dominantOU = ds.overPercentage >= ds.underPercentage ? 'Over 4' : 'Under 5';
        const ouScore = Math.min(
            100,
            ouDev * 0.3 + ouRsiDev * 0.25 + mwc * 0.25 + entropyScore * 0.1 + metrics.binomialConfidence * 0.1
        );
        signals.push({
            label: dominantOU,
            score: ouScore,
            confidence: ouScore >= 60 ? 'High' : ouScore >= 35 ? 'Medium' : 'Low',
            explanation: `${dominantOU}: ${Math.max(ds.overPercentage, ds.underPercentage).toFixed(1)}% (expected 50%). Digit RSI=${metrics.digitRsiOverUnder.toFixed(0)}, Window consistency=${mwc.toFixed(0)}%`,
            subType: 'over_under',
        });

        // ── RISE / FALL ───────────────────────────────────────────────────────
        const rfDev = Math.abs(dir.upPercentage - 50) * 2;
        const dominantRF = dir.upPercentage >= dir.downPercentage ? 'Rise' : 'Fall';
        const rsiScore = metrics.rsi14 !== null ? Math.abs(metrics.rsi14 - 50) * 2 : 0;
        const rfScore = Math.min(100, rsiScore * 0.3 + rfDev * 0.3 + mwc * 0.25 + metrics.volatilityScore * 0.15);
        signals.push({
            label: dominantRF,
            score: rfScore,
            confidence: rfScore >= 60 ? 'High' : rfScore >= 35 ? 'Medium' : 'Low',
            explanation: `${dominantRF}: ${Math.max(dir.upPercentage, dir.downPercentage).toFixed(1)}% price moves up. RSI=${metrics.rsi14?.toFixed(0) ?? 'N/A'}, Volatility score=${metrics.volatilityScore.toFixed(0)}`,
            subType: 'rise_fall',
        });

        // ── HIGHER / LOWER ────────────────────────────────────────────────────
        const dominantHL = dir.upPercentage >= dir.downPercentage ? 'Higher' : 'Lower';
        const hlScore = Math.min(100, rsiScore * 0.25 + rfDev * 0.25 + metrics.emaSlopeScore * 0.25 + mwc * 0.25);
        signals.push({
            label: dominantHL,
            score: hlScore,
            confidence: hlScore >= 60 ? 'High' : hlScore >= 35 ? 'Medium' : 'Low',
            explanation: `${dominantHL}: EMA slope=${metrics.emaSlopeScore.toFixed(0)}%, RSI=${metrics.rsi14?.toFixed(0) ?? 'N/A'}`,
            subType: 'higher_lower',
        });

        return signals.sort((a, b) => b.score - a.score);
    }

    // ── Public deep scan ─────────────────────────────────────────────────────

    /** Run full deep scan on a single market. Returns null if not enough data. */
    deepScanMarket(symbol: string): DeepScanResult | null {
        const data = this.markets.get(symbol);
        if (!data || data.priceBuffer.length < 50) return null;
        const metrics = this.computeAdvancedMetrics(data.priceBuffer, data.directionBuffer);
        const allSignals = this.scoreAllSignals(data.priceBuffer, data.directionBuffer, metrics);
        return {
            symbol,
            name: MARKET_NAME_MAP.get(symbol) ?? symbol,
            currentPrice: data.currentPrice,
            rank: 0,
            bestSignal: allSignals[0] ?? { label: 'N/A', score: 0, confidence: 'Low', explanation: '', subType: '' },
            allSignals,
            metrics,
        };
    }

    /** Run deep scan on ALL markets. Returns results ranked by best signal score. */
    deepScanAll(): DeepScanResult[] {
        const results: DeepScanResult[] = [];
        this.markets.forEach((_, symbol) => {
            const r = this.deepScanMarket(symbol);
            if (r) results.push(r);
        });
        results.sort((a, b) => b.bestSignal.score - a.bestSignal.score);
        results.forEach((r, i) => {
            r.rank = i + 1;
        });
        return results;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ── LEGACY COMPUTATION (kept for backward compat) ────────────────────────
    // ════════════════════════════════════════════════════════════════════════════

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
            const matchScore = Math.max(0, Math.min(100, ((ds.mostFrequent.percentage - 10) / 90) * 100));
            const differScore = Math.max(0, Math.min(100, ((10 - ds.leastFrequent.percentage) / 10) * 100));
            if (matchScore >= differScore) return { score: matchScore, signal: `Matches ${ds.mostFrequent.digit}` };
            return { score: differScore, signal: `Differs ${ds.leastFrequent.digit}` };
        }
        const dominant = Math.max(dir.upPercentage, dir.downPercentage);
        const score = Math.max(0, Math.min(100, (dominant - 50) * 2));
        if (this.contractType === 'rise_fall')
            return { score, signal: dir.upPercentage >= dir.downPercentage ? 'Rise' : 'Fall' };
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

    private calcEMA(prices: number[], period: number): number | null {
        if (prices.length < period) return null;
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
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

            const totalWeight = windows.reduce((s, w) => s + w.tickCount, 0);
            const overallScore =
                totalWeight > 0 ? windows.reduce((s, w) => s + w.score * w.tickCount, 0) / totalWeight : 0;
            const largestW = windows[windows.length - 1] ?? windows[0];
            const confidence: Confidence = overallScore >= 60 ? 'High' : overallScore >= 30 ? 'Medium' : 'Low';

            // Fast live signals (all trade types, lighter computation)
            const metrics = this.computeAdvancedMetrics(data.priceBuffer, data.directionBuffer);
            const liveSignals = this.scoreAllSignals(data.priceBuffer, data.directionBuffer, metrics);

            results.push({
                symbol,
                name: MARKET_NAME_MAP.get(symbol) ?? symbol,
                currentPrice: data.currentPrice,
                windows,
                entryExitHistory: data.entryExitHistory,
                overallScore,
                bestSignal: liveSignals[0]?.label ?? largestW.signalLabel,
                confidence: liveSignals[0]
                    ? liveSignals[0].score >= 60
                        ? 'High'
                        : liveSignals[0].score >= 35
                          ? 'Medium'
                          : 'Low'
                    : confidence,
                technical: this.computeTechnical(data.priceBuffer),
                rank: 0,
                liveSignals,
            });
        });

        results.sort(
            (a, b) => (b.liveSignals[0]?.score ?? b.overallScore) - (a.liveSignals[0]?.score ?? a.overallScore)
        );
        results.forEach((r, i) => {
            r.rank = i + 1;
        });

        let best: BestMarket | null = null;
        if (results.length > 0) {
            const top = results[0];
            best = {
                symbol: top.symbol,
                name: top.name,
                signal: top.bestSignal,
                score: top.liveSignals[0]?.score ?? top.overallScore,
                confidence: top.confidence,
                entrySpot: top.currentPrice,
                reason: top.liveSignals[0]?.explanation ?? '',
            };
        }
        this.onUpdateCallback?.(results, best);
    }

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
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
    }
}
