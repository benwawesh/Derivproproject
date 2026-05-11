/**
 * MarketingGuard
 *
 * Checks the DPA backend for an active marketing account assigned to the logged-in user.
 * Sets window.__dpa_marketing_active and window.__dpa_marketing_account so that
 * MarketingTradeEngine (in bot-skeleton) can read them cross-package.
 */

import { getMarketingAccount, incrementMarketingTradeCounter } from './supabase';
import { initDTraderIntercept, destroyDTraderIntercept } from './dtrader-intercept';

let _tradeListener: ((e: Event) => void) | null = null;
let _active = false;
let _loginid = '';

// ── Init ──────────────────────────────────────────────────────────────────────

export const initMarketingGuard = async (loginid: string): Promise<boolean> => {
    if (_loginid === loginid && _active) return true;
    _loginid = loginid;

    try {
        const account = await getMarketingAccount(loginid);

        if (!account || !account.is_active) {
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
};

export const isMarketingGuardActive = () => _active;

/**
 * Call this when the user's active trading account changes.
 * Suppresses the trade intercept for demo/funded accounts while keeping guard data alive.
 */
export const setMarketingTradingMode = (is_real_account: boolean) => {
    const should_be_active = is_real_account && _active;
    (window as any).__dpa_marketing_active = should_be_active;
    (window as any).__dpa_isMarketingActive = () => should_be_active;

    if (should_be_active) {
        const acc = (window as any).__dpa_marketing_account;
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
    (window as any).__dpa_isMarketingActive = () => _active;

    if (_tradeListener) {
        window.removeEventListener('dpa_marketing_trade_completed', _tradeListener);
    }

    _tradeListener = async (_e: Event) => {
        const acc = (window as any).__dpa_marketing_account;
        if (!acc) return;

        // Balance was already updated by the intercept at buy (stake deducted) and
        // at settle (payout added). Here we just bump the counter and persist to DB.
        const new_counter = acc.trade_counter + 1;
        const current_balance = acc.balance;

        (window as any).__dpa_marketing_account = { ...acc, trade_counter: new_counter };

        window.dispatchEvent(
            new CustomEvent('dpa_marketing_balance_updated', {
                detail: { balance: current_balance, currency: acc.currency || 'USD' },
            })
        );

        try {
            await incrementMarketingTradeCounter(acc.id, new_counter, current_balance);
        } catch {
            /* fail silently */
        }
    };
    window.addEventListener('dpa_marketing_trade_completed', _tradeListener);

    /* Enable DTrader manual trading interception */
    initDTraderIntercept();

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

    /* Disable DTrader interception only if funded mode is also off */
    if (!(window as any).__dpa_funded_active) {
        destroyDTraderIntercept();
    }
};
