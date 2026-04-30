import { getFormattedText } from '@deriv/shared';
import { info } from '../utils/broadcast';
import DBotStore from '../../../scratch/dbot-store';
import { api_base } from '../../api/api-base';

let balance_string = '';

export default Engine =>
    class Balance extends Engine {
        observeBalance() {
            if (!api_base.api) return;
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data?.msg_type === 'balance' && data?.balance) {
                    const {
                        balance: { balance: b, currency },
                    } = data;

                    balance_string = getFormattedText(b, currency);

                    if (this.accountInfo) info({ accountID: this.accountInfo.loginid, balance: balance_string });
                }
            });
            api_base.pushSubscription(subscription);
        }

        // eslint-disable-next-line class-methods-use-this
        getBalance(type) {
            const { client } = DBotStore.instance;

            // Marketing mode: use the simulated account balance
            if (typeof window !== 'undefined' && window.__dpa_marketing_active && window.__dpa_marketing_account) {
                const acc = window.__dpa_marketing_account;
                const balance = acc.balance ?? 0;
                const currency = acc.currency || client.currency || 'USD';
                balance_string = getFormattedText(balance, currency, false);
                return type === 'STR' ? balance_string : balance;
            }

            const balance = (client && client.balance) || 0;
            balance_string = getFormattedText(balance, client.currency, false);
            return type === 'STR' ? balance_string : balance;
        }
    };
