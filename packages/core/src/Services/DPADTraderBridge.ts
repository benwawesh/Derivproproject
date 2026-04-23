/**
 * DPADTraderBridge
 *
 * Enables funded / marketing trade execution from D-Trader.
 * Exposed as window.__dpa_execute_dtrader_trade so the trader package
 * (separate webpack chunk) can call it without a cross-package import.
 *
 * Uses its own minimal WebSocket connection for tick counting — independent
 * from the bot WebSocket and the main app WebSocket.
 */

// ── Pattern helpers (mirrors marketing-trade-engine.js) ───────────────────────

function _generatePattern(win_rate: number, cycle_size: number): boolean[] {
    const pattern = new Array(cycle_size).fill(true);
    const losses = cycle_size - win_rate;
    if (losses <= 0) return pattern;
    for (let i = 0; i < losses; i++) {
        const pos = Math.round(((i + 1) / (losses + 1)) * cycle_size) - 1;
        pattern[Math.max(0, Math.min(cycle_size - 1, pos))] = false;
    }
    return pattern;
}

function _lastDigit(str: string): number {
    return Number(str[str.length - 1]);
}

function _isWinFromSpot(contract_type: string, barrier: number, entry: string, exit: string): boolean {
    const d = _lastDigit(exit);
    switch (contract_type) {
        case 'DIGITMATCH':
            return d === barrier;
        case 'DIGITDIFF':
            return d !== barrier;
        case 'DIGITEVEN':
            return d % 2 === 0;
        case 'DIGITODD':
            return d % 2 !== 0;
        case 'DIGITOVER':
            return d > barrier;
        case 'DIGITUNDER':
            return d < barrier;
        case 'CALL':
        case 'RISE':
            return parseFloat(exit) > parseFloat(entry);
        case 'PUT':
        case 'FALL':
            return parseFloat(exit) < parseFloat(entry);
        default:
            return false;
    }
}

function _payoutMultiplier(contract_type: string, barrier: number): number {
    switch (contract_type) {
        case 'DIGITMATCH':
            return 9.0;
        case 'DIGITDIFF':
            return 1.06;
        case 'DIGITEVEN':
        case 'DIGITODD':
            return 1.9;
        case 'DIGITOVER': {
            const w = 9 - barrier;
            return w <= 0 ? 9.0 : parseFloat((9 / w).toFixed(2));
        }
        case 'DIGITUNDER': {
            return barrier <= 0 ? 9.0 : parseFloat((9 / barrier).toFixed(2));
        }
        case 'CALL':
        case 'PUT':
        case 'RISE':
        case 'FALL':
            return 1.95;
        default:
            return 1.8;
    }
}

function _getFloor(symbol: string): number {
    try {
        const raw = sessionStorage.getItem(`dpa_spot_floor_${symbol}`);
        return raw ? (JSON.parse(raw).last_epoch ?? 0) : 0;
    } catch {
        return 0;
    }
}

function _saveFloor(symbol: string, epoch: number, price: number): void {
    try {
        sessionStorage.setItem(`dpa_spot_floor_${symbol}`, JSON.stringify({ last_epoch: epoch, last_price: price }));
    } catch {}
}

// ── Trade execution ───────────────────────────────────────────────────────────

export interface DPADTraderTradeParams {
    contract_type: string;
    symbol: string;
    stake: number;
    duration_ticks: number;
    barrier: number | null;
    currency: string;
    pip_size: number;
    is_funded: boolean;
}

export interface DPADTraderTradeResult {
    is_win: boolean;
    profit: number;
    payout: number;
    exit_spot: string;
    stake: number;
    contract_type: string;
    currency: string;
}

function _executeTrade(params: DPADTraderTradeParams): Promise<DPADTraderTradeResult> {
    const { contract_type, symbol, stake, duration_ticks, barrier, currency, pip_size, is_funded } = params;
    const ticks_needed = Math.max(1, duration_ticks);

    // Determine win/loss target (marketing) or leave null (funded = market-driven)
    let target_is_win: boolean | null = null;
    if (!is_funded) {
        const account = (window as any).__dpa_marketing_account;
        if (!account) return Promise.reject(new Error('Marketing account not loaded'));
        const { win_rate, cycle_size, trade_counter } = account;
        const pattern = _generatePattern(Number(win_rate), Number(cycle_size));
        target_is_win = pattern[Number(trade_counter) % Number(cycle_size)];
    }

    return new Promise((resolve, reject) => {
        const app_id = window.localStorage.getItem('config.app_id') || '36300';
        const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}`);
        let settled = false;
        let entry_spot: string | null = null;
        let tick_count = 0;

        const cleanup = () => {
            try {
                ws.close();
            } catch {}
        };

        const settle = async (live_exit_str: string): Promise<void> => {
            if (settled) return;
            settled = true;
            cleanup();

            const live_price = parseFloat(live_exit_str);
            const last_epoch = _getFloor(symbol);

            let spot_str: string;
            let actual_win: boolean;

            const fetch_fn = (window as any).__dpa_fetch_exit_spot;
            const db_exits_ok = is_funded ? !!(window as any).__dpa_funded_db_exits_active : true;

            if (typeof fetch_fn === 'function' && db_exits_ok) {
                const db_result = await fetch_fn(
                    symbol,
                    is_funded ? null : target_is_win,
                    is_funded ? null : contract_type,
                    is_funded ? null : barrier,
                    last_epoch,
                    is_funded ? null : live_price,
                    is_funded ? null : 5
                ).catch(() => null);

                if (db_result) {
                    _saveFloor(symbol, db_result.epoch, parseFloat(db_result.price_str));
                    spot_str = db_result.price_str;
                    actual_win = is_funded
                        ? _isWinFromSpot(
                              contract_type,
                              barrier ?? 0,
                              entry_spot ?? db_result.price_str,
                              db_result.price_str
                          )
                        : (target_is_win as boolean);
                } else {
                    spot_str = live_price.toFixed(pip_size);
                    actual_win = _isWinFromSpot(contract_type, barrier ?? 0, entry_spot ?? spot_str, spot_str);
                }
            } else {
                spot_str = live_price.toFixed(pip_size);
                actual_win = _isWinFromSpot(contract_type, barrier ?? 0, entry_spot ?? spot_str, spot_str);
            }

            const mult = _payoutMultiplier(contract_type, barrier ?? 0);
            const payout = parseFloat((stake * mult).toFixed(2));
            const profit = actual_win ? parseFloat((payout - stake).toFixed(2)) : parseFloat((-stake).toFixed(2));

            resolve({
                is_win: actual_win,
                profit,
                payout: actual_win ? payout : 0,
                exit_spot: spot_str,
                stake,
                contract_type,
                currency,
            });
        };

        ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));

        ws.onmessage = (e: MessageEvent) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.msg_type !== 'tick' || !msg.tick || msg.tick.symbol !== symbol) return;
                const { quote } = msg.tick;
                if (quote == null || isNaN(Number(quote))) return;
                const quote_str = Number(quote).toFixed(pip_size);
                if (entry_spot === null) {
                    entry_spot = quote_str;
                    tick_count = 1;
                    return;
                }
                tick_count++;
                if (tick_count >= ticks_needed + 1) settle(quote_str).catch(reject);
            } catch {}
        };

        ws.onerror = () => {
            if (!settled) {
                cleanup();
                reject(new Error('WebSocket error'));
            }
        };
        ws.onclose = () => {
            if (!settled) reject(new Error('WebSocket closed unexpectedly'));
        };
        setTimeout(() => {
            if (!settled) {
                cleanup();
                reject(new Error('Trade timed out after 60s'));
            }
        }, 60000);
    });
}

// ── Public init ───────────────────────────────────────────────────────────────

export function initDPADTraderBridge(): void {
    if (typeof window === 'undefined') return;
    (window as any).__dpa_execute_dtrader_trade = (params: DPADTraderTradeParams): Promise<DPADTraderTradeResult> =>
        _executeTrade(params);
}
