import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { CSSTransition } from 'react-transition-group';
import { Icon, Text } from '@deriv/components';
import { Localize, localize } from '@deriv/translations';
import { getCurrencyDisplayCode } from '@deriv/shared';
import { useDevice } from '@deriv-com/ui';
import AccountSwitcher from 'App/Containers/AccountSwitcher';
import AccountSwitcherMobile from 'App/Containers/AccountSwitcher/account-switcher-mobile';
import AccountInfoWrapper from './account-info-wrapper';
import AccountInfoIcon from './account-info-icon';

// ── DPA funded mode hook — fully DB-driven, no localStorage ──────────────────
import { useStore } from '@deriv/stores';
import { getParticipant, supabase } from 'Services/supabase';

// ── Marketing display hook — reads window globals set by MarketingGuard ───────
const _getMarketingState = () => ({
    is_active: !!(window.__dpa_marketing_active && window.__dpa_marketing_account),
    balance: window.__dpa_marketing_account?.balance ?? 0,
    currency: window.__dpa_marketing_account?.currency ?? 'USD',
});

const useMarketingDisplay = () => {
    const [mkt, setMkt] = React.useState(_getMarketingState);

    React.useEffect(() => {
        // Always re-read from window globals — avoids race conditions with event detail timing
        const sync = () => setMkt(_getMarketingState());

        window.addEventListener('dpa_marketing_activated', sync);
        window.addEventListener('dpa_marketing_deactivated', sync);
        window.addEventListener('dpa_marketing_balance_updated', sync);
        window.addEventListener('dpa_funded_deactivated', sync);

        // Sync once on mount in case the event already fired before this effect ran
        sync();

        return () => {
            window.removeEventListener('dpa_marketing_activated', sync);
            window.removeEventListener('dpa_marketing_deactivated', sync);
            window.removeEventListener('dpa_marketing_balance_updated', sync);
            window.removeEventListener('dpa_funded_deactivated', sync);
        };
    }, []);

    return { is_marketing: mkt.is_active, marketing_balance: mkt.balance, marketing_currency: mkt.currency };
};

const useFundedDisplay = () => {
    const { client } = useStore();
    const { loginid, accounts } = client;
    const [is_funded, setIsFunded] = React.useState(false);
    const [funded_balance, setFundedBalance] = React.useState(0);

    React.useEffect(() => {
        if (!loginid) return;
        const real_id =
            Object.keys(accounts || {}).find(id => !id.startsWith('VRT') && !id.startsWith('vrt')) || loginid;

        // Use window.__dpa_user_chose (survives re-mounts) to guard against
        // async DB calls re-activating funded mode after the user switched away.
        getParticipant(real_id)
            .then(p => {
                const user_chose = window.__dpa_user_chose;
                if (p && p.phase_status === 'active' && !p.is_disqualified) {
                    setFundedBalance(p.current_balance ?? 0);
                    // Auto-activate only if user hasn't explicitly switched away
                    if (!user_chose || user_chose === 'funded') {
                        setIsFunded(true);
                    }
                } else {
                    if (!user_chose || user_chose !== 'funded') {
                        setIsFunded(false);
                    }
                }
            })
            .catch(() => {});

        // Real-time: balance updates + admin remove push via WebSocket
        const channel = supabase
            .channel(`account_info_${real_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, payload => {
                const row_id = payload.new?.deriv_login_id ?? payload.old?.deriv_login_id;
                if (row_id && row_id !== real_id) return;
                if (payload.eventType === 'DELETE') {
                    // Admin removed — always deactivate
                    window.__dpa_user_chose = null;
                    setIsFunded(false);
                    setFundedBalance(0);
                } else if (payload.eventType === 'UPDATE') {
                    const p = payload.new;
                    if (p.phase_status === 'active' && !p.is_disqualified) {
                        setFundedBalance(p.current_balance ?? 0);
                    } else {
                        window.__dpa_user_chose = null;
                        setIsFunded(false);
                        setFundedBalance(0);
                    }
                }
            })
            .subscribe();

        // Manual switch from account switcher
        const onActivated = () => {
            window.__dpa_user_chose = 'funded';
            setIsFunded(true);
        };
        const onDeactivated = () => {
            window.__dpa_user_chose = 'deriv';
            setIsFunded(false);
        };
        // Balance update after each funded trade (dispatched by FundedAccountStore.recordTrade)
        const onBalanceUpdate = e => {
            const { current_balance } = e.detail ?? {};
            if (typeof current_balance === 'number') setFundedBalance(current_balance);
        };
        window.addEventListener('dpa_funded_activated', onActivated);
        window.addEventListener('dpa_funded_deactivated', onDeactivated);
        window.addEventListener('dpa_funded_balance_updated', onBalanceUpdate);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('dpa_funded_activated', onActivated);
            window.removeEventListener('dpa_funded_deactivated', onDeactivated);
            window.removeEventListener('dpa_funded_balance_updated', onBalanceUpdate);
        };
    }, [loginid, accounts]);

    return { is_funded, funded_balance };
};

const AccountInfo = ({
    acc_switcher_disabled_message,
    balance,
    currency,
    disableApp,
    enableApp,
    is_dialog_on,
    is_virtual,
    toggleDialog,
    is_disabled,
    is_mobile,
}) => {
    const currency_lower = currency?.toLowerCase();
    const { isDesktop } = useDevice();
    const { is_funded, funded_balance } = useFundedDisplay();
    const { is_marketing, marketing_balance, marketing_currency } = useMarketingDisplay();

    return (
        <div className='acc-info__wrapper'>
            {isDesktop && <div className='acc-info__separator' />}
            <AccountInfoWrapper
                is_disabled={is_disabled}
                disabled_message={acc_switcher_disabled_message}
                is_mobile={is_mobile}
            >
                <div
                    data-testid='dt_acc_info'
                    id='dt_core_account-info_acc-info'
                    className={classNames('acc-info', {
                        'acc-info--show': is_dialog_on,
                        'acc-info--is-virtual': is_virtual,
                        'acc-info--is-disabled': is_disabled,
                    })}
                    onClick={is_disabled ? undefined : () => toggleDialog()}
                >
                    <span className='acc-info__id'>
                        {!is_marketing && is_funded ? (
                            <div
                                style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 4,
                                    background: '#e8a000',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 900,
                                    fontSize: 13,
                                }}
                            >
                                F
                            </div>
                        ) : isDesktop ? (
                            <AccountInfoIcon is_virtual={is_virtual} currency={currency_lower} />
                        ) : (
                            (is_virtual || currency) && (
                                <AccountInfoIcon is_virtual={is_virtual} currency={currency_lower} />
                            )
                        )}
                    </span>
                    <div className='acc-info__content'>
                        <div className='acc-info__account-type-header'>
                            <Text as='p' size='xxs' className='acc-info__account-type'>
                                {is_marketing
                                    ? localize('Real')
                                    : is_funded
                                      ? 'Funded'
                                      : is_virtual
                                        ? localize('Demo')
                                        : localize('Real')}
                            </Text>
                            {is_disabled ? (
                                <Icon
                                    data_testid='dt_lock_icon'
                                    icon='IcLock'
                                    className='acc-info__select-arrow'
                                    size={12}
                                />
                            ) : (
                                <Icon
                                    data_testid='dt_select_arrow'
                                    icon='IcChevronDownBold'
                                    className='acc-info__select-arrow'
                                    size={12}
                                />
                            )}
                        </div>
                        {(typeof balance !== 'undefined' || !currency) && (
                            <div className='acc-info__balance-section'>
                                <p
                                    data-testid='dt_balance'
                                    className={classNames('acc-info__balance', {
                                        'acc-info__balance--no-currency': !currency && !is_virtual,
                                    })}
                                >
                                    {is_marketing ? (
                                        `$${marketing_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${marketing_currency}`
                                    ) : is_funded ? (
                                        `$${funded_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                                    ) : !currency ? (
                                        <Localize i18n_default_text='No currency assigned' />
                                    ) : (
                                        `${balance} ${getCurrencyDisplayCode(currency)}`
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </AccountInfoWrapper>
            <div className='acc-info__separator' />
            {isDesktop ? (
                <CSSTransition
                    in={is_dialog_on}
                    timeout={200}
                    classNames={{
                        enter: 'acc-switcher__wrapper--enter',
                        enterDone: 'acc-switcher__wrapper--enter-done',
                        exit: 'acc-switcher__wrapper--exit',
                    }}
                    unmountOnExit
                >
                    <div className='acc-switcher__wrapper'>
                        <AccountSwitcher is_visible={is_dialog_on} toggle={toggleDialog} />
                    </div>
                </CSSTransition>
            ) : (
                <AccountSwitcherMobile
                    is_visible={is_dialog_on}
                    disableApp={disableApp}
                    enableApp={enableApp}
                    toggle={toggleDialog}
                />
            )}
        </div>
    );
};

AccountInfo.propTypes = {
    acc_switcher_disabled_message: PropTypes.string,
    balance: PropTypes.string,
    currency: PropTypes.string,
    disableApp: PropTypes.func,
    enableApp: PropTypes.func,
    is_dialog_on: PropTypes.bool,
    is_disabled: PropTypes.bool,
    is_virtual: PropTypes.bool,
    is_mobile: PropTypes.bool,
    loginid: PropTypes.string,
    toggleDialog: PropTypes.func,
};

export default AccountInfo;
