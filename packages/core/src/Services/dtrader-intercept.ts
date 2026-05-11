/**
 * DTrader Manual Trade Intercept
 *
 * When funded or marketing mode is active, this module intercepts DTrader's
 * manual buy flow so the full DTrader UX works — running positions panel,
 * live digit stream, chart markers, and the win/loss popup — exactly like demo.
 *
 * How it works:
 *   1. Patches WebSocket.prototype.send to:
 *        a. Capture outgoing `proposal` requests (params keyed by req_id)
 *        b. Intercept `proposal_open_contract` subscribe for fake contracts
 *        c. Swallow `forget` for fake subscription IDs
 *   2. Adds a message listener to capture `proposal` responses
 *        → maps proposal.id → full params + payout
 *   3. Exposes window.__dpa_execute_dtrader_buy(proposal_id, price)
 *        → called by purchase.ts instead of WS.buy
 *        → returns a fake TResponse immediately so trade-store processes it
 *        → registers the FakeContract (ws filled when subscription arrives)
 *   4. When DTrader sends proposal_open_contract subscribe:
 *        → inject initial open-state response (with correct req_id)
 *        → add tick listener → stream updates → settle with digit manipulation
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type ProposalParams = {
    contract_type: string;
    symbol: string;
    duration: number;
    duration_unit: string;
    barrier: string | null;
    currency: string;
    amount: number;
    payout: number;
};

type TickEntry = { epoch: number; tick: number; tick_display_value: string };

type FakeContract = {
    ws: WebSocket | null;
    subscribe_req_id: number | null;
    contract_id: number;
    transaction_id: number;
    sub_id: string;
    contract_type: string;
    symbol: string;
    stake: number;
    duration: number;
    duration_unit: string;
    barrier: string | null;
    currency: string;
    gross_payout: number;
    pip_size: number;
    is_win: boolean;
    date_start: number;
    entry_tick_str: string | null;
    entry_tick_time: number | null;
    tick_stream: TickEntry[];
    ticks_received: number;
    tick_listener: ((event: MessageEvent) => void) | null;
    settle_timeout: ReturnType<typeof setTimeout> | null;
};

// ── Module state ──────────────────────────────────────────────────────────────

let _original_send: WebSocket['send'] | null = null;
// WS that sent the most recent DTrader proposal — the correct one for tick listening
let _proposal_ws: WebSocket | null = null;
// Fallback: the most recently seen WS from any send
let _active_ws: WebSocket | null = null;

// req_id → params (until proposal response arrives with its id)
const _pending_req = new Map<number, Omit<ProposalParams, 'payout'>>();
// proposal string id → full params+payout
const _proposal_params = new Map<string, ProposalParams>();
// contract_id → FakeContract
const _fake_contracts = new Map<number, FakeContract>();
// subscription IDs for fake contracts (to swallow forget requests)
const _fake_sub_ids = new Set<string>();

// ── Patch WebSocket at module load ────────────────────────────────────────────
// Patching here (not inside initDTraderIntercept) ensures ALL WS connections are
// captured from the very first frame, even before any guard is initialised.
// This eliminates the race condition where D-Trader sends proposals between
// account-switch and initFundedGuard completing its async DB call.
if (typeof WebSocket !== 'undefined') {
    _original_send = WebSocket.prototype.send;
    (WebSocket.prototype as any).send = _interceptedSend;
}

// ── Mode helpers ──────────────────────────────────────────────────────────────
// Marketing takes priority: if both flags are true, treat it as marketing mode.

function _isFundedMode(): boolean {
    return (window as any).__dpa_funded_active === true && !(window as any).__dpa_marketing_active;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const initDTraderIntercept = () => {
    // Expose the executor — called by purchase.ts via window global
    (window as any).__dpa_execute_dtrader_buy = _executeDTraderBuy;
    // WS already patched at module load; nothing else needed
};

export const destroyDTraderIntercept = () => {
    // Do NOT restore WebSocket.prototype.send — keep capturing proposals.
    // Do NOT null __dpa_execute_dtrader_buy — it safely returns null when params
    //   aren't found, and nulling it breaks marketing mode after funded guard destroy
    //   because marketing guard won't re-call initDTraderIntercept (loginid unchanged).
    // Do NOT null _active_ws / _proposal_ws — keep the last valid WS references
    //   so the next trade attempt can still start simulation immediately.
    // Do NOT null __dpa_inject_poc_response — owned by portfolio-store.initializePortfolio;
    //   nulling it here breaks funded mode because initFundedGuard calls destroyFundedGuard
    //   first (which reaches here) before initDTraderIntercept runs, leaving inject null.
    _fake_contracts.forEach(fc => _cleanupContract(fc));
    _fake_contracts.clear();
    _fake_sub_ids.clear();
    _pending_req.clear();
    // Keep _proposal_params — re-activation needs the already-captured proposal ids
};

// ── Buy executor (called by purchase.ts via window global) ────────────────────

const _executeDTraderBuy = (proposal_id: string, price: number | string): any => {
    const params = _proposal_params.get(String(proposal_id));
    console.warn(
        '[DPA intercept] _executeDTraderBuy | proposal_id:',
        proposal_id,
        '| params:',
        params,
        '| _active_ws:',
        !!_active_ws,
        '| inject_fn:',
        !!(window as any).__dpa_inject_poc_response
    );

    // Multiplier and Accumulator contracts are not supported on funded/marketing accounts
    if (params && /^MULT|^ACCU/.test(params.contract_type)) {
        const type_name = params.contract_type.startsWith('ACCU') ? 'Accumulator' : 'Multiplier';
        return {
            error: {
                code: 'ContractBuyValidationError',
                message: `${type_name} contracts are only available on real and demo accounts.`,
            },
            msg_type: 'buy',
            echo_req: { buy: proposal_id, price: Number(price) },
        };
    }

    if (!params || !['t', 'm', 'h'].includes(params.duration_unit)) return null; // ticks / minutes / hours

    const stake = Number(price);
    const contract_id = _fakeId();
    const transaction_id = _fakeId();
    const sub_id = 'dpa_' + Math.random().toString(36).slice(2, 10);
    const date_start = Math.floor(Date.now() / 1000);
    const pip_size = _pipSize(params.symbol);

    const { is_win, gross_payout } = _resolveOutcome(params, stake);

    const fake: FakeContract = {
        ws: _proposal_ws ?? _active_ws,
        subscribe_req_id: null,
        contract_id,
        transaction_id,
        sub_id,
        contract_type: params.contract_type,
        symbol: params.symbol,
        stake,
        duration: params.duration,
        duration_unit: params.duration_unit,
        barrier: params.barrier,
        currency: params.currency,
        gross_payout,
        pip_size,
        is_win,
        date_start,
        entry_tick_str: null,
        entry_tick_time: null,
        tick_stream: [],
        ticks_received: 0,
        tick_listener: null,
        settle_timeout: null,
    };

    _fake_contracts.set(contract_id, fake);
    _fake_sub_ids.add(sub_id);

    // Start tick simulation immediately — don't wait for a per-contract subscribe
    // (DTrader uses its global POC subscription, not a per-buy subscribe)
    console.warn(
        '[DPA intercept] Starting simulation | fake.ws:',
        !!fake.ws,
        '| contract_id:',
        contract_id,
        '| is_win:',
        is_win
    );
    if (fake.ws) _startSimulation(fake);

    const balance_after = _currentBalance() - stake;

    // Deduct stake immediately so the header shows the correct balance during the trade
    if (!_isFundedMode()) {
        const mkt_acc = (window as any).__dpa_marketing_account;
        if (mkt_acc) {
            const new_bal = parseFloat((mkt_acc.balance - stake).toFixed(2));
            (window as any).__dpa_marketing_account = { ...mkt_acc, balance: new_bal };
            window.dispatchEvent(
                new CustomEvent('dpa_marketing_balance_updated', {
                    detail: { balance: new_bal, currency: mkt_acc.currency || 'USD' },
                })
            );
        }
    }

    const shortcode = _buildShortcode(
        params.contract_type,
        params.symbol,
        stake,
        date_start,
        params.duration,
        params.barrier
    );

    // Return the fake buy response — trade-store processes this exactly like a real response
    return {
        buy: {
            balance_after: parseFloat(balance_after.toFixed(2)),
            buy_price: stake,
            contract_id,
            longcode: _longcode(
                params.contract_type,
                params.symbol,
                params.barrier,
                params.duration,
                params.duration_unit
            ),
            payout: gross_payout,
            start_time: date_start,
            purchase_time: date_start,
            shortcode,
            transaction_id,
        },
        msg_type: 'buy',
        req_id: 0,
        echo_req: { buy: proposal_id, price: stake },
    };
};

// ── WebSocket send intercept ──────────────────────────────────────────────────

function _interceptedSend(this: WebSocket, data: string | ArrayBuffer | Blob | ArrayBufferView) {
    // Always track the most recently active WebSocket for tick listening
    _active_ws = this;

    // Add incoming message listener to every WS on first use — ensures we capture
    // proposal responses even from connections that were active before init.
    if (!(this as any).__dpa_listening) {
        (this as any).__dpa_listening = true;
        this.addEventListener('message', (event: MessageEvent) => {
            _handleIncoming(this, event.data);
        });
    }

    try {
        if (typeof data !== 'string') {
            if (_original_send) _original_send.call(this, data);
            return;
        }
        const msg = JSON.parse(data);

        // Track outgoing proposal requests (supplementary — echo_req in the response
        // is the primary source now, so this is just for extra coverage)
        if (msg.proposal === 1 && msg.contract_type && msg.symbol) {
            _proposal_ws = this;
            _pending_req.set(msg.req_id, {
                contract_type: msg.contract_type,
                symbol: msg.symbol,
                duration: Number(msg.duration ?? 5),
                duration_unit: msg.duration_unit ?? 't',
                barrier: msg.barrier ?? null,
                currency: msg.currency ?? 'USD',
                amount: Number(msg.amount ?? msg.price ?? 0),
            });
        }

        // Swallow per-contract proposal_open_contract subscribes for fake contracts
        // (simulation is already running; let the subscribe vanish rather than error on Deriv)
        if (msg.proposal_open_contract === 1 && msg.contract_id && msg.subscribe === 1) {
            if (_fake_contracts.has(Number(msg.contract_id))) {
                return; // swallow
            }
        }

        // Swallow forget for fake subscription IDs
        if (msg.forget && _fake_sub_ids.has(String(msg.forget))) {
            _fake_sub_ids.delete(String(msg.forget));
            return;
        }
    } catch {
        /* non-JSON binary frames — pass through */
    }

    if (_original_send) _original_send.call(this, data);
}

// ── Incoming message handler (captures proposal responses) ────────────────────

function _handleIncoming(_ws: WebSocket, rawData: string) {
    try {
        const msg = JSON.parse(rawData);
        if (msg.msg_type === 'proposal' && msg.proposal?.id) {
            const echo = msg.echo_req ?? {};
            const pending = _pending_req.get(msg.req_id);
            // echo_req is always in the response — use it as primary source so we
            // capture proposals even if we missed the outgoing send interception.
            if (echo.contract_type && echo.symbol) {
                _proposal_params.set(msg.proposal.id, {
                    contract_type: echo.contract_type,
                    symbol: echo.symbol,
                    duration: Number(echo.duration ?? pending?.duration ?? 5),
                    duration_unit: echo.duration_unit ?? pending?.duration_unit ?? 't',
                    barrier: echo.barrier ?? pending?.barrier ?? null,
                    currency: echo.currency ?? pending?.currency ?? 'USD',
                    amount: Number(echo.amount ?? pending?.amount ?? 0),
                    payout: Number(msg.proposal.payout ?? 0),
                });
            } else if (pending) {
                _proposal_params.set(msg.proposal.id, { ...pending, payout: Number(msg.proposal.payout ?? 0) });
            }
            _pending_req.delete(msg.req_id);
        }
    } catch {}
}

// ── Contract simulation ───────────────────────────────────────────────────────

function _startSimulation(fake: FakeContract) {
    // If stored WS is gone or closed, fall back to the most recent active one
    if (!fake.ws || fake.ws.readyState !== WebSocket.OPEN) {
        const ws =
            (_proposal_ws?.readyState === WebSocket.OPEN ? _proposal_ws : null) ??
            (_active_ws?.readyState === WebSocket.OPEN ? _active_ws : null);
        if (!ws) return;
        fake.ws = ws;
    }

    const tick_listener = (event: MessageEvent) => {
        try {
            const data = JSON.parse(event.data);
            if (data.msg_type !== 'tick') return;
            const { tick } = data;
            if (!tick || tick.symbol !== fake.symbol) return;
            if (tick.quote == null || isNaN(tick.quote)) return;
            _onTick(fake, tick.quote, tick.epoch);
        } catch {}
    };

    fake.tick_listener = tick_listener;
    fake.ws.addEventListener('message', tick_listener as EventListener);

    if (fake.duration_unit === 't') {
        // Tick contracts: safety fallback if ticks stop arriving
        fake.settle_timeout = setTimeout(() => {
            _settle(fake, fake.entry_tick_str ?? '0', Math.floor(Date.now() / 1000));
        }, 60_000);
    } else {
        // Minute / hour contracts: settle after real elapsed time
        const settle_ms = fake.duration_unit === 'h' ? fake.duration * 60 * 60 * 1000 : fake.duration * 60 * 1000;
        fake.settle_timeout = setTimeout(() => {
            _cleanupTickListener(fake);
            const last = fake.tick_stream[fake.tick_stream.length - 1];
            _settle(
                fake,
                last?.tick_display_value ?? fake.entry_tick_str ?? '0',
                last?.epoch ?? Math.floor(Date.now() / 1000)
            );
        }, settle_ms);
    }
}

function _onTick(fake: FakeContract, quote: number, epoch: number) {
    const quote_str = quote.toFixed(fake.pip_size);
    console.warn(
        '[DPA intercept] _onTick | ticks_received:',
        fake.ticks_received,
        '| quote:',
        quote_str,
        '| duration:',
        fake.duration
    );

    if (fake.entry_tick_str === null) {
        fake.entry_tick_str = quote_str;
        fake.entry_tick_time = epoch;
        fake.ticks_received = 1;
        fake.tick_stream.push({ epoch, tick: quote, tick_display_value: quote_str });
        _injectContractMessage(fake, quote_str, epoch, false);
        return;
    }

    fake.ticks_received++;
    fake.tick_stream.push({ epoch, tick: quote, tick_display_value: quote_str });
    _injectContractMessage(fake, quote_str, epoch, false);

    // Minute/hour contracts settle via setTimeout — don't count ticks for settlement
    if (fake.duration_unit !== 't') return;

    // Tick contracts: entry tick + `duration` more = settle on tick (duration + 1)
    if (fake.ticks_received === fake.duration + 1) {
        _cleanupTickListener(fake);
        _settle(fake, quote_str, epoch);
    }
}

function _settle(fake: FakeContract, live_exit_str: string, exit_epoch: number) {
    _cleanupContract(fake);

    const exit_str = _isManipulationOn()
        ? _manipulateExitDigit(
              live_exit_str,
              fake.contract_type,
              fake.barrier,
              fake.is_win,
              fake.pip_size,
              fake.entry_tick_str
          )
        : live_exit_str;

    // Replace last tick_stream entry with manipulated exit spot
    if (fake.tick_stream.length > 0) {
        const last = fake.tick_stream[fake.tick_stream.length - 1];
        fake.tick_stream[fake.tick_stream.length - 1] = {
            epoch: last.epoch,
            tick: parseFloat(exit_str),
            tick_display_value: exit_str,
        };
    }

    const profit = fake.is_win ? parseFloat((fake.gross_payout - fake.stake).toFixed(2)) : -fake.stake;
    const sell_price = fake.is_win ? fake.gross_payout : 0;

    _injectContractMessage(fake, exit_str, exit_epoch, true, profit, sell_price);
    _dispatchTradeCompleted(fake, profit, sell_price);
    _fake_contracts.delete(fake.contract_id);
}

// ── proposal_open_contract message builder ────────────────────────────────────

function _durSecs(duration_unit: string, duration: number): number {
    if (duration_unit === 'm') return duration * 60;
    if (duration_unit === 'h') return duration * 3600;
    return duration * 2; // ticks: rough 2 s estimate for expiry display only
}

function _injectContractMessage(
    fake: FakeContract,
    current_spot_str: string | null,
    current_epoch: number | null,
    is_settled: boolean,
    profit?: number,
    sell_price?: number
) {
    const now_epoch = current_epoch ?? Math.floor(Date.now() / 1000);
    const spot_str = current_spot_str ?? '';
    const spot_num = spot_str ? parseFloat(spot_str) : 0;
    const running_profit = is_settled ? (profit ?? 0) : -fake.stake;
    const profit_pct = fake.stake > 0 ? parseFloat(((running_profit / fake.stake) * 100).toFixed(2)) : 0;

    const poc: Record<string, unknown> = {
        contract_id: fake.contract_id,
        contract_type: fake.contract_type,
        underlying: fake.symbol,
        display_name: _displayName(fake.symbol),
        currency: fake.currency,
        buy_price: fake.stake,
        payout: fake.gross_payout,
        profit: running_profit,
        profit_percentage: profit_pct,
        bid_price: is_settled ? (sell_price ?? 0) : 0,
        sell_price: is_settled ? (sell_price ?? 0) : 0,
        status: is_settled ? (fake.is_win ? 'won' : 'lost') : 'open',
        is_sold: is_settled ? 1 : 0,
        is_expired: is_settled ? 1 : 0,
        is_settleable: is_settled ? 1 : 0,
        is_valid_to_sell: 0,
        is_valid_to_cancel: 0,
        is_forward_starting: 0,
        is_intraday: 1,
        is_path_dependent: /TOUCH/i.test(fake.contract_type) ? 1 : 0,
        date_start: fake.date_start,
        date_expiry: fake.date_start + _durSecs(fake.duration_unit, fake.duration),
        date_settlement: fake.date_start + _durSecs(fake.duration_unit, fake.duration),
        expiry_time: fake.date_start + _durSecs(fake.duration_unit, fake.duration),
        purchase_time: fake.date_start,
        ...(fake.duration_unit === 't' ? { tick_count: fake.duration } : {}),
        tick_stream: [...fake.tick_stream],
        transaction_ids: { buy: fake.transaction_id },
        longcode: _longcode(fake.contract_type, fake.symbol, fake.barrier, fake.duration, fake.duration_unit),
        shortcode: _buildShortcode(
            fake.contract_type,
            fake.symbol,
            fake.stake,
            fake.date_start,
            fake.duration,
            fake.barrier
        ),
        current_spot: spot_num,
        current_spot_display_value: spot_str,
        current_spot_time: now_epoch,
        id: fake.sub_id,
    };

    if (fake.barrier !== null && fake.barrier !== undefined) {
        poc.barrier = String(fake.barrier);
        poc.barrier_count = 1;
    }
    if (fake.entry_tick_str !== null) {
        poc.entry_tick = parseFloat(fake.entry_tick_str);
        poc.entry_tick_display_value = fake.entry_tick_str;
        poc.entry_tick_time = fake.entry_tick_time ?? fake.date_start;
        poc.entry_spot = poc.entry_tick;
        poc.entry_spot_display_value = fake.entry_tick_str;
        // For spot-start Rise/Fall (no explicit barrier), barrier = entry spot so
        // chart-markers.js draws the horizontal dashed reference line.
        // Higher/Lower contracts already have fake.barrier set to the user's chosen level.
        if (['CALL', 'PUT', 'RISE', 'FALL'].includes(fake.contract_type) && fake.barrier === null) {
            poc.barrier = fake.entry_tick_str;
            poc.barrier_count = 1;
        }
    }
    if (is_settled && spot_str) {
        poc.exit_tick = spot_num;
        poc.exit_tick_display_value = spot_str;
        poc.exit_tick_time = now_epoch;
        poc.sell_time = now_epoch;
    }

    // Deliver directly to the portfolio store's queue handler — no WebSocket routing needed
    const inject = (window as any).__dpa_inject_poc_response;
    console.warn(
        '[DPA intercept] _injectContractMessage | is_settled:',
        is_settled,
        '| inject_fn:',
        !!inject,
        '| contract_id:',
        fake.contract_id,
        '| status:',
        poc.status
    );
    if (inject) {
        inject({
            proposal_open_contract: poc,
            msg_type: 'proposal_open_contract',
            subscription: { id: fake.sub_id },
        });
    }
}

// ── Win/loss + manipulation ───────────────────────────────────────────────────

function _resolveOutcome(params: ProposalParams, stake: number): { is_win: boolean; gross_payout: number } {
    let win_rate = 7,
        cycle_size = 10,
        trade_counter = 0;
    let is_win: boolean;

    if (_isFundedMode()) {
        win_rate = (window as any).__dpa_funded_win_rate ?? 7;
        cycle_size = (window as any).__dpa_funded_cycle_size ?? 10;
        const key = `dpa_funded_counter_${(window as any).__dpa_funded_loginid ?? 'funded'}`;
        trade_counter = parseInt(sessionStorage.getItem(key) ?? '0', 10);
        is_win = _pattern(win_rate, cycle_size)[trade_counter % cycle_size];
        sessionStorage.setItem(key, String(trade_counter + 1));
    } else {
        const acc = (window as any).__dpa_marketing_account;
        if (acc) {
            win_rate = acc.win_rate ?? 7;
            cycle_size = acc.cycle_size ?? 10;
            trade_counter = acc.trade_counter ?? 0;
        }
        is_win = _pattern(win_rate, cycle_size)[trade_counter % cycle_size];
        if ((window as any).__dpa_marketing_account) {
            (window as any).__dpa_marketing_account = {
                ...(window as any).__dpa_marketing_account,
                trade_counter: trade_counter + 1,
            };
        }
    }

    // Use real Deriv payout if captured, else calculate
    const gross_payout =
        params.payout > 0
            ? parseFloat(params.payout.toFixed(2))
            : parseFloat((stake * _payoutMult(params.contract_type, params.barrier)).toFixed(2));

    return { is_win, gross_payout };
}

function _isManipulationOn(): boolean {
    if (_isFundedMode()) return (window as any).__dpa_funded_manipulate_exit !== false;
    const acc = (window as any).__dpa_marketing_account;
    return acc ? acc.manipulate_exit !== false : true;
}

function _currentBalance(): number {
    if (_isFundedMode()) return (window as any).__dpa_funded_balance ?? 0;
    return (window as any).__dpa_marketing_account?.balance ?? 0;
}

function _dispatchTradeCompleted(_fake: FakeContract, profit: number, sell_price: number) {
    if (_isFundedMode()) {
        const new_bal = parseFloat((((window as any).__dpa_funded_balance ?? 0) + profit).toFixed(2));
        (window as any).__dpa_funded_balance = new_bal;
        window.dispatchEvent(new CustomEvent('dpa_funded_trade_completed', { detail: { profit } }));
        // Notify the header balance display (listens for dpa_funded_balance_updated)
        window.dispatchEvent(new CustomEvent('dpa_funded_balance_updated', { detail: { current_balance: new_bal } }));
    } else {
        // Stake was already deducted at purchase time; add payout back if won
        const acc = (window as any).__dpa_marketing_account;
        if (acc && sell_price > 0) {
            const new_bal = parseFloat((acc.balance + sell_price).toFixed(2));
            (window as any).__dpa_marketing_account = { ...acc, balance: new_bal };
        }
        window.dispatchEvent(
            new CustomEvent('dpa_marketing_trade_completed', { detail: { profit, payout: sell_price } })
        );
    }
}

// ── Exit digit manipulation ───────────────────────────────────────────────────

function _manipulateExitDigit(
    price_str: string,
    contract_type: string,
    barrier: string | null,
    is_win: boolean,
    dp: number,
    entry_str: string | null
): string {
    if (/TOUCH/i.test(contract_type)) {
        // ONETOUCH wins by touching barrier; NOTOUCH wins by avoiding it.
        const needs_touch = (contract_type === 'ONETOUCH') === is_win;
        if (needs_touch && barrier !== null) return parseFloat(barrier).toFixed(dp);
        return price_str; // no-touch case: return live price
    }
    if (['CALL', 'PUT', 'RISE', 'FALL'].includes(contract_type)) {
        const live = parseFloat(price_str);
        const pip = 1 / Math.pow(10, dp);
        const is_rise = contract_type === 'CALL' || contract_type === 'RISE';
        // Higher/Lower uses explicit barrier; Rise/Fall uses entry spot as reference.
        const ref =
            barrier !== null && (contract_type === 'CALL' || contract_type === 'PUT')
                ? parseFloat(barrier)
                : parseFloat(entry_str ?? price_str);
        const real_is_win = is_rise ? live > ref : live < ref;
        // Use the real market price when it already gives the right outcome —
        // only nudge by 1 pip when we need to force a different result.
        if (real_is_win === is_win) return price_str;
        if (is_rise) return (is_win ? ref + pip : ref - pip).toFixed(dp);
        return (is_win ? ref - pip : ref + pip).toFixed(dp);
    }
    const valid = _validDigits(contract_type, barrier, is_win);
    if (!valid) return parseFloat(price_str).toFixed(dp);
    const chosen = valid[Math.floor(Math.random() * valid.length)];
    return parseFloat(price_str).toFixed(dp).slice(0, -1) + String(chosen);
}

function _validDigits(contract_type: string, barrier: string | null, is_win: boolean): number[] | null {
    const b = Number(barrier);
    const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    let winners: number[];
    switch (contract_type) {
        case 'DIGITMATCH':
            winners = [b];
            break;
        case 'DIGITDIFF':
            winners = all.filter(d => d !== b);
            break;
        case 'DIGITEVEN':
            winners = [0, 2, 4, 6, 8];
            break;
        case 'DIGITODD':
            winners = [1, 3, 5, 7, 9];
            break;
        case 'DIGITOVER':
            winners = all.filter(d => d > b);
            break;
        case 'DIGITUNDER':
            winners = all.filter(d => d < b);
            break;
        default:
            return null;
    }
    const result = is_win ? winners : all.filter(d => !winners.includes(d));
    return result.length > 0 ? result : all;
}

function _pattern(win_rate: number, cycle_size: number): boolean[] {
    const safe_wins = Math.min(Math.max(0, win_rate), cycle_size);
    const p = new Array(cycle_size).fill(true);
    const losses = cycle_size - safe_wins;
    if (losses === 0) return p;
    const step = cycle_size / losses;
    for (let i = 0; i < losses; i++) p[Math.round(i * step + step / 2) % cycle_size] = false;
    return p;
}

function _payoutMult(contract_type: string, barrier: string | null): number {
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
            return w <= 0 ? 9.0 : parseFloat((9 / w).toFixed(2));
        }
        case 'DIGITUNDER': {
            const w = Number(barrier);
            return w <= 0 ? 9.0 : parseFloat((9 / w).toFixed(2));
        }
        case 'CALL':
        case 'PUT':
        case 'RISE':
        case 'FALL':
            return 1.95;
        case 'ONETOUCH':
            return 1.85;
        case 'NOTOUCH':
            return 3.5;
        default:
            return 1.8;
    }
}

// ── Shortcode + longcode ──────────────────────────────────────────────────────

function _buildShortcode(
    contract_type: string,
    symbol: string,
    stake: number,
    start: number,
    duration: number,
    barrier: string | null
): string {
    const end = start + duration + 5; // approximate end epoch
    const b = barrier !== null && barrier !== undefined ? String(barrier) : 'S0P';
    return `${contract_type}_${symbol}_${stake.toFixed(2)}_${start}_${end}_${b}`;
}

function _longcode(
    contract_type: string,
    symbol: string,
    barrier: string | null,
    duration: number,
    duration_unit?: string
): string {
    const name = _displayName(symbol);
    const du = duration_unit ?? 't';
    const unit =
        du === 'm'
            ? duration === 1
                ? 'minute'
                : 'minutes'
            : du === 'h'
              ? duration === 1
                  ? 'hour'
                  : 'hours'
              : duration === 1
                ? 'tick'
                : 'ticks';
    switch (contract_type) {
        case 'DIGITOVER':
            return `Win payout if the last digit of ${name} is strictly higher than ${barrier} after ${duration} ${unit}.`;
        case 'DIGITUNDER':
            return `Win payout if the last digit of ${name} is strictly lower than ${barrier} after ${duration} ${unit}.`;
        case 'DIGITMATCH':
            return `Win payout if the last digit of ${name} is ${barrier} after ${duration} ${unit}.`;
        case 'DIGITDIFF':
            return `Win payout if the last digit of ${name} is not ${barrier} after ${duration} ${unit}.`;
        case 'DIGITEVEN':
            return `Win payout if the last digit of ${name} is even after ${duration} ${unit}.`;
        case 'DIGITODD':
            return `Win payout if the last digit of ${name} is odd after ${duration} ${unit}.`;
        case 'ONETOUCH':
            return `Win payout if ${name} touches ${barrier ?? 'the barrier'} in the next ${duration} ${unit}.`;
        case 'NOTOUCH':
            return `Win payout if ${name} does not touch ${barrier ?? 'the barrier'} in the next ${duration} ${unit}.`;
        case 'CALL':
            return barrier !== null
                ? `Win payout if ${name} is higher than ${barrier} at the end of ${duration} ${unit}.`
                : `Win payout if ${name} is strictly higher than entry spot after ${duration} ${unit}.`;
        case 'PUT':
            return barrier !== null
                ? `Win payout if ${name} is lower than ${barrier} at the end of ${duration} ${unit}.`
                : `Win payout if ${name} is strictly lower than entry spot after ${duration} ${unit}.`;
        case 'RISE':
            return `Win payout if ${name} is strictly higher than entry spot after ${duration} ${unit}.`;
        case 'FALL':
            return `Win payout if ${name} is strictly lower than entry spot after ${duration} ${unit}.`;
        default:
            return `Contract on ${name} for ${duration} ${unit}.`;
    }
}

const DISPLAY_NAMES: Record<string, string> = {
    R_10: 'Volatility 10 Index',
    R_25: 'Volatility 25 Index',
    R_50: 'Volatility 50 Index',
    R_75: 'Volatility 75 Index',
    R_100: 'Volatility 100 Index',
    '1HZ10V': 'Volatility 10 (1s) Index',
    '1HZ25V': 'Volatility 25 (1s) Index',
    '1HZ50V': 'Volatility 50 (1s) Index',
    '1HZ75V': 'Volatility 75 (1s) Index',
    '1HZ100V': 'Volatility 100 (1s) Index',
    BOOM300N: 'Boom 300 Index',
    BOOM500: 'Boom 500 Index',
    BOOM1000: 'Boom 1000 Index',
    CRASH300N: 'Crash 300 Index',
    CRASH500: 'Crash 500 Index',
    CRASH1000: 'Crash 1000 Index',
};
function _displayName(symbol: string) {
    return DISPLAY_NAMES[symbol] ?? symbol;
}

const PIP_SIZES: Record<string, number> = {
    R_10: 3,
    R_25: 3,
    R_50: 2,
    R_75: 2,
    R_100: 2,
    '1HZ10V': 3,
    '1HZ25V': 3,
    '1HZ50V': 2,
    '1HZ75V': 2,
    '1HZ100V': 2,
    BOOM300N: 2,
    BOOM500: 2,
    BOOM1000: 2,
    CRASH300N: 2,
    CRASH500: 2,
    CRASH1000: 2,
};
function _pipSize(symbol: string) {
    return PIP_SIZES[symbol] ?? 2;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _fakeId(): number {
    return Math.floor(Date.now() * 1000 + Math.random() * 999);
}

function _cleanupTickListener(fake: FakeContract) {
    if (fake.tick_listener && fake.ws) {
        fake.ws.removeEventListener('message', fake.tick_listener as EventListener);
        fake.tick_listener = null;
    }
    if (fake.settle_timeout) {
        clearTimeout(fake.settle_timeout);
        fake.settle_timeout = null;
    }
}

function _cleanupContract(fake: FakeContract) {
    _cleanupTickListener(fake);
    _fake_sub_ids.delete(fake.sub_id);
}
