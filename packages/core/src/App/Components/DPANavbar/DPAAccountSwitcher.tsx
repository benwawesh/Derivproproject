import React, { useEffect, useRef, useState } from 'react';
import { observer, useStore } from '@deriv/stores';
import { formatMoney } from '@deriv/shared';
import { useHistory } from 'react-router-dom';
import { getParticipant, supabase } from '../../../Services/supabase';

const LS_ACTIVE = 'dpa_funded_mode_active';
const LS_ACTIVE_ACC = 'dpa_active_account';

type FundedData = { loginid: string; current_balance: number; start_balance: number } | null;

const DPAAccountSwitcher = observer(() => {
    const history = useHistory();
    const { client } = useStore() as any;
    const { accounts, loginid: active_loginid, switchAccount, is_virtual, balance, currency } = client;

    const [open, setOpen] = useState(false);
    const [is_funded, setIsFunded] = useState(() => localStorage.getItem(LS_ACTIVE_ACC) === 'funded');
    const [funded_data, setFundedData] = useState<FundedData>(null);
    const ref = useRef<HTMLDivElement>(null);

    // ── Marketing mode ────────────────────────────────────────────────────
    const _getMktState = () => ({
        active: !!(window as any).__dpa_marketing_active && !!(window as any).__dpa_marketing_account,
        balance: (window as any).__dpa_marketing_account?.balance ?? 0,
        currency: (window as any).__dpa_marketing_account?.currency ?? 'USD',
    });

    const [mkt_state, setMktState] = useState(_getMktState);
    const is_marketing = mkt_state.active;
    const marketing_balance = mkt_state.balance;
    const marketing_currency = mkt_state.currency;

    useEffect(() => {
        const sync = () => setMktState(_getMktState());
        window.addEventListener('dpa_marketing_activated', sync);
        window.addEventListener('dpa_marketing_deactivated', sync);
        window.addEventListener('dpa_marketing_balance_updated', sync);
        // Sync immediately on mount — catches events that fired before this effect ran
        sync();
        return () => {
            window.removeEventListener('dpa_marketing_activated', sync);
            window.removeEventListener('dpa_marketing_deactivated', sync);
            window.removeEventListener('dpa_marketing_balance_updated', sync);
        };
    }, []);

    // Keep is_funded in sync with localStorage whenever active_loginid changes
    // (handles external account switches, page reloads, Deriv store updates)
    useEffect(() => {
        const active = localStorage.getItem(LS_ACTIVE_ACC) === 'funded';
        setIsFunded(active);
        if (active) {
            localStorage.setItem(LS_ACTIVE, 'true');
        }
    }, [active_loginid]);

    // Load funded balance from Supabase (single source of truth across all browsers)
    useEffect(() => {
        if (!active_loginid) return;

        // Find real account ID (CR/MF prefix) — never use VRTC
        const all_ids = Object.keys(accounts || {});
        const real_id = all_ids.find((id: string) => !id.startsWith('VRT') && !id.startsWith('vrt')) || active_loginid;

        // Initial load
        getParticipant(real_id)
            .then(p => {
                if (p) {
                    const d = { loginid: real_id, current_balance: p.current_balance, start_balance: p.start_balance };
                    setFundedData(d);
                }
            })
            .catch(() => {});

        // Real-time subscription — balance updates instantly when trades are recorded
        const channel = supabase
            .channel(`participant_balance_${real_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'challenge_participants',
                    filter: `deriv_login_id=eq.${real_id}`,
                },
                (payload: any) => {
                    const p = payload.new;
                    setFundedData({
                        loginid: real_id,
                        current_balance: p.current_balance,
                        start_balance: p.start_balance,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [active_loginid, accounts]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectDeriv = async (loginid: string) => {
        // Deactivate funded mode
        localStorage.setItem(LS_ACTIVE_ACC, 'deriv');
        localStorage.removeItem(LS_ACTIVE);
        setIsFunded(false);
        setOpen(false);
        // Tell FundedAccountStore to deactivate toggle in bot builder
        window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
        if (loginid !== active_loginid) await switchAccount(loginid);
    };

    const selectFunded = () => {
        localStorage.setItem(LS_ACTIVE_ACC, 'funded');
        localStorage.setItem(LS_ACTIVE, 'true');
        setIsFunded(true);
        setOpen(false);
        // Auto-activate the FUNDED MODE toggle in the bot builder
        try {
            const cached = localStorage.getItem('dpa_funded_challenge');
            if (cached) {
                const d = JSON.parse(cached);
                window.dispatchEvent(new CustomEvent('dpa_funded_challenge_activated', { detail: d }));
            }
        } catch {}
    };

    // Build account list from Deriv store
    const account_list: { loginid: string; is_virtual: boolean; balance: number; currency: string }[] = Object.entries(
        accounts || {}
    ).map(([id, acc]: [string, any]) => ({
        loginid: id,
        is_virtual: acc.is_virtual,
        balance: acc.balance ?? 0,
        currency: acc.currency ?? '',
    }));

    // Current display values
    const funded_balance = funded_data?.current_balance ?? 0;
    const deriv_balance = formatMoney(currency, balance, true);

    const current_label = is_marketing ? 'Real' : is_funded ? 'Funded' : is_virtual ? 'Demo' : 'Real';
    const current_balance = is_marketing
        ? `$${marketing_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${marketing_currency}`
        : is_funded
          ? `$${funded_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `${deriv_balance} ${currency}`;

    return (
        <div className='dpa-acc-switcher' ref={ref}>
            {/* Trigger button — same layout as Deriv acc-info */}
            <div className='dpa-acc-switcher__trigger' onClick={() => setOpen(o => !o)}>
                <div
                    className={`dpa-acc-switcher__icon dpa-acc-switcher__icon--${is_funded ? 'funded' : is_virtual ? 'demo' : 'real'}`}
                >
                    {is_funded ? 'F' : is_virtual ? 'D' : (currency?.slice(0, 1) ?? 'R')}
                </div>
                <div className='dpa-acc-switcher__info'>
                    <span className='dpa-acc-switcher__type'>
                        {current_label}
                        <svg width='10' height='6' viewBox='0 0 10 6' style={{ marginLeft: 4 }}>
                            <path
                                d='M1 1l4 4 4-4'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                fill='none'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            />
                        </svg>
                    </span>
                    <span className='dpa-acc-switcher__balance'>{current_balance}</span>
                </div>
            </div>

            {/* Dropdown */}
            {open && (
                <div className='dpa-acc-switcher__dropdown'>
                    <div className='dpa-acc-switcher__section-title'>Deriv accounts</div>

                    {account_list.map(acc => (
                        <div
                            key={acc.loginid}
                            className={`dpa-acc-switcher__item${acc.loginid === active_loginid && !is_funded ? ' dpa-acc-switcher__item--active' : ''}`}
                            onClick={() => selectDeriv(acc.loginid)}
                        >
                            <div
                                className={`dpa-acc-switcher__icon dpa-acc-switcher__icon--${acc.is_virtual ? 'demo' : 'real'}`}
                            >
                                {acc.is_virtual ? 'D' : (acc.currency?.slice(0, 1) ?? 'R')}
                            </div>
                            <div className='dpa-acc-switcher__item-info'>
                                <span className='dpa-acc-switcher__item-type'>
                                    {acc.is_virtual ? 'Demo' : 'Real'} · {acc.loginid}
                                </span>
                                <span className='dpa-acc-switcher__item-balance'>
                                    {is_marketing && !acc.is_virtual
                                        ? `$${marketing_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${marketing_currency}`
                                        : `${formatMoney(acc.currency, acc.balance, true)} ${acc.currency}`}
                                </span>
                            </div>
                            {acc.loginid === active_loginid && !is_funded && (
                                <svg className='dpa-acc-switcher__check' width='14' height='14' viewBox='0 0 14 14'>
                                    <path
                                        d='M2 7l4 4 6-6'
                                        stroke='#85acb0'
                                        strokeWidth='2'
                                        fill='none'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    />
                                </svg>
                            )}
                        </div>
                    ))}

                    {/* Funded account — always visible */}
                    <div className='dpa-acc-switcher__section-title'>DPA funded account</div>
                    {funded_data ? (
                        <div
                            className={`dpa-acc-switcher__item dpa-acc-switcher__item--funded${is_funded ? ' dpa-acc-switcher__item--active' : ''}`}
                            onClick={selectFunded}
                        >
                            <div className='dpa-acc-switcher__icon dpa-acc-switcher__icon--funded'>F</div>
                            <div className='dpa-acc-switcher__item-info'>
                                <span className='dpa-acc-switcher__item-type'>Funded · {funded_data.loginid}</span>
                                <span className='dpa-acc-switcher__item-balance'>
                                    $
                                    {funded_balance.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}{' '}
                                    USD
                                </span>
                            </div>
                            {is_funded && (
                                <svg className='dpa-acc-switcher__check' width='14' height='14' viewBox='0 0 14 14'>
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
                            className='dpa-acc-switcher__item dpa-acc-switcher__item--funded-cta'
                            onClick={() => {
                                setOpen(false);
                                window.location.href = '/challenge';
                            }}
                        >
                            <div className='dpa-acc-switcher__icon dpa-acc-switcher__icon--funded'>F</div>
                            <div className='dpa-acc-switcher__item-info'>
                                <span className='dpa-acc-switcher__item-type'>Funded Account</span>
                                <span className='dpa-acc-switcher__item-balance dpa-acc-switcher__item-balance--cta'>
                                    Start Challenge →
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default DPAAccountSwitcher;
