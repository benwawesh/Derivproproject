/**
 * Funded Account Guard
 *
 * Enforces challenge rules in real-time:
 *   Pre-trade  — patches WebSocket.prototype.send to block illegal buy requests
 *   Post-trade — listens for dpa_real_trade_completed events to track P&L and
 *                check drawdown / daily-loss / profit-target thresholds
 *
 * Usage:
 *   initFundedGuard(loginId, rules, participant, onAlert)
 *   destroyFundedGuard()
 */

import { updateParticipant, logViolation } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
export type FundedRules = {
    phase: number;
    max_stake_per_trade: number;
    max_daily_loss_percent: number;
    max_total_drawdown_percent: number;
    profit_target_percent: number;
};

export type GuardParticipant = {
    deriv_login_id: string;
    is_disqualified: boolean;
    start_balance: number;
    current_balance: number;
    daily_loss_today: number;
    net_profit: number;
    current_phase: number;
    phase_status: string;
};

export type AlertType = 'blocked' | 'passed' | 'warning';

export type OnAlertCallback = (message: string, type: AlertType) => void;

// ── Singleton state ───────────────────────────────────────────────────────────
let _active = false;
let _login_id = '';
let _rules: FundedRules | null = null;
let _participant: GuardParticipant | null = null;
let _onAlert: OnAlertCallback | null = null;
let _tradeListener: ((e: Event) => void) | null = null;

// ── Init ──────────────────────────────────────────────────────────────────────
export const initFundedGuard = (
    login_id: string,
    rules: FundedRules,
    participant: GuardParticipant,
    onAlert: OnAlertCallback
) => {
    destroyFundedGuard();

    _login_id = login_id;
    _rules = rules;
    _participant = participant;
    _onAlert = onAlert;
    _active = true;

    /* Signal to bot-skeleton's FundedTradeEngine that funded mode is on */
    (window as any).__dpa_funded_active = true;
    (window as any).__dpa_funded_loginid = login_id;
    /* DB exit spots flag — set from participant; DPANavbar also ORs in global setting */
    (window as any).__dpa_funded_db_exits_active = !!(participant as any).use_db_exit_spots;
    /* Win/loss cycle settings for controlled exit spot mode */
    (window as any).__dpa_funded_win_rate = (participant as any).db_win_rate ?? 7;
    (window as any).__dpa_funded_cycle_size = (participant as any).db_cycle_size ?? 10;

    /* Expose pre-trade rule checker so Purchase.js can call it cross-package */
    (window as any).__dpa_check_funded_trade = (stake: number): string | null => checkPreTrade({ price: stake });

    /* ── Post-trade: listen for funded trade completion events ── */
    _tradeListener = (e: Event) => {
        const detail = (e as CustomEvent).detail ?? {};
        const profit: number = parseFloat(detail.profit ?? '0');
        handleTradeResult(profit).catch(() => {});
    };
    window.addEventListener('dpa_funded_trade_completed', _tradeListener);
};

// ── Pre-trade checks ──────────────────────────────────────────────────────────
const checkPreTrade = (msg: any): string | null => {
    if (!_rules || !_participant) return null;

    if (_participant.is_disqualified) {
        return 'Your funded account has been disqualified. Contact admin to reset.';
    }

    if (_participant.phase_status === 'blown') {
        return 'Account blown — max drawdown exceeded. Contact admin to reset.';
    }

    if (_participant.phase_status === 'passed') {
        return 'Phase already passed. Await admin review before continuing.';
    }

    /* Daily loss check — block if already at limit */
    if (_participant.start_balance > 0) {
        const daily_loss_pct = (_participant.daily_loss_today / _participant.start_balance) * 100;
        if (daily_loss_pct >= _rules.max_daily_loss_percent) {
            return `Daily loss limit of ${_rules.max_daily_loss_percent}% reached. Trading suspended until tomorrow.`;
        }
    }

    if (_rules.max_stake_per_trade > 0) {
        const stake = parseFloat(msg.price ?? msg.amount ?? '0');
        if (stake > _rules.max_stake_per_trade) {
            return `Stake $${stake} exceeds the phase limit of $${_rules.max_stake_per_trade}. Reduce your stake.`;
        }
    }

    return null;
};

// ── Post-trade processing ─────────────────────────────────────────────────────
const handleTradeResult = async (profit: number): Promise<void> => {
    if (!_active || !_rules || !_participant) return;

    const new_balance = _participant.current_balance + profit;
    const new_daily_loss =
        profit < 0 ? _participant.daily_loss_today + Math.abs(profit) : _participant.daily_loss_today;
    const new_net_profit = _participant.net_profit + profit;

    const daily_loss_pct = (new_daily_loss / _participant.start_balance) * 100;
    const drawdown_pct = ((new_balance - _participant.start_balance) / _participant.start_balance) * 100;
    const profit_pct = (new_net_profit / _participant.start_balance) * 100;

    const updates: Record<string, unknown> = {
        current_balance: new_balance,
        net_profit: new_net_profit,
        profit_percent: profit_pct,
        daily_loss_today: new_daily_loss,
        total_drawdown_percent: Math.abs(Math.min(0, drawdown_pct)),
        updated_at: new Date().toISOString(),
    };

    let violation_type: string | null = null;
    let violation_reason: string | null = null;

    /* Priority: blown > profit-target > daily-loss warning */
    if (drawdown_pct <= -_rules.max_total_drawdown_percent) {
        updates.is_disqualified = true;
        updates.phase_status = 'blown';
        violation_type = 'account_blown';
        violation_reason = `Max drawdown of ${_rules.max_total_drawdown_percent}% exceeded.`;
        _participant = { ..._participant, ...updates } as GuardParticipant;
        if (_onAlert)
            _onAlert(
                `Account blown — max drawdown of ${_rules.max_total_drawdown_percent}% exceeded. Contact admin to reset your account.`,
                'blocked'
            );
    } else if (_rules.profit_target_percent > 0 && profit_pct >= _rules.profit_target_percent) {
        updates.phase_status = 'passed';
        violation_type = 'phase_passed';
        violation_reason = `Profit target of ${_rules.profit_target_percent}% reached. Phase passed.`;
        _participant = { ..._participant, ...updates } as GuardParticipant;
        if (_onAlert)
            _onAlert(
                `Congratulations! You hit the ${_rules.profit_target_percent}% profit target. Phase ${_rules.phase} passed! Bot stopped — await admin review.`,
                'passed'
            );
    } else if (daily_loss_pct >= _rules.max_daily_loss_percent) {
        /* Daily limit reached — warn but don't disqualify (resets each day) */
        _participant = { ..._participant, ...updates } as GuardParticipant;
        if (_onAlert)
            _onAlert(
                `Daily loss limit of ${_rules.max_daily_loss_percent}% reached. Trading suspended until tomorrow.`,
                'blocked'
            );
        violation_type = 'daily_limit';
        violation_reason = `Daily loss limit of ${_rules.max_daily_loss_percent}% reached.`;
    } else {
        _participant = { ..._participant, ...updates } as GuardParticipant;
    }

    await updateParticipant(_login_id, updates);

    if (violation_type && violation_reason) {
        await logViolation({ deriv_login_id: _login_id, violation_type, reason: violation_reason });
    }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export const updateGuardParticipant = (patch: Partial<GuardParticipant>) => {
    if (_participant) _participant = { ..._participant, ...patch };
};

export const getGuardParticipant = () => _participant;

export const isGuardActive = () => _active;

// ── Destroy ───────────────────────────────────────────────────────────────────
export const destroyFundedGuard = () => {
    if (_tradeListener) {
        window.removeEventListener('dpa_funded_trade_completed', _tradeListener);
        _tradeListener = null;
    }
    /* Signal bot-skeleton that funded mode is off */
    (window as any).__dpa_funded_active = false;
    (window as any).__dpa_funded_loginid = null;
    (window as any).__dpa_check_funded_trade = null;
    (window as any).__dpa_funded_challenge = null;
    (window as any).__dpa_funded_db_exits_active = false;
    (window as any).__dpa_funded_win_rate = 7;
    (window as any).__dpa_funded_cycle_size = 10;
    /* Clear localStorage flags directly — don't rely on FundedAccountStore being loaded */
    try {
        localStorage.removeItem('dpa_funded_mode_active');
        localStorage.removeItem('dpa_funded_user_id');
    } catch (_) {
        /* ignore */
    }
    _active = false;
    _rules = null;
    _participant = null;
    _login_id = '';
    _onAlert = null;
};
