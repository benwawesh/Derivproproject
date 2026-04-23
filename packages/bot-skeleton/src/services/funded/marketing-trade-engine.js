/**
 * MarketingTradeEngine
 *
 * Simulates real-account trades using stored exit spots from admin_exit_spots
 * (via ExitSpotRecorderService in-memory buffer) with an admin-controlled
 * win/loss cycle. Works identically to FundedTradeEngine from the bot's
 * perspective — same events, same state machine.
 *
 * Win/loss determination:
 *   - Admin sets win_rate (e.g. 7) and cycle_size (e.g. 10)
 *   - Pattern is pre-computed and distributed evenly (not all wins first)
 *   - trade_counter persists in Supabase across sessions
 *
 * Exit spot selection:
 *   - Reads in-memory buffer from ExitSpotRecorderService (window.__dpa_exit_spot_recorder)
 *   - Filters spots by win/loss condition for the contract type
 *   - Falls back to Supabase DB if buffer is empty
 */

import { observer as globalObserver } from '../../utils/observer';
import { generateLongcode, getSymbolDisplayName } from './funded-trade-engine';
import { api_base } from '../api/api-base';

// ── Module-level state (survives React re-renders and window global resets) ───
let _module_active = false;

// ── Spot floor helpers — persisted in sessionStorage so they survive bot restarts ─
// Format stored: { last_epoch: number, last_price: number }

function _getFloor(symbol) {
    try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`dpa_spot_floor_${symbol}`) : null;
        return raw ? JSON.parse(raw) : { last_epoch: 0, last_price: 0 };
    } catch {
        return { last_epoch: 0, last_price: 0 };
    }
}

function _saveFloor(symbol, epoch, price) {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(
                `dpa_spot_floor_${symbol}`,
                JSON.stringify({ last_epoch: Number(epoch), last_price: Number(price) })
            );
        }
    } catch {}
}

if (typeof window !== 'undefined') {
    // Sync from window global on module load (in case guard already activated)
    _module_active = window.__dpa_marketing_active === true;

    window.addEventListener('dpa_marketing_activated', () => {
        _module_active = true;
    });
    window.addEventListener('dpa_marketing_deactivated', () => {
        _module_active = false;
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const MarketingTradeEngine = {
    isActive() {
        if (typeof window === 'undefined') return false;
        // Funded challenge takes full priority — never intercept funded trades with marketing
        if (window.__dpa_funded_active === true) return false;
        // Guard function is authoritative when present — trust it exclusively
        if (typeof window.__dpa_isMarketingActive === 'function') return window.__dpa_isMarketingActive();
        // Fallback: module-level state and window global
        if (_module_active) return true;
        return window.__dpa_marketing_active === true;
    },

    /**
     * Execute a marketing trade.
     * Settles after simulated tick duration using a stored exit spot.
     */
    execute({ contract_type, symbol, stake, duration, barrier, currency, contract_id, transaction_id }) {
        return new Promise((resolve, reject) => {
            const ticks_needed = Math.max(1, duration || 5);
            const date_start = Math.floor(Date.now() / 1000);

            const account = window.__dpa_marketing_account;
            if (!account) {
                reject(new Error('Marketing account not loaded'));
                return;
            }

            const { win_rate, cycle_size, trade_counter } = account;
            const pattern = _generatePattern(win_rate, cycle_size);
            const is_win = pattern[trade_counter % cycle_size];

            let entry_tick_str = null;
            let tick_count = 0;
            let subscription = null;

            const cleanup = () => {
                if (subscription) {
                    try {
                        subscription.unsubscribe();
                    } catch (_) {}
                    subscription = null;
                }
            };

            const settle = async (live_exit_str, exit_epoch) => {
                cleanup();
                const pip_size = api_base.pip_sizes?.[symbol] ?? 2;
                const live_price = parseFloat(live_exit_str);
                const { last_epoch } = _getFloor(symbol);

                // Try 1: DB spot within ±5 of live price + correct digit
                // Try 2: DB spot with correct digit only (any price)
                // Try 3: live tick directly (DB empty)
                const db_result = await _fetchSpotNearPrice(
                    symbol,
                    contract_type,
                    barrier,
                    is_win,
                    last_epoch,
                    live_price,
                    5
                );

                let spot_str, actual_win;
                if (db_result) {
                    _saveFloor(symbol, db_result.epoch, parseFloat(db_result.price_str));
                    spot_str = db_result.price_str;
                    actual_win = is_win;
                } else {
                    // DB empty — live tick, outcome determined by market
                    spot_str = live_price.toFixed(pip_size);
                    actual_win = _isWinFromSpot(contract_type, barrier, entry_tick_str, spot_str);
                }

                _settle(resolve, {
                    is_win: actual_win,
                    spot_str,
                    contract_type,
                    symbol,
                    stake,
                    duration: ticks_needed,
                    barrier,
                    currency,
                    contract_id,
                    transaction_id,
                    date_start,
                });
            };

            try {
                subscription = api_base.api.onMessage().subscribe(({ data }) => {
                    if (data.msg_type !== 'tick') return;
                    const { tick } = data;
                    if (!tick || tick.symbol !== symbol) return;
                    if (!MarketingTradeEngine.isActive()) {
                        cleanup();
                        return;
                    }
                    if (tick.quote == null || isNaN(tick.quote)) return;

                    const pip_size = api_base.pip_sizes?.[symbol] ?? 2;
                    const quote_str = tick.quote.toFixed(pip_size);

                    if (entry_tick_str === null) {
                        entry_tick_str = quote_str;
                        tick_count = 1;
                        return;
                    }
                    tick_count++;
                    if (tick_count >= ticks_needed + 1) {
                        settle(quote_str, tick.epoch).catch(() => {});
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function _settle(
    resolve,
    {
        is_win,
        spot_str,
        contract_type,
        symbol,
        stake,
        duration,
        barrier,
        currency,
        contract_id,
        transaction_id,
        date_start,
    }
) {
    const exit_time = Math.floor(Date.now() / 1000);
    const mult = _getPayoutMultiplier(contract_type, barrier);
    const payout = parseFloat((stake * mult).toFixed(2));
    const profit = is_win ? parseFloat((payout - stake).toFixed(2)) : -stake;
    const sell_price = is_win ? payout : 0;
    const sell_tx_id = transaction_id + 1;
    const longcode = generateLongcode(contract_type, symbol, barrier, duration);

    const contract = {
        contract_id,
        contract_type,
        underlying: symbol,
        display_name: getSymbolDisplayName(symbol),
        transaction_ids: { buy: transaction_id, sell: sell_tx_id },
        buy_price: stake,
        sell_price,
        payout,
        bid_price: sell_price,
        profit,
        is_sold: 1,
        is_expired: 1,
        is_valid_to_sell: 0,
        entry_tick: spot_str,
        entry_tick_display_value: spot_str,
        entry_tick_time: date_start,
        exit_tick: spot_str,
        exit_tick_display_value: spot_str,
        exit_tick_time: exit_time,
        date_start,
        longcode,
        status: is_win ? 'won' : 'lost',
        barrier: barrier !== null && barrier !== undefined ? String(barrier) : undefined,
        currency,
        _is_marketing: true,
    };

    globalObserver.emit('marketing.trade.settled', {
        trade: {
            id: String(contract_id),
            timestamp: Date.now(),
            symbol,
            contract_type,
            stake,
            payout: is_win ? payout : 0,
            profit,
            status: is_win ? 'won' : 'lost',
            entry_spot: parseFloat(spot_str),
            exit_spot: parseFloat(spot_str),
            entry_digit: _lastDigit(spot_str),
            exit_digit: _lastDigit(spot_str),
            duration_ticks: duration,
            prediction: barrier !== null && barrier !== undefined ? Number(barrier) : null,
        },
    });

    // Notify MarketingGuard so balance updates after each trade
    if (typeof window !== 'undefined') {
        window.dispatchEvent(
            new CustomEvent('dpa_marketing_trade_completed', { detail: { profit, payout: is_win ? payout : 0 } })
        );
    }

    resolve(contract);
}

/**
 * Generate a distributed win/loss pattern.
 * Losses are spread evenly so results look natural.
 * e.g. win_rate=7, cycle_size=10 → [T,T,F,T,T,F,T,T,T,F]
 */
function _generatePattern(win_rate, cycle_size) {
    const pattern = new Array(cycle_size).fill(true);
    const losses = cycle_size - win_rate;
    if (losses <= 0) return pattern;
    for (let i = 0; i < losses; i++) {
        const pos = Math.round(((i + 1) / (losses + 1)) * cycle_size) - 1;
        pattern[Math.max(0, Math.min(cycle_size - 1, pos))] = false;
    }
    return pattern;
}

/**
 * Fetch a DB exit spot matching win/loss digit, preferring one close to live_price.
 * Try 1: digit match AND within ±price_range of live_price
 * Try 2: digit match only (any price)
 * Returns null if DB empty or unavailable.
 */
async function _fetchSpotNearPrice(symbol, contract_type, barrier, is_win, last_epoch, live_price, price_range) {
    if (typeof window === 'undefined' || typeof window.__dpa_fetch_exit_spot !== 'function') return null;
    try {
        return await window.__dpa_fetch_exit_spot(
            symbol,
            is_win,
            contract_type,
            barrier,
            last_epoch,
            live_price,
            price_range
        );
    } catch {
        return null;
    }
}

/** Determine win/loss from actual entry/exit spot (used when DB is empty and live tick is used). */
function _isWinFromSpot(contract_type, barrier, entry_str, exit_str) {
    const exit_digit = _lastDigit(exit_str);
    const b = Number(barrier);
    switch (contract_type) {
        case 'DIGITMATCH':
            return exit_digit === b;
        case 'DIGITDIFF':
            return exit_digit !== b;
        case 'DIGITEVEN':
            return exit_digit % 2 === 0;
        case 'DIGITODD':
            return exit_digit % 2 !== 0;
        case 'DIGITOVER':
            return exit_digit > b;
        case 'DIGITUNDER':
            return exit_digit < b;
        case 'CALL':
        case 'RISE':
            return parseFloat(exit_str) > parseFloat(entry_str);
        case 'PUT':
        case 'FALL':
            return parseFloat(exit_str) < parseFloat(entry_str);
        default:
            return false;
    }
}

function _lastDigit(str) {
    const s = String(str);
    return Number(s[s.length - 1]);
}

function _getPayoutMultiplier(contract_type, barrier) {
    switch (contract_type) {
        case 'DIGITMATCH':
            return 9.0;
        case 'DIGITDIFF':
            return 1.06;
        case 'DIGITEVEN':
        case 'DIGITODD':
            return 1.9;
        case 'DIGITOVER': {
            const w = 9 - Number(barrier);
            return w <= 0 ? 9.0 : parseFloat((9.0 / w).toFixed(2));
        }
        case 'DIGITUNDER': {
            const w = Number(barrier);
            return w <= 0 ? 9.0 : parseFloat((9.0 / w).toFixed(2));
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
