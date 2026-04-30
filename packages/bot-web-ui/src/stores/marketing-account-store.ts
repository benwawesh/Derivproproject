/**
 * MarketingAccountStore
 * Manages marketing account state — balance, trade history, active mode.
 * Mirrors FundedAccountStore but uses the marketing trade engine.
 */

import { action, computed, makeObservable, observable } from 'mobx';
import { observer as globalObserver, MarketingTradeEngine } from '@deriv/bot-skeleton';

type TradeSettledPayload = {
    trade: Omit<MarketingTrade, 'balance_before' | 'balance_after'>;
};

export interface MarketingTrade {
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

export class MarketingAccountStore {
    @observable is_marketing_mode = false;
    @observable balance = 0;
    @observable initial_balance = 0;
    @observable trades: MarketingTrade[] = [];
    @observable loginid = '';
    @observable fake_loginid = '';
    @observable currency = 'USD';

    constructor() {
        makeObservable(this);

        globalObserver.register('marketing.trade.settled', (payload: TradeSettledPayload) => {
            this.recordTrade(payload.trade as MarketingTrade);
        });

        window.addEventListener('dpa_marketing_activated', (e: Event) => {
            const { loginid, fake_loginid, balance, currency } = (e as CustomEvent).detail;
            this.activate(loginid, fake_loginid, balance, currency);
        });

        window.addEventListener('dpa_marketing_deactivated', () => {
            this.deactivate();
        });

        window.addEventListener('dpa_marketing_updated', (e: Event) => {
            const row = (e as CustomEvent).detail;
            if (row.balance !== undefined) this.balance = row.balance;
        });

        // Race-condition fix: if guard activated before store loaded
        const cached = (window as any).__dpa_marketing_account;
        if ((window as any).__dpa_marketing_active && cached?.deriv_loginid) {
            this.activate(cached.deriv_loginid, cached.fake_loginid, cached.balance, cached.currency);
        }
    }

    @computed get profit_loss() {
        return this.balance - this.initial_balance;
    }
    @computed get total_runs() {
        return this.trades.length;
    }
    @computed get contracts_won() {
        return this.trades.filter(t => t.status === 'won').length;
    }
    @computed get contracts_lost() {
        return this.trades.filter(t => t.status === 'lost').length;
    }

    @action
    activate(loginid: string, fake_loginid: string, balance: number, currency = 'USD') {
        this.loginid = loginid;
        this.fake_loginid = fake_loginid || loginid;
        this.balance = balance;
        this.initial_balance = balance;
        this.currency = currency;
        this.is_marketing_mode = true;
    }

    @action
    deactivate() {
        this.is_marketing_mode = false;
        window.dispatchEvent(new CustomEvent('dpa_marketing_bot_stop'));
    }

    @action
    recordTrade(trade: MarketingTrade) {
        const balance_before = this.balance;
        const new_balance = parseFloat((this.balance + trade.profit).toFixed(2));

        const full_trade: MarketingTrade = { ...trade, balance_before, balance_after: new_balance };
        this.balance = new_balance;
        this.trades.unshift(full_trade);
        if (this.trades.length > 500) this.trades.pop();

        window.dispatchEvent(
            new CustomEvent('dpa_marketing_trade_completed', {
                detail: {
                    loginid: this.loginid,
                    profit: trade.profit,
                    market: trade.symbol,
                    trade_type: trade.contract_type,
                    stake: trade.stake,
                    payout: trade.payout,
                    is_win: trade.status === 'won',
                },
            })
        );

        window.dispatchEvent(
            new CustomEvent('dpa_marketing_balance_updated', {
                detail: { current_balance: new_balance },
            })
        );
    }
}

const marketing_account = new MarketingAccountStore();
export default marketing_account;
