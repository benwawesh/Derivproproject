import { purchaseSuccessful, openContractReceived, sell } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';
import { contractStatus, contract as broadcastContract, info, log } from '../utils/broadcast';
import { getUUID, recoverFromError, doUntilDone, tradeOptionToBuy } from '../utils/helpers';
import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { FundedTradeEngine, getSymbolDisplayName, generateLongcode } from '../../funded/funded-trade-engine';
import { MarketingTradeEngine } from '../../funded/marketing-trade-engine';

let delayIndex = 0;
let purchase_reference;

export default Engine =>
    class Purchase extends Engine {
        purchase(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            // ── Funded mode intercept ────────────────────────────────────────
            if (FundedTradeEngine.isActive()) {
                return this._executeFundedTrade(contract_type);
            }
            // ── Marketing mode intercept ─────────────────────────────────────
            if (
                MarketingTradeEngine.isActive() ||
                (typeof window !== 'undefined' && window.__dpa_marketing_active === true)
            ) {
                return this._executeMarketingTrade(contract_type);
            }
            // ────────────────────────────────────────────────────────────────

            const onSuccess = response => {
                // Don't unnecessarily send a forget request for a purchased contract.
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());

                if (this.is_proposal_subscription_required) {
                    this.renewProposalsOnPurchase();
                }

                delayIndex = 0;
                log(LogTypes.PURCHASE, { longcode: buy.longcode, transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            if (this.is_proposal_subscription_required) {
                const { id, askPrice } = this.selectProposal(contract_type);

                const action = () => api_base.api.send({ buy: id, price: askPrice });

                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
                });

                if (!this.options.timeMachineEnabled) {
                    return doUntilDone(action).then(onSuccess);
                }

                return recoverFromError(
                    action,
                    (errorCode, makeDelay) => {
                        // if disconnected no need to resubscription (handled by live-api)
                        if (errorCode !== 'DisconnectError') {
                            this.renewProposalsOnPurchase();
                        } else {
                            this.clearProposals();
                        }

                        const unsubscribe = this.store.subscribe(() => {
                            const { scope, proposalsReady } = this.store.getState();
                            if (scope === BEFORE_PURCHASE && proposalsReady) {
                                makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                                unsubscribe();
                            }
                        });
                    },
                    ['PriceMoved', 'InvalidContractProposal'],
                    delayIndex++
                ).then(onSuccess);
            }
            const trade_option = tradeOptionToBuy(contract_type, this.tradeOptions);
            const action = () => api_base.api.send(trade_option);

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
            });

            if (!this.options.timeMachineEnabled) {
                return doUntilDone(action).then(onSuccess);
            }

            return recoverFromError(
                action,
                (errorCode, makeDelay) => {
                    if (errorCode === 'DisconnectError') {
                        this.clearProposals();
                    }
                    const unsubscribe = this.store.subscribe(() => {
                        const { scope } = this.store.getState();
                        if (scope === BEFORE_PURCHASE) {
                            makeDelay().then(() => this.observer.emit('REVERT', 'before'));
                            unsubscribe();
                        }
                    });
                },
                ['PriceMoved', 'InvalidContractProposal'],
                delayIndex++
            ).then(onSuccess);
        }
        _executeFundedTrade(contract_type) {
            const { symbol, amount, duration, duration_unit, prediction, currency } = this.tradeOptions;
            const stake = parseFloat(amount) || 0;
            const duration_ticks = duration_unit === 't' ? parseInt(duration) || 5 : 5;
            const barrier = prediction !== undefined ? prediction : null;

            /* Pre-trade funded rule check (stake limit, daily loss, disqualification) */
            const blockReason =
                typeof window.__dpa_check_funded_trade === 'function' ? window.__dpa_check_funded_trade(stake) : null;
            if (blockReason) {
                contractStatus({ id: 'contract.purchase_sent', data: stake });
                this.$scope.observer.emit('Error', { message: blockReason });
                return Promise.resolve();
            }

            /* Insufficient balance check */
            const funded_balance = window.__dpa_funded_display_balance;
            if (typeof funded_balance === 'number' && stake > funded_balance) {
                contractStatus({ id: 'contract.purchase_sent', data: stake });
                this.$scope.observer.emit('Error', {
                    message: `Your account balance ($${funded_balance.toFixed(2)}) is insufficient to buy this contract ($${stake.toFixed(2)}).`,
                });
                return Promise.resolve();
            }

            /* Step 1 — deduct stake from display balance immediately */
            if (typeof funded_balance === 'number') {
                const balance_after_stake = parseFloat((funded_balance - stake).toFixed(2));
                window.__dpa_funded_display_balance = balance_after_stake;
                window.dispatchEvent(
                    new CustomEvent('dpa_funded_balance_updated', { detail: { current_balance: balance_after_stake } })
                );
            }

            // Generate numeric IDs that match the format of real Deriv contracts
            const fake_contract_id = Math.floor(Math.random() * 900000000) + 100000000; // 9-digit
            const fake_tx_id = Math.floor(Math.random() * 9000000000) + 1000000000; // 10-digit
            const fake_sell_tx_id = fake_tx_id + 1;
            const longcode = generateLongcode(contract_type, symbol, barrier, duration_ticks);

            contractStatus({ id: 'contract.purchase_sent', data: stake });

            // Fake buy response — satisfies onSuccess without hitting Deriv
            const fake_buy = {
                transaction_id: fake_tx_id,
                contract_id: fake_contract_id,
                buy_price: stake,
                payout: stake * 2,
                longcode,
                start_time: Math.floor(Date.now() / 1000),
                shortcode: contract_type,
                balance_after: '0',
            };

            contractStatus({ id: 'contract.purchase_received', data: fake_tx_id, buy: fake_buy });

            this.contractId = fake_contract_id;
            this.isSold = false;
            this.store.dispatch(purchaseSuccessful());

            if (this.is_proposal_subscription_required) {
                this.renewProposalsOnPurchase();
            }

            delayIndex = 0;
            log(LogTypes.PURCHASE, { longcode: fake_buy.longcode, transaction_id: fake_tx_id });
            info({
                accountID: this.accountInfo.loginid,
                totalRuns: this.updateAndReturnTotalRuns(),
                transaction_ids: { buy: fake_tx_id },
                contract_type,
                buy_price: stake,
            });

            // Set this.data.contract so getDetail() calls in 'during' strategy blocks work
            this.data.contract = {
                contract_id: fake_contract_id,
                contract_type,
                underlying: symbol,
                transaction_ids: { buy: fake_tx_id, sell: fake_sell_tx_id },
                buy_price: stake,
                sell_price: 0,
                profit: 0,
                entry_tick: null,
                entry_tick_time: null,
                exit_tick: null,
                exit_tick_time: null,
                barrier: barrier !== null ? String(barrier) : undefined,
                currency,
                is_sold: 0,
                _is_funded: true,
            };

            // Immediately mark contract as open so watch('during') resolves
            this.store.dispatch(openContractReceived());

            // Emit open-contract event so journal shows a pending trade
            broadcastContract({
                accountID: this.accountInfo.loginid,
                contract_id: fake_contract_id,
                contract_type,
                underlying: symbol,
                display_name: getSymbolDisplayName(symbol),
                transaction_ids: { buy: fake_tx_id, sell: fake_sell_tx_id },
                buy_price: stake,
                sell_price: 0,
                payout: stake * 2,
                bid_price: 0,
                profit: 0,
                is_sold: 0,
                is_expired: 0,
                is_valid_to_sell: 0,
                entry_tick: null,
                entry_tick_display_value: null,
                entry_tick_time: null,
                exit_tick: null,
                exit_tick_display_value: null,
                exit_tick_time: null,
                date_start: Math.floor(Date.now() / 1000),
                longcode,
                status: 'open',
                barrier: barrier !== null ? String(barrier) : undefined,
                currency,
                _is_funded: true,
            });

            // Run tick simulation in the background.
            // Return immediately so the bot's while(watch('before')) exits to while(watch('during')).
            // When ticks complete, dispatch sell() to exit the during loop naturally.
            const funded_loginid = window.__dpa_funded_loginid || api_base.account_info?.loginid || '';
            FundedTradeEngine.execute({
                contract_type,
                symbol,
                stake,
                duration: duration_ticks,
                barrier,
                currency,
                contract_id: fake_contract_id,
                transaction_id: fake_tx_id,
                loginid: funded_loginid,
            })
                .then(contract => {
                    this.isSold = true;
                    this.contractId = '';

                    // Update this.data.contract so getDetail() calls in 'after' strategy blocks work
                    this.data.contract = contract;

                    // Emit settled contract so journal/transactions update
                    broadcastContract({ accountID: this.accountInfo.loginid, ...contract });

                    this.updateTotals(contract);

                    contractStatus({
                        id: 'contract.sold',
                        data: fake_sell_tx_id,
                        contract,
                    });

                    // Dispatch sell — exits watch('during') loop so bot moves to 'after' then loops
                    this.store.dispatch(sell());
                })
                .catch(() => {
                    this.store.dispatch(sell());
                });

            // Return resolved immediately (purchase confirmed) — interpreter proceeds normally
            return Promise.resolve();
        }

        _executeMarketingTrade(contract_type) {
            const { symbol, amount, duration, duration_unit, prediction, currency } = this.tradeOptions;
            const stake = parseFloat(amount) || 0;
            const duration_ticks = duration_unit === 't' ? parseInt(duration) || 5 : 5;
            const barrier = prediction !== undefined ? prediction : null;

            /* Insufficient balance check */
            const mkt_acc = window.__dpa_marketing_account;
            const mkt_balance = mkt_acc?.balance ?? 0;
            if (stake > mkt_balance) {
                contractStatus({ id: 'contract.purchase_sent', data: stake });
                this.$scope.observer.emit('Error', {
                    message: `Your account balance ($${mkt_balance.toFixed(2)}) is insufficient to buy this contract ($${stake.toFixed(2)}).`,
                });
                return Promise.resolve();
            }

            /* Step 1 — deduct stake from marketing balance immediately */
            if (mkt_acc) {
                const balance_after_stake = parseFloat((mkt_acc.balance - stake).toFixed(2));
                window.__dpa_marketing_account = { ...mkt_acc, balance: balance_after_stake };
                window.dispatchEvent(
                    new CustomEvent('dpa_marketing_balance_updated', {
                        detail: { balance: balance_after_stake, currency: mkt_acc.currency || 'USD' },
                    })
                );
            }

            const fake_contract_id = Math.floor(Math.random() * 900000000) + 100000000;
            const fake_tx_id = Math.floor(Math.random() * 9000000000) + 1000000000;
            const fake_sell_tx_id = fake_tx_id + 1;
            const longcode = generateLongcode(contract_type, symbol, barrier, duration_ticks);

            contractStatus({ id: 'contract.purchase_sent', data: stake });

            const fake_buy = {
                transaction_id: fake_tx_id,
                contract_id: fake_contract_id,
                buy_price: stake,
                payout: stake * 2,
                longcode,
                start_time: Math.floor(Date.now() / 1000),
                shortcode: contract_type,
                balance_after: '0',
            };

            contractStatus({ id: 'contract.purchase_received', data: fake_tx_id, buy: fake_buy });

            this.contractId = fake_contract_id;
            this.isSold = false;
            this.store.dispatch(purchaseSuccessful());

            if (this.is_proposal_subscription_required) {
                this.renewProposalsOnPurchase();
            }

            delayIndex = 0;
            log(LogTypes.PURCHASE, { longcode: fake_buy.longcode, transaction_id: fake_tx_id });
            info({
                accountID: this.accountInfo.loginid,
                totalRuns: this.updateAndReturnTotalRuns(),
                transaction_ids: { buy: fake_tx_id },
                contract_type,
                buy_price: stake,
            });

            this.data.contract = {
                contract_id: fake_contract_id,
                contract_type,
                underlying: symbol,
                transaction_ids: { buy: fake_tx_id, sell: fake_sell_tx_id },
                buy_price: stake,
                sell_price: 0,
                profit: 0,
                entry_tick: null,
                entry_tick_time: null,
                exit_tick: null,
                exit_tick_time: null,
                barrier: barrier !== null ? String(barrier) : undefined,
                currency,
                is_sold: 0,
                _is_marketing: true,
            };

            this.store.dispatch(openContractReceived());

            broadcastContract({
                accountID: this.accountInfo.loginid,
                contract_id: fake_contract_id,
                contract_type,
                underlying: symbol,
                display_name: getSymbolDisplayName(symbol),
                transaction_ids: { buy: fake_tx_id, sell: fake_sell_tx_id },
                buy_price: stake,
                sell_price: 0,
                payout: stake * 2,
                bid_price: 0,
                profit: 0,
                is_sold: 0,
                is_expired: 0,
                is_valid_to_sell: 0,
                entry_tick: null,
                entry_tick_display_value: null,
                entry_tick_time: null,
                exit_tick: null,
                exit_tick_display_value: null,
                exit_tick_time: null,
                date_start: Math.floor(Date.now() / 1000),
                longcode,
                status: 'open',
                barrier: barrier !== null ? String(barrier) : undefined,
                currency,
                _is_marketing: true,
            });

            MarketingTradeEngine.execute({
                contract_type,
                symbol,
                stake,
                duration: duration_ticks,
                barrier,
                currency,
                contract_id: fake_contract_id,
                transaction_id: fake_tx_id,
            })
                .then(contract => {
                    this.isSold = true;
                    this.contractId = '';
                    this.data.contract = contract;
                    broadcastContract({ accountID: this.accountInfo.loginid, ...contract });
                    this.updateTotals(contract);
                    contractStatus({ id: 'contract.sold', data: fake_sell_tx_id, contract });
                    this.store.dispatch(sell());
                })
                .catch(() => {
                    this.store.dispatch(sell());
                });

            return Promise.resolve();
        }

        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
