/**
 * FundedAccountStore
 * Manages funded account state — balance, trade history, active mode.
 * Balance and trades are stored in localStorage per user so they persist across sessions.
 */

import { action, computed, makeObservable, observable } from 'mobx';
import { observer as globalObserver, FundedTradeEngine } from '@deriv/bot-skeleton';

type FundedTradeSettledPayload = {
    trade: Omit<FundedTrade, 'balance_before' | 'balance_after'>;
};

const STORAGE_KEY = 'funded_account';

export interface FundedTrade {
    id: string;
    timestamp: number;
    symbol: string;
    contract_type: string;
    stake: number;
    payout: number;
    profit: number;
    status: 'won' | 'lost';
    entry_spot: number;
    exit_spot: number;
    entry_digit: number;
    exit_digit: number;
    duration_ticks: number;
    prediction: number | null;
    balance_before: number;
    balance_after: number;
}

export interface FundedAccountData {
    balance: number;
    initial_balance: number;
    trades: FundedTrade[];
    user_id: string;
    activated_at: number;
}

const INITIAL_BALANCE = 10000;

export class FundedAccountStore {
    // ── Observable state ──────────────────────────────────────────────────────
    @observable is_funded_mode = false;
    @observable balance = INITIAL_BALANCE;
    @observable initial_balance = INITIAL_BALANCE;
    @observable trades: FundedTrade[] = [];
    @observable user_id = '';

    constructor() {
        makeObservable(this);
        // Listen for trades settled by FundedTradeEngine (in bot-skeleton)
        globalObserver.register('funded.trade.settled', (payload: FundedTradeSettledPayload) => {
            this.recordTrade(payload.trade as FundedTrade);
        });
        // Listen for challenge activation from Challenge page OR navbar switcher
        window.addEventListener('dpa_funded_challenge_activated', (e: Event) => {
            const { loginid, current_balance, start_balance } = (e as CustomEvent).detail;
            this.initFromChallenge(loginid, current_balance, start_balance);
        });
        // Set is_funded_mode immediately when user picks Funded tab (before balance data arrives)
        window.addEventListener('dpa_funded_activated', () => {
            this.is_funded_mode = true;
        });
        // Listen for deactivation when user switches back to Demo/Real
        window.addEventListener('dpa_funded_deactivated', () => {
            this.deactivate();
        });
        // If funded guard is already active when the bot loads (race condition fix):
        // DPANavbar caches challenge detail on window.__dpa_funded_challenge before firing the event.
        // We read it here so FundedAccountStore initialises correctly even if the event fired first.
        const cached_challenge = (window as any).__dpa_funded_challenge;
        if ((window as any).__dpa_funded_active && cached_challenge?.loginid) {
            this.initFromChallenge(
                cached_challenge.loginid,
                cached_challenge.current_balance,
                cached_challenge.start_balance
            );
        }
    }

    // ── Computed ──────────────────────────────────────────────────────────────

    @computed get profit_loss() {
        return this.balance - this.initial_balance;
    }

    @computed get profit_loss_percent() {
        return (this.profit_loss / this.initial_balance) * 100;
    }

    @computed get total_stake() {
        return this.trades.reduce((s, t) => s + t.stake, 0);
    }

    @computed get total_payout() {
        return this.trades.reduce((s, t) => s + (t.status === 'won' ? t.payout : 0), 0);
    }

    @computed get contracts_won() {
        return this.trades.filter(t => t.status === 'won').length;
    }

    @computed get contracts_lost() {
        return this.trades.filter(t => t.status === 'lost').length;
    }

    @computed get total_runs() {
        return this.trades.length;
    }

    @computed get win_rate() {
        if (this.total_runs === 0) return 0;
        return (this.contracts_won / this.total_runs) * 100;
    }

    // Max drawdown: how far balance has dropped from peak
    @computed get max_drawdown_percent() {
        let peak = this.initial_balance;
        let max_dd = 0;
        let running = this.initial_balance;
        this.trades.forEach(t => {
            running = t.balance_after;
            if (running > peak) peak = running;
            const dd = ((peak - running) / peak) * 100;
            if (dd > max_dd) max_dd = dd;
        });
        return max_dd;
    }

    @computed get is_account_blown() {
        // Account blown if balance drops 10% below initial
        return this.balance < this.initial_balance * 0.9;
    }

    @computed get profit_target_reached() {
        // Profit target: 15% gain
        return this.balance >= this.initial_balance * 1.15;
    }

    @computed get daily_trades() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.trades.filter(t => t.timestamp >= today.getTime());
    }

    @computed get daily_profit_loss() {
        return this.daily_trades.reduce((s, t) => s + t.profit, 0);
    }

    @computed get daily_loss_limit_reached() {
        // Daily loss limit: 5% of initial balance
        return this.daily_profit_loss < -(this.initial_balance * 0.05);
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    @action
    initFromChallenge(user_id: string, current_balance: number, start_balance: number) {
        this.user_id = user_id;
        this.balance = current_balance;
        this.initial_balance = start_balance;
        this.is_funded_mode = true;
        // Expose display balance for Purchase.js balance checks and step-1 deductions
        (window as any).__dpa_funded_display_balance = current_balance;
    }

    @action
    activate(user_id: string) {
        this.user_id = user_id;
        this.load(user_id);
        this.is_funded_mode = true;
    }

    @action
    deactivate() {
        this.is_funded_mode = false;
        FundedTradeEngine.deactivate(); // cancels any in-flight tick subscription
        // Stop any running bot so it doesn't continue funded trades on the new account
        window.dispatchEvent(new CustomEvent('dpa_funded_bot_stop'));
    }

    @action
    load(user_id: string) {
        try {
            const raw = localStorage.getItem(`${STORAGE_KEY}_${user_id}`);
            if (raw) {
                const data: FundedAccountData = JSON.parse(raw);
                this.balance = data.balance;
                this.initial_balance = data.initial_balance;
                this.trades = data.trades || [];
                this.user_id = data.user_id;
            } else {
                // First time — fresh account
                this.balance = INITIAL_BALANCE;
                this.initial_balance = INITIAL_BALANCE;
                this.trades = [];
                this.user_id = user_id;
                this.save();
            }
        } catch {
            this.balance = INITIAL_BALANCE;
            this.initial_balance = INITIAL_BALANCE;
            this.trades = [];
        }
    }

    @action
    recordTrade(trade: FundedTrade) {
        const balance_before = this.balance;
        const new_balance = this.balance + trade.profit;

        const full_trade: FundedTrade = {
            ...trade,
            balance_before,
            balance_after: new_balance,
        };

        this.balance = new_balance;
        (window as any).__dpa_funded_display_balance = new_balance;
        this.trades.unshift(full_trade);

        // Keep last 500 trades
        if (this.trades.length > 500) this.trades.pop();

        this.save();

        // Dispatch event so AppContent can record to Supabase
        window.dispatchEvent(
            new CustomEvent('dpa_funded_trade_completed', {
                detail: {
                    loginid: this.user_id,
                    contract_id: trade.id,
                    market: trade.symbol,
                    trade_type: trade.contract_type,
                    stake: trade.stake,
                    payout: trade.payout,
                    profit: trade.profit,
                    is_win: trade.status === 'won',
                },
            })
        );

        // Notify header to update funded balance display in real-time
        window.dispatchEvent(
            new CustomEvent('dpa_funded_balance_updated', {
                detail: { current_balance: new_balance },
            })
        );
    }

    @action
    reset() {
        this.balance = INITIAL_BALANCE;
        this.initial_balance = INITIAL_BALANCE;
        this.trades = [];
        this.save();
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    save() {
        if (!this.user_id) return;
        const data: FundedAccountData = {
            balance: this.balance,
            initial_balance: this.initial_balance,
            trades: this.trades,
            user_id: this.user_id,
            activated_at: Date.now(),
        };
        localStorage.setItem(`${STORAGE_KEY}_${this.user_id}`, JSON.stringify(data));
    }
}

// Singleton
const funded_account = new FundedAccountStore();
export default funded_account;
