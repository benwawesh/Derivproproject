/**
 * MarketingGuard
 *
 * Checks Supabase for an active marketing account assigned to the logged-in user.
 * Sets window.__dpa_marketing_active and window.__dpa_marketing_account so that
 * MarketingTradeEngine (in bot-skeleton) can read them cross-package.
 *
 * Also listens for real-time admin changes (toggle on/off, balance updates).
 */

import { supabase, getMarketingAccount, incrementMarketingTradeCounter } from './supabase';

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _tradeListener: ((e: Event) => void) | null = null;
let _active = false;
let _loginid = '';

// ── Init ──────────────────────────────────────────────────────────────────────

export const initMarketingGuard = async (loginid: string): Promise<boolean> => {
    // If already initialized for this loginid, skip — don't reset globals mid-session
    if (_loginid === loginid && _channel) {
        return _active;
    }

    // Different loginid — tear down channel only, keep globals until fetch resolves
    if (_channel) {
        supabase.removeChannel(_channel);
        _channel = null;
    }
    _loginid = loginid;

    try {
        const account = await getMarketingAccount(loginid);

        // Always subscribe to real-time so admin can toggle on/off live
        _subscribeRealtime(loginid);

        if (!account || !account.is_active) {
            // Confirmed no active account — now safe to deactivate
            _deactivate();
            return false;
        }

        _activate(account);
        return true;
    } catch (err) {
        console.error('[MarketingGuard] error:', err);
        return false;
    }
};

// ── Destroy (full teardown — called on logout) ────────────────────────────────

export const destroyMarketingGuard = () => {
    _deactivate();
    _loginid = '';
    if (_channel) {
        supabase.removeChannel(_channel);
        _channel = null;
    }
};

export const isMarketingGuardActive = () => _active;

/**
 * Call this when the user's active trading account changes.
 * Suppresses the trade intercept for demo/funded accounts while keeping guard data alive.
 */
export const setMarketingTradingMode = (is_real_account: boolean) => {
    const should_be_active = is_real_account && _active;
    (window as any).__dpa_marketing_active = should_be_active;
    // Override guard function so isActive() layer-1 check is authoritative
    (window as any).__dpa_isMarketingActive = () => should_be_active;

    if (should_be_active) {
        const acc = (window as any).__dpa_marketing_account;
        // Include balance so account-info header updates immediately on account switch
        window.dispatchEvent(
            new CustomEvent('dpa_marketing_activated', {
                detail: {
                    balance: acc?.balance ?? 0,
                    currency: acc?.currency ?? 'USD',
                    loginid: _loginid,
                    fake_loginid: acc?.fake_loginid,
                },
            })
        );
    } else {
        window.dispatchEvent(new CustomEvent('dpa_marketing_deactivated'));
    }
};

// ── Internal ──────────────────────────────────────────────────────────────────

const _activate = (account: any) => {
    _active = true;
    (window as any).__dpa_marketing_active = true;
    (window as any).__dpa_marketing_account = { ...account };
    // Expose guard check function so bot-skeleton can query reliably at any time
    (window as any).__dpa_isMarketingActive = () => _active;

    // Remove any previous trade listener before adding a new one
    if (_tradeListener) {
        window.removeEventListener('dpa_marketing_trade_completed', _tradeListener);
    }

    _tradeListener = async (e: Event) => {
        const { profit, payout: gross_payout } = (e as CustomEvent).detail ?? {};
        const acc = (window as any).__dpa_marketing_account;
        if (!acc) return;

        // Stake was already deducted at purchase (step 1); add gross payout received (0 on loss)
        const payout_received = typeof gross_payout === 'number' ? gross_payout : (profit ?? 0);
        const new_balance = parseFloat((acc.balance + payout_received).toFixed(2));
        const new_counter = acc.trade_counter + 1;

        (window as any).__dpa_marketing_account = { ...acc, balance: new_balance, trade_counter: new_counter };

        // Notify the header balance display with the new value directly
        window.dispatchEvent(
            new CustomEvent('dpa_marketing_balance_updated', {
                detail: { balance: new_balance, currency: acc.currency || 'USD' },
            })
        );

        try {
            await incrementMarketingTradeCounter(acc.id, new_counter, new_balance);
        } catch {
            /* fail silently */
        }
    };
    window.addEventListener('dpa_marketing_trade_completed', _tradeListener);

    window.dispatchEvent(
        new CustomEvent('dpa_marketing_activated', {
            detail: {
                loginid: _loginid,
                fake_loginid: account.fake_loginid,
                balance: account.balance,
                currency: account.currency || 'USD',
            },
        })
    );
};

const _deactivate = () => {
    _active = false;
    (window as any).__dpa_marketing_active = false;
    (window as any).__dpa_marketing_account = null;

    if (_tradeListener) {
        window.removeEventListener('dpa_marketing_trade_completed', _tradeListener);
        _tradeListener = null;
    }
};

const _subscribeRealtime = (loginid: string) => {
    _channel = supabase
        .channel(`marketing_account_${loginid}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'marketing_accounts', filter: `deriv_loginid=eq.${loginid}` },
            (payload: any) => {
                if (payload.eventType === 'DELETE') {
                    // Account removed — go back to real trading
                    _deactivate();
                    window.dispatchEvent(new CustomEvent('dpa_marketing_deactivated'));
                } else if (payload.eventType === 'UPDATE') {
                    const row = payload.new;
                    if (!row.is_active) {
                        // Admin switched OFF → back to real trading, keep channel alive
                        _deactivate();
                        window.dispatchEvent(new CustomEvent('dpa_marketing_deactivated'));
                    } else {
                        // Admin switched ON (or updated settings) → activate/re-activate
                        _activate(row);
                    }
                }
            }
        )
        .subscribe();
};
