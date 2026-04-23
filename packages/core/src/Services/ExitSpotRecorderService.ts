/**
 * ExitSpotRecorderService
 *
 * Opens its own WebSocket to the Deriv API and subscribes to tick streams for
 * every market in ALL_MARKETS. Each incoming tick is added to a rolling
 * in-memory buffer (max 100 per market, FIFO oldest-first). Spots are also
 * batched and written to Supabase table `admin_exit_spots` every 5 seconds
 * (or sooner if ≥10 spots accumulate for any single market). After each
 * batch write, the table is pruned so each market keeps at most 100 rows,
 * deleting from the oldest epoch upward.
 *
 * Supabase schema (run once):
 *   CREATE TABLE IF NOT EXISTS admin_exit_spots (
 *     id          uuid       DEFAULT gen_random_uuid() PRIMARY KEY,
 *     market_symbol text     NOT NULL,
 *     exit_price  numeric    NOT NULL,
 *     epoch       bigint     NOT NULL,
 *     created_at  timestamptz DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_admin_exit_spots_market_epoch
 *     ON admin_exit_spots (market_symbol, epoch ASC);
 */

import { supabase } from './supabase';
import { ALL_MARKETS } from 'Modules/MarketAnalysis/MarketAnalysisService';

const CAP = 100;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 10;

interface SpotRecord {
    epoch: number;
    price: number;
    quote_str: string;
}

export class ExitSpotRecorderService {
    private ws: WebSocket | null = null;
    private appId: string;
    private active = false;

    /** Rolling in-memory buffer per market — max CAP entries, FIFO */
    private buffer: Map<string, SpotRecord[]> = new Map();
    /** Spots accumulated since last flush */
    private pending: Map<string, SpotRecord[]> = new Map();

    private flushTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.appId = window.localStorage.getItem('config.app_id') || '36300';
        ALL_MARKETS.forEach(m => {
            this.buffer.set(m.symbol, []);
            this.pending.set(m.symbol, []);
        });
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.connect();
        this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
        console.log('[ExitSpotRecorder] started');
    }

    stop() {
        this.active = false;
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.ws?.close();
        this.ws = null;
        console.log('[ExitSpotRecorder] stopped');
    }

    /** Current rolling buffer for a given market symbol (oldest → newest) */
    getBuffer(symbol: string): SpotRecord[] {
        return this.buffer.get(symbol) ?? [];
    }

    /** All buffers keyed by symbol */
    getAllBuffers(): Map<string, SpotRecord[]> {
        return this.buffer;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private connect() {
        try {
            this.ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`);

            // Subscribe immediately on open — no auth needed for public tick stream
            this.ws.onopen = () => {
                ALL_MARKETS.forEach(m => {
                    this.send({ ticks: m.symbol, subscribe: 1 });
                });
                console.log('[ExitSpotRecorder] subscribed to', ALL_MARKETS.length, 'markets');
            };

            this.ws.onmessage = (e: MessageEvent) => {
                try {
                    this.handleMessage(JSON.parse(e.data));
                } catch {
                    /* skip malformed */
                }
            };

            this.ws.onclose = () => {
                if (this.active) {
                    // Reconnect after 5 s
                    setTimeout(() => {
                        if (this.active) this.connect();
                    }, 5000);
                }
            };

            this.ws.onerror = () => {
                this.ws?.close();
            };
        } catch (err: any) {
            console.warn('[ExitSpotRecorder] connect error:', err.message);
        }
    }

    private handleMessage(msg: any) {
        if (msg.msg_type === 'tick' && msg.tick) {
            const { symbol, quote, epoch } = msg.tick;
            if (!symbol || !quote) return;
            const price = Number(quote);
            if (!price || isNaN(price)) return;

            const spot: SpotRecord = { epoch: Number(epoch), price, quote_str: String(quote) };

            // Update rolling in-memory buffer
            const buf = this.buffer.get(symbol) ?? [];
            buf.push(spot);
            if (buf.length > CAP) buf.shift();
            this.buffer.set(symbol, buf);

            // Queue for Supabase batch
            const pend = this.pending.get(symbol) ?? [];
            pend.push(spot);
            this.pending.set(symbol, pend);

            // Early flush if threshold reached for this market
            if (pend.length >= FLUSH_THRESHOLD) {
                this.flush();
            }
        }
    }

    private async flush() {
        const toInsert: Array<{ market_symbol: string; exit_price: number; epoch: number }> = [];
        const flushedMarkets: string[] = [];

        this.pending.forEach((spots, symbol) => {
            if (spots.length === 0) return;
            spots.forEach(s => {
                toInsert.push({ market_symbol: symbol, exit_price: s.price, epoch: s.epoch });
            });
            flushedMarkets.push(symbol);
            this.pending.set(symbol, []);
        });

        if (toInsert.length === 0) return;

        try {
            const { error } = await supabase.from('admin_exit_spots').insert(toInsert);
            if (error) {
                console.warn('[ExitSpotRecorder] insert error:', error.message);
                return;
            }

            // Prune each flushed market to keep only CAP rows
            await Promise.all(flushedMarkets.map(sym => this.pruneMarket(sym)));
        } catch (e: any) {
            console.warn('[ExitSpotRecorder] flush error:', e.message);
        }
    }

    private async pruneMarket(symbol: string) {
        const { count } = await supabase
            .from('admin_exit_spots')
            .select('*', { count: 'exact', head: true })
            .eq('market_symbol', symbol);

        if (!count || count <= CAP) return;

        const excess = count - CAP;

        const { data: oldest } = await supabase
            .from('admin_exit_spots')
            .select('id')
            .eq('market_symbol', symbol)
            .order('epoch', { ascending: true })
            .limit(excess);

        if (!oldest || oldest.length === 0) return;

        const ids = oldest.map((r: any) => r.id);
        await supabase.from('admin_exit_spots').delete().in('id', ids);
    }

    private send(obj: Record<string, unknown>) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }
}

// ── Singleton management ──────────────────────────────────────────────────────

let _instance: ExitSpotRecorderService | null = null;

export const startExitSpotRecorder = (): ExitSpotRecorderService => {
    if (_instance) return _instance; // already running
    _instance = new ExitSpotRecorderService();
    _instance.start();
    return _instance;
};

export const stopExitSpotRecorder = () => {
    _instance?.stop();
    _instance = null;
};

export const getExitSpotRecorder = (): ExitSpotRecorderService | null => _instance;

// Auto-start immediately when this module is imported — no login required
const _recorder = startExitSpotRecorder();
// Expose on window so MarketingTradeEngine (bot-skeleton) can read the buffer
(window as any).__dpa_exit_spot_recorder = _recorder;
// Expose pip-size helper so trader package can look up decimal places without cross-package import
(window as any).__dpa_get_pip_size = (symbol: string): number => _dp(symbol);

// ── Decimal places per market (mirrors marketing-trade-engine.js) ─────────────
const _dp_map: Record<string, number> = {
    R_10: 3,
    R_25: 3,
    R_50: 3,
    R_75: 3,
    R_100: 3,
    '1HZ10V': 2,
    '1HZ25V': 2,
    '1HZ50V': 2,
    '1HZ75V': 2,
    '1HZ100V': 2,
};
const _dp = (symbol: string) => _dp_map[symbol] ?? 3;

function _lastDigitOfPrice(price: number, dp: number): number {
    const s = price.toFixed(dp);
    return Number(s[s.length - 1]);
}

function _spotWins(contract_type: string, exit_digit: number, barrier: number): boolean {
    switch (contract_type) {
        case 'DIGITMATCH':
            return exit_digit === barrier;
        case 'DIGITDIFF':
            return exit_digit !== barrier;
        case 'DIGITEVEN':
            return exit_digit % 2 === 0;
        case 'DIGITODD':
            return exit_digit % 2 !== 0;
        case 'DIGITOVER':
            return exit_digit > barrier;
        case 'DIGITUNDER':
            return exit_digit < barrier;
        default:
            return Math.random() > 0.5;
    }
}

/**
 * Exposed globally so bot-skeleton (cross-package) can consume exit spots from Supabase.
 * Fetches the oldest epoch row for `symbol` that satisfies the win/loss condition,
 * deletes it, and returns { epoch, price_str }.
 */
(window as any).__dpa_fetch_exit_spot = async (
    symbol: string,
    is_win: boolean | null,
    contract_type: string | null,
    barrier: number | null,
    last_epoch: number,
    near_price: number | null = null,
    price_range: number | null = null
): Promise<{ epoch: number; price_str: string } | null> => {
    const dp = _dp(symbol);
    const b = Number(barrier ?? 0);

    // Fetch oldest 60 candidates after last used epoch
    const { data, error } = await supabase
        .from('admin_exit_spots')
        .select('id, epoch, exit_price')
        .eq('market_symbol', symbol)
        .gt('epoch', last_epoch)
        .order('epoch', { ascending: true })
        .limit(60);

    if (error || !data || data.length === 0) return null;

    // Filter out any rows with invalid prices
    const valid = (data as Array<{ id: string; epoch: number; exit_price: number }>).filter(
        row => row.exit_price != null && !isNaN(Number(row.exit_price))
    );

    if (valid.length === 0) return null;

    let chosen: { id: string; epoch: number; exit_price: number } | undefined;

    if (is_win === null || contract_type === null) {
        // No win/loss filter — oldest spot (funded engine)
        chosen = valid[0];
    } else {
        // All rows matching the win/loss digit condition
        const digit_matches = valid.filter(row => {
            const digit = _lastDigitOfPrice(Number(row.exit_price), dp);
            const win = _spotWins(contract_type, digit, b);
            return is_win ? win : !win;
        });

        // Try 1: digit match AND close to live price
        if (near_price !== null && price_range !== null) {
            chosen = digit_matches.find(row => Math.abs(Number(row.exit_price) - near_price) <= price_range);
        }

        // Try 2: digit match only (any price)
        if (!chosen) {
            chosen = digit_matches[0];
        }
    }

    if (!chosen) return null;

    // Consume the row (delete from Supabase)
    await supabase.from('admin_exit_spots').delete().eq('id', chosen.id);

    return { epoch: chosen.epoch, price_str: Number(chosen.exit_price).toFixed(dp) };
};
