import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { getParticipant, supabase } from 'Services/supabase';
import {
    Button,
    DesktopWrapper,
    MobileWrapper,
    Div100vhContainer,
    Icon,
    Money,
    Tabs,
    ThemedScrollbars,
    Text,
    useOnClickOutside,
    Loading,
} from '@deriv/components';
import { observer, useStore } from '@deriv/stores';
import { routes, formatMoney, ContentFlag } from '@deriv/shared';
import { localize, Localize } from '@deriv/translations';
import { useHasSetCurrency } from '@deriv/hooks';
import { getAccountTitle } from 'App/Containers/RealAccountSignup/helpers/constants';
import { BinaryLink } from 'App/Components/Routes';
import AccountList from './account-switcher-account-list.jsx';
import AccountWrapper from './account-switcher-account-wrapper.jsx';
import { getSortedAccountList, getSortedCFDList, isDemo } from './helpers';

const AccountSwitcher = observer(({ history, is_mobile, is_visible }) => {
    const { client, ui, traders_hub } = useStore();
    const {
        available_crypto_currencies,
        loginid: account_loginid,
        accounts,
        account_type,
        account_list,
        currency,
        is_eu,
        is_landing_company_loaded,
        is_low_risk,
        is_high_risk,
        is_logged_in,
        is_virtual,
        has_fiat,
        mt5_login_list,
        obj_total_balance,
        switchAccount,
        resetVirtualBalance,
        has_active_real_account,
        upgradeable_landing_companies,
        real_account_creation_unlock_date,
        has_any_real_account,
        virtual_account_loginid,
        has_maltainvest_account,
    } = client;
    const { show_eu_related_content, content_flag, selectRegion, setTogglePlatformType } = traders_hub;
    const {
        is_dark_mode_on,
        openRealAccountSignup,
        toggleAccountsDialog,
        toggleSetCurrencyModal,
        should_show_real_accounts_list,
        setShouldShowCooldownModal,
    } = ui;
    const [active_tab_index, setActiveTabIndex] = React.useState(
        window.__dpa_user_chose === 'funded' ? 2 : !is_virtual || should_show_real_accounts_list ? 0 : 1
    );
    const [is_deriv_demo_visible, setDerivDemoVisible] = React.useState(true);
    const [is_deriv_real_visible, setDerivRealVisible] = React.useState(true);
    const [is_non_eu_regulator_visible, setNonEuRegulatorVisible] = React.useState(true);
    const [is_eu_regulator_visible, setEuRegulatorVisible] = React.useState(true);

    // ── DPA Funded Account — fully DB-driven, no localStorage ────────
    const [funded_data, setFundedData] = React.useState(null);
    const [is_funded_selected, setIsFundedSelected] = React.useState(
        () => window.__dpa_user_chose === 'funded' || sessionStorage.getItem('dpa_chosen_mode') === 'funded'
    );

    // ── DPA Marketing mode ────────────────────────────────────────
    const _getMktSnap = () => ({
        active: !!(window.__dpa_marketing_active && window.__dpa_marketing_account),
        balance: window.__dpa_marketing_account?.balance ?? 0,
    });
    const [mkt, setMkt] = React.useState(_getMktSnap);
    const is_marketing = mkt.active;
    const marketing_balance = mkt.balance;
    // Show marketing balance for any real (non-virtual) account row if marketing account data
    // exists — even when currently on demo, so the preview already shows the correct balance.
    const mkt_balance_for = acc_loginid =>
        !!window.__dpa_marketing_account &&
        acc_loginid &&
        !acc_loginid.startsWith('VRT') &&
        !acc_loginid.startsWith('vrt')
            ? (window.__dpa_marketing_account?.balance ?? 0)
            : null;

    React.useEffect(() => {
        const sync = () => setMkt(_getMktSnap());
        window.addEventListener('dpa_marketing_activated', sync);
        window.addEventListener('dpa_marketing_deactivated', sync);
        window.addEventListener('dpa_marketing_balance_updated', sync);
        sync();
        return () => {
            window.removeEventListener('dpa_marketing_activated', sync);
            window.removeEventListener('dpa_marketing_deactivated', sync);
            window.removeEventListener('dpa_marketing_balance_updated', sync);
        };
    }, []);

    // When on Real tab from funded, show the CR account as selected so user can click it
    const real_cr_loginid =
        Object.keys(accounts || {}).find(id => !id.startsWith('VRT') && !id.startsWith('vrt')) || account_loginid;
    const displayed_loginid = is_funded_selected ? (active_tab_index === 0 ? real_cr_loginid : null) : account_loginid;

    React.useEffect(() => {
        if (!account_loginid) return;
        const real_id =
            Object.keys(accounts || {}).find(id => !id.startsWith('VRT') && !id.startsWith('vrt')) || account_loginid;

        // Restore session-level choice on mount/remount (sessionStorage survives refresh)
        if (!window.__dpa_user_chose) {
            const saved = sessionStorage.getItem('dpa_chosen_mode');
            if (saved) window.__dpa_user_chose = saved;
        }

        // Load participant from DB.
        // window.__dpa_user_chose: 'funded' | 'deriv' | null/undefined
        getParticipant(real_id)
            .then(p => {
                const user_chose = window.__dpa_user_chose;
                if (p && p.phase_status === 'active' && !p.is_disqualified) {
                    setFundedData({ loginid: real_id, current_balance: p.current_balance, phase: p.current_phase });
                    if (!user_chose || user_chose === 'funded') {
                        // First load OR returning to funded after re-mount — restore selection
                        setIsFundedSelected(true);
                        window.dispatchEvent(new CustomEvent('dpa_funded_activated'));
                        // Tell FundedAccountStore so the journal banner shows immediately
                        window.dispatchEvent(
                            new CustomEvent('dpa_funded_challenge_activated', {
                                detail: {
                                    loginid: real_id,
                                    current_balance: p.current_balance,
                                    start_balance: p.start_balance ?? p.current_balance,
                                },
                            })
                        );
                    }
                } else {
                    setFundedData(null);
                    setIsFundedSelected(false);
                    if (!user_chose || user_chose === 'funded') {
                        window.__dpa_user_chose = null;
                        window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                    }
                }
            })
            .catch(() => {});

        // Real-time: push DB changes instantly across all browsers
        const channel = supabase
            .channel(`acc_switcher_${real_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, payload => {
                const row_id = payload.new?.deriv_login_id ?? payload.old?.deriv_login_id;
                if (row_id && row_id !== real_id) return;

                if (payload.eventType === 'DELETE') {
                    setFundedData(null);
                    setIsFundedSelected(false);
                    window.__dpa_user_chose = null;
                    sessionStorage.removeItem('dpa_chosen_mode');
                    window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                } else if (payload.eventType === 'UPDATE') {
                    const p = payload.new;
                    if (p.phase_status === 'active' && !p.is_disqualified) {
                        setFundedData({ loginid: real_id, current_balance: p.current_balance, phase: p.current_phase });
                        window.dispatchEvent(
                            new CustomEvent('dpa_funded_challenge_activated', {
                                detail: {
                                    loginid: real_id,
                                    current_balance: p.current_balance,
                                    start_balance: p.start_balance ?? p.current_balance,
                                },
                            })
                        );
                    } else {
                        setFundedData(null);
                        setIsFundedSelected(false);
                        window.__dpa_user_chose = null;
                        sessionStorage.removeItem('dpa_chosen_mode');
                        window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [account_loginid, accounts]);

    const selectFunded = () => {
        window.__dpa_user_chose = 'funded';
        sessionStorage.setItem('dpa_chosen_mode', 'funded');
        setIsFundedSelected(true);
        setActiveTabIndex(2);
        closeAccountsDialog();
        // Suppress marketing display when switching to funded
        window.__dpa_marketing_active = false;
        if (typeof window.__dpa_isMarketingActive === 'function') window.__dpa_isMarketingActive = () => false;
        window.dispatchEvent(new CustomEvent('dpa_marketing_deactivated'));
        window.dispatchEvent(new CustomEvent('dpa_funded_activated'));
        // Directly fire challenge_activated so FundedAccountStore banner shows immediately
        if (funded_data) {
            window.dispatchEvent(
                new CustomEvent('dpa_funded_challenge_activated', {
                    detail: {
                        loginid: funded_data.loginid,
                        current_balance: funded_data.current_balance,
                        start_balance: funded_data.current_balance,
                    },
                })
            );
        }
    };

    const selectDeriv = loginid_to_switch => {
        window.__dpa_user_chose = 'deriv';
        sessionStorage.setItem('dpa_chosen_mode', 'deriv');
        setIsFundedSelected(false);
        window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
        // Reactivate marketing if an account is assigned (same real loginid, no loginid change fires)
        const mkt_acc = window.__dpa_marketing_account;
        if (mkt_acc) {
            window.__dpa_marketing_active = true;
            window.__dpa_isMarketingActive = () => true;
            window.dispatchEvent(
                new CustomEvent('dpa_marketing_activated', {
                    detail: { balance: mkt_acc.balance, currency: mkt_acc.currency || 'USD' },
                })
            );
        }
        doSwitch(loginid_to_switch);
    };

    const wrapper_ref = React.useRef();
    const scroll_ref = React.useRef(null);

    const account_total_balance_currency = obj_total_balance.currency;

    const vrtc_loginid = account_list.find(account => account.is_virtual)?.loginid;
    const vrtc_currency = accounts[vrtc_loginid] ? accounts[vrtc_loginid].currency : 'USD';

    const toggleVisibility = section => {
        switch (section) {
            case 'demo_deriv':
                return setDerivDemoVisible(!is_deriv_demo_visible);
            case 'real_deriv':
                return setDerivRealVisible(!is_deriv_real_visible);
            case 'non-eu-regulator':
                return setNonEuRegulatorVisible(!is_non_eu_regulator_visible);
            case 'eu-regulator':
                return setEuRegulatorVisible(!is_eu_regulator_visible);
            default:
                return false;
        }
    };

    const closeAccountsDialog = () => {
        toggleAccountsDialog(false);
    };

    const validateClickOutside = event => is_visible && !event.target.classList.contains('acc-info');

    useOnClickOutside(wrapper_ref, closeAccountsDialog, validateClickOutside);

    const setAccountCurrency = () => {
        closeAccountsDialog();
        toggleSetCurrencyModal();
    };

    const doSwitch = async loginid => {
        closeAccountsDialog();
        if (account_loginid === loginid) return;
        await switchAccount(loginid);
    };

    const resetBalance = async () => {
        closeAccountsDialog();
        resetVirtualBalance();
    };

    // Real accounts is always the first tab index based on design
    const isRealAccountTab = active_tab_index === 0;
    const isDemoAccountTab = active_tab_index === 1;
    const isFundedTab = active_tab_index === 2;

    const getRealMT5 = () => {
        if (is_landing_company_loaded) {
            const low_risk_non_eu = content_flag === ContentFlag.LOW_RISK_CR_NON_EU;
            if (low_risk_non_eu) {
                return getSortedCFDList(mt5_login_list).filter(
                    account => !isDemo(account) && account.landing_company_short !== 'maltainvest'
                );
            }
            return getSortedCFDList(mt5_login_list).filter(account => !isDemo(account));
        }
        return [];
    };

    const canOpenMulti = () => {
        if (available_crypto_currencies.length < 1 && !has_fiat) return true;
        return !is_virtual;
    };

    // SVG clients can't upgrade.
    const getRemainingRealAccounts = () => {
        if (show_eu_related_content || is_virtual || !canOpenMulti() || is_low_risk) {
            return upgradeable_landing_companies;
        }
        return [];
    };

    const hasSetCurrency = useHasSetCurrency();

    const getTotalDemoAssets = () => {
        const vrtc_balance = accounts[vrtc_loginid] ? accounts[vrtc_loginid].balance : 0;

        return vrtc_balance;
    };

    const getTotalRealAssets = () => {
        const traders_hub_total = obj_total_balance.amount_real;
        return traders_hub_total;
    };

    if (!is_logged_in) return false;

    const canResetBalance = account => {
        const account_init_balance = 10000;
        return account?.is_virtual && account?.balance !== account_init_balance;
    };

    const checkMultipleSvgAcc = () => {
        const all_svg_acc = [];
        getRealMT5().map(acc => {
            if (acc.landing_company_short === 'svg' && acc.market_type === 'synthetic') {
                if (all_svg_acc.length) {
                    all_svg_acc.forEach(svg_acc => {
                        if (svg_acc.server !== acc.server) all_svg_acc.push(acc);
                        return all_svg_acc;
                    });
                } else {
                    all_svg_acc.push(acc);
                }
            }
        });
        return all_svg_acc.length > 1;
    };

    const have_more_accounts = type =>
        getSortedAccountList(account_list, accounts).filter(
            account => !account.is_virtual && account.loginid.startsWith(type)
        ).length > 1;

    // all: 1 in mt5_status response means that server is suspended
    const has_cr_account = account_list.find(acc => acc.loginid?.startsWith('CR'))?.loginid;

    const demo_account = (
        <div className='acc-switcher__list-wrapper'>
            {vrtc_loginid && (
                <AccountWrapper
                    header={localize('Deriv account')}
                    is_visible={is_deriv_demo_visible}
                    toggleVisibility={() => {
                        toggleVisibility('demo_deriv');
                    }}
                >
                    <div className='acc-switcher__accounts'>
                        {getSortedAccountList(account_list, accounts)
                            .filter(account => account.is_virtual)
                            .map(account => (
                                <AccountList
                                    is_dark_mode_on={is_dark_mode_on}
                                    key={account.loginid}
                                    balance={accounts[account.loginid].balance}
                                    currency={accounts[account.loginid].currency}
                                    currency_icon={`IcCurrency-${account.icon}`}
                                    display_type={'currency'}
                                    has_balance={'balance' in accounts[account.loginid]}
                                    has_reset_balance={canResetBalance(accounts[account_loginid])}
                                    is_disabled={account.is_disabled}
                                    is_virtual={account.is_virtual}
                                    loginid={account.loginid}
                                    product={account.product}
                                    redirectAccount={
                                        account.is_disabled ? undefined : () => selectDeriv(account.loginid)
                                    }
                                    onClickResetVirtualBalance={resetBalance}
                                    selected_loginid={displayed_loginid}
                                />
                            ))}
                    </div>
                </AccountWrapper>
            )}
        </div>
    );

    const real_accounts = (
        <div ref={scroll_ref} className='acc-switcher__list-wrapper'>
            <React.Fragment>
                {!is_eu || is_low_risk ? (
                    <AccountWrapper
                        className='acc-switcher__title'
                        header={
                            is_low_risk && has_maltainvest_account
                                ? localize(`Non-EU Deriv ${have_more_accounts('CR') ? 'accounts' : 'account'}`)
                                : localize(`Deriv ${have_more_accounts('CR') ? 'accounts' : 'account'}`)
                        }
                        is_visible={is_non_eu_regulator_visible}
                        toggleVisibility={() => {
                            toggleVisibility('real_deriv');
                        }}
                    >
                        <div className='acc-switcher__accounts'>
                            {getSortedAccountList(account_list, accounts)
                                .filter(account => !account.is_virtual && account.loginid.startsWith('CR'))
                                .map(account => {
                                    return (
                                        <AccountList
                                            account_type={account_type}
                                            is_dark_mode_on={is_dark_mode_on}
                                            key={account.loginid}
                                            balance={
                                                mkt_balance_for(account.loginid) ?? accounts[account.loginid].balance
                                            }
                                            currency={accounts[account.loginid].currency}
                                            currency_icon={`IcCurrency-${account.icon}`}
                                            display_type={'currency'}
                                            has_balance={'balance' in accounts[account.loginid]}
                                            is_disabled={account.is_disabled}
                                            is_virtual={account.is_virtual}
                                            is_eu={is_eu}
                                            loginid={account.loginid}
                                            redirectAccount={
                                                account.is_disabled ? undefined : () => selectDeriv(account.loginid)
                                            }
                                            selected_loginid={displayed_loginid}
                                            should_show_server_name={checkMultipleSvgAcc()}
                                        />
                                    );
                                })}
                        </div>
                        {!has_cr_account &&
                            getRemainingRealAccounts()
                                .filter(account => account === 'svg')
                                .map((account, index) => (
                                    <div key={index} className='acc-switcher__new-account'>
                                        <Icon icon='IcDeriv' size={24} />
                                        <Text size='xs' color='general' className='acc-switcher__new-account-text'>
                                            {getAccountTitle(account)}
                                        </Text>
                                        <Button
                                            id='dt_core_account-switcher_add-new-account'
                                            onClick={() => {
                                                if (real_account_creation_unlock_date) {
                                                    closeAccountsDialog();
                                                    setShouldShowCooldownModal(true);
                                                } else {
                                                    selectRegion('Non-EU');
                                                    openRealAccountSignup('svg');
                                                }
                                            }}
                                            className='acc-switcher__new-account-btn'
                                            secondary
                                            small
                                        >
                                            {localize('Add')}
                                        </Button>
                                    </div>
                                ))}
                    </AccountWrapper>
                ) : null}
                {(!is_high_risk && has_maltainvest_account) || is_eu ? (
                    <AccountWrapper
                        header={
                            is_low_risk && has_maltainvest_account
                                ? localize(`EU Deriv ${have_more_accounts('MF') ? 'accounts' : 'account'}`)
                                : localize(`Deriv ${have_more_accounts('MF') ? 'accounts' : 'account'}`)
                        }
                        is_visible={is_eu_regulator_visible}
                        toggleVisibility={() => {
                            toggleVisibility('real_deriv');
                        }}
                    >
                        <div className='acc-switcher__accounts'>
                            {getSortedAccountList(account_list, accounts)
                                .filter(account => !account.is_virtual && account.loginid.startsWith('MF'))
                                .map(account => {
                                    return (
                                        <AccountList
                                            account_type={account_type}
                                            is_dark_mode_on={is_dark_mode_on}
                                            key={account.loginid}
                                            balance={
                                                mkt_balance_for(account.loginid) ?? accounts[account.loginid].balance
                                            }
                                            currency={accounts[account.loginid].currency}
                                            currency_icon={`IcCurrency-${account.icon}`}
                                            display_type={'currency'}
                                            has_balance={'balance' in accounts[account.loginid]}
                                            is_disabled={account.is_disabled}
                                            is_virtual={account.is_virtual}
                                            is_eu={is_eu}
                                            loginid={account.loginid}
                                            redirectAccount={
                                                account.is_disabled ? undefined : () => selectDeriv(account.loginid)
                                            }
                                            selected_loginid={displayed_loginid}
                                            should_show_server_name={checkMultipleSvgAcc()}
                                        />
                                    );
                                })}
                        </div>
                        {getRemainingRealAccounts()
                            .filter(account => account === 'maltainvest')
                            .map((account, index) => {
                                return (
                                    <div key={index} className='acc-switcher__new-account'>
                                        <Icon icon='IcDeriv' size={24} />
                                        <Text size='xs' color='general' className='acc-switcher__new-account-text'>
                                            {getAccountTitle(account)}
                                        </Text>
                                        <Button
                                            id='dt_core_account-switcher_add-new-account'
                                            onClick={() => {
                                                if (real_account_creation_unlock_date) {
                                                    closeAccountsDialog();
                                                    setShouldShowCooldownModal(true);
                                                } else {
                                                    selectRegion('EU');
                                                    openRealAccountSignup('maltainvest');
                                                }
                                            }}
                                            className='acc-switcher__new-account-btn'
                                            secondary
                                            small
                                        >
                                            {localize('Add')}
                                        </Button>
                                    </div>
                                );
                            })}
                    </AccountWrapper>
                ) : null}
            </React.Fragment>
        </div>
    );

    const first_real_login_id = account_list?.find(account => /^(CR|MF)/.test(account.loginid))?.loginid;

    const TradersHubRedirect = () => {
        const TradersHubLink = () => {
            const handleRedirect = async () => {
                if (!is_virtual && isDemoAccountTab) {
                    await switchAccount(virtual_account_loginid);
                } else if (is_virtual && isRealAccountTab) {
                    await switchAccount(first_real_login_id);
                }
                toggleAccountsDialog(false);
                localStorage.setItem('redirect_to_th_os', 'home');
                history.push(routes.traders_hub);
                setTogglePlatformType('cfd');
            };

            return (
                <React.Fragment>
                    <div className='acc-switcher__traders-hub'>
                        <BinaryLink onClick={handleRedirect} className='acc-switcher__traders-hub--link'>
                            <Text size='xs' align='center' className='acc-switcher__traders-hub--text'>
                                <Localize i18n_default_text="Looking for CFD accounts? Go to Trader's Hub" />
                            </Text>
                        </BinaryLink>
                    </div>
                </React.Fragment>
            );
        };

        if ((isRealAccountTab && has_any_real_account) || isDemoAccountTab) {
            return <TradersHubLink />;
        }

        return null;
    };

    return (
        <div className='acc-switcher__list' ref={wrapper_ref} data-testid='acc-switcher'>
            {is_landing_company_loaded ? (
                <React.Fragment>
                    <Tabs
                        active_index={active_tab_index}
                        className='acc-switcher__list-tabs'
                        onTabItemClick={index => {
                            setActiveTabIndex(index);
                            const currently_funded = is_funded_selected || window.__dpa_user_chose === 'funded';
                            if (index !== 2 && currently_funded) {
                                const real_id =
                                    Object.keys(accounts || {}).find(
                                        id => !id.startsWith('VRT') && !id.startsWith('vrt')
                                    ) || account_loginid;
                                const target_id = index === 1 ? virtual_account_loginid : real_id;

                                // Prevent funded guard from re-activating during the switch
                                window.__dpa_user_chose = 'deriv';
                                sessionStorage.setItem('dpa_chosen_mode', 'deriv');
                                setIsFundedSelected(false);

                                const deactivate = () => {
                                    window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                                    closeAccountsDialog();
                                };

                                if (target_id && target_id !== account_loginid) {
                                    // Switch account FIRST so is_virtual is already correct
                                    // when dpa_funded_deactivated fires — header jumps directly
                                    // from "Funded" to "Demo"/"Real" with no flash
                                    switchAccount(target_id).then(deactivate).catch(deactivate);
                                } else {
                                    // Already on target account — just deactivate
                                    deactivate();
                                }
                            }
                        }}
                        top
                    >
                        {/* TODO: De-couple and refactor demo and real accounts groups
                        into a single reusable AccountListItem component */}
                        <div label={localize('Real')} id='real_account_tab'>
                            <DesktopWrapper>
                                <ThemedScrollbars height='354px'>{real_accounts}</ThemedScrollbars>
                            </DesktopWrapper>
                            <MobileWrapper>
                                <Div100vhContainer
                                    className='acc-switcher__list-container'
                                    max_autoheight_offset='234px'
                                >
                                    {real_accounts}
                                </Div100vhContainer>
                            </MobileWrapper>
                        </div>
                        <div label={localize('Demo')} id='dt_core_account-switcher_demo-tab'>
                            <DesktopWrapper>
                                <ThemedScrollbars height='354px'>{demo_account}</ThemedScrollbars>
                            </DesktopWrapper>
                            <MobileWrapper>
                                <Div100vhContainer
                                    className='acc-switcher__list-container'
                                    max_autoheight_offset='234px'
                                >
                                    {demo_account}
                                </Div100vhContainer>
                            </MobileWrapper>
                        </div>
                        <div label={localize('Funded')} id='dt_core_account-switcher_funded-tab'>
                            <DesktopWrapper>
                                <ThemedScrollbars height='354px'>
                                    <div className='acc-switcher__list-wrapper'>
                                        {funded_data ? (
                                            <div
                                                className={`acc-switcher__account${is_funded_selected ? ' acc-switcher__account--selected' : ''}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '10px 16px',
                                                    cursor: 'pointer',
                                                    background: is_funded_selected
                                                        ? 'var(--general-hover)'
                                                        : 'transparent',
                                                }}
                                                onClick={selectFunded}
                                            >
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
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    F
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: 'var(--text-prominent)',
                                                        }}
                                                    >
                                                        Funded · {funded_data.loginid}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-general)' }}>
                                                        $
                                                        {funded_data.current_balance.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}{' '}
                                                        USD
                                                    </div>
                                                </div>
                                                {is_funded_selected && (
                                                    <svg width='14' height='14' viewBox='0 0 14 14'>
                                                        <path
                                                            d='M2 7l4 4 6-6'
                                                            stroke='#e8a000'
                                                            strokeWidth='2'
                                                            fill='none'
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                        />
                                                    </svg>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '10px 16px',
                                                    cursor: 'pointer',
                                                }}
                                                onClick={() => {
                                                    closeAccountsDialog();
                                                    window.location.href = '/challenge';
                                                }}
                                            >
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
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    F
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: 'var(--text-prominent)',
                                                        }}
                                                    >
                                                        Get Funded Account
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#e8a000' }}>
                                                        Start Challenge →
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ThemedScrollbars>
                            </DesktopWrapper>
                            <MobileWrapper>
                                <Div100vhContainer
                                    className='acc-switcher__list-container'
                                    max_autoheight_offset='234px'
                                >
                                    <div className='acc-switcher__list-wrapper'>
                                        {funded_data ? (
                                            <div
                                                className={`acc-switcher__account${is_funded_selected ? ' acc-switcher__account--selected' : ''}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '10px 16px',
                                                    cursor: 'pointer',
                                                    background: is_funded_selected
                                                        ? 'var(--general-hover)'
                                                        : 'transparent',
                                                }}
                                                onClick={selectFunded}
                                            >
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
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    F
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: 'var(--text-prominent)',
                                                        }}
                                                    >
                                                        Funded · {funded_data.loginid}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-general)' }}>
                                                        $
                                                        {funded_data.current_balance.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}{' '}
                                                        USD
                                                    </div>
                                                </div>
                                                {is_funded_selected && (
                                                    <svg width='14' height='14' viewBox='0 0 14 14'>
                                                        <path
                                                            d='M2 7l4 4 6-6'
                                                            stroke='#e8a000'
                                                            strokeWidth='2'
                                                            fill='none'
                                                            strokeLinecap='round'
                                                            strokeLinejoin='round'
                                                        />
                                                    </svg>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '10px 16px',
                                                    cursor: 'pointer',
                                                }}
                                                onClick={() => {
                                                    closeAccountsDialog();
                                                    window.location.href = '/challenge';
                                                }}
                                            >
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
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    F
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            color: 'var(--text-prominent)',
                                                        }}
                                                    >
                                                        Get Funded Account
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#e8a000' }}>
                                                        Start Challenge →
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Div100vhContainer>
                            </MobileWrapper>
                        </div>
                    </Tabs>
                    <div
                        className={classNames('acc-switcher__separator', {
                            'acc-switcher__separator--auto-margin': is_mobile,
                        })}
                    />
                    <div className='acc-switcher__total'>
                        <Text line_height='s' size='xs' weight='bold' color='prominent'>
                            <Localize i18n_default_text='Total assets' />
                        </Text>
                        <Text size='xs' color='prominent' className='acc-switcher__balance'>
                            {isFundedTab ? (
                                <span>
                                    {funded_data
                                        ? `$${funded_data.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                                        : '$0.00 USD'}
                                </span>
                            ) : (
                                <Money
                                    currency={isRealAccountTab ? account_total_balance_currency : vrtc_currency}
                                    amount={formatMoney(
                                        isRealAccountTab ? account_total_balance_currency : vrtc_currency,
                                        isRealAccountTab
                                            ? (window.__dpa_marketing_account?.balance ?? getTotalRealAssets())
                                            : getTotalDemoAssets(),
                                        true
                                    )}
                                    show_currency
                                    should_format={false}
                                />
                            )}
                        </Text>
                    </div>
                    <Text color='less-prominent' line_height='xs' size='xxxs' className='acc-switcher__total-subtitle'>
                        {isFundedTab
                            ? localize('Total assets in your Funded account.')
                            : localize('Total assets in your Deriv accounts.')}
                    </Text>
                    <div className='acc-switcher__separator' />
                    <TradersHubRedirect />

                    {isRealAccountTab && has_active_real_account && !is_virtual && (
                        <>
                            <div className='acc-switcher__separator' />
                            <div className='acc-switcher__footer'>
                                <Button
                                    className='acc-switcher__btn--traders_hub'
                                    secondary
                                    onClick={
                                        has_any_real_account && (!hasSetCurrency || !currency)
                                            ? setAccountCurrency
                                            : () => openRealAccountSignup('manage')
                                    }
                                >
                                    {localize('Manage accounts')}
                                </Button>
                            </div>
                        </>
                    )}
                </React.Fragment>
            ) : (
                <Loading is_fullscreen={false} />
            )}
        </div>
    );
});

AccountSwitcher.propTypes = {
    is_visible: PropTypes.bool,
    history: PropTypes.object,
};

export default withRouter(AccountSwitcher);
