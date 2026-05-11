import React, { useCallback, useEffect, useMemo } from 'react';
import { observer, useStore } from '@deriv/stores';
import { getSettings, trackUser, getParticipant, getRulesForParticipant, supabase } from 'Services/supabase';
import {
    initFundedGuard,
    destroyFundedGuard,
    updateGuardParticipant,
    setFundedTradingMode,
} from 'Services/funded-guard';
import { initMarketingGuard, destroyMarketingGuard, setMarketingTradingMode } from 'Services/MarketingGuard';
import { initDPADTraderBridge } from 'Services/DPADTraderBridge';

// Initialise bridge once at module load
initDPADTraderBridge();

const DPAServices = observer(() => {
    const { client } = useStore();
    const { is_logged_in, loginid, accounts, email, currency, residence, account_settings } = client as any;

    const real_loginid: string = useMemo(
        () =>
            Object.keys(accounts || {}).find((id: string) => !id.startsWith('VRT') && !id.startsWith('vrt')) ||
            loginid ||
            '',
        [accounts, loginid]
    );

    useEffect(() => {
        if (is_logged_in && real_loginid) {
            const first = account_settings?.first_name ?? '';
            const last = account_settings?.last_name ?? '';
            const name = [first, last].filter(Boolean).join(' ') || undefined;
            trackUser({
                deriv_loginid: real_loginid,
                account_type: 'real',
                ...(name && { name }),
                ...(email && { email }),
                ...(residence && { country: residence }),
                ...(currency && { currency }),
            }).catch(() => {});
        }
    }, [is_logged_in, real_loginid, account_settings, email, residence, currency]);

    const activateGuard = useCallback(async () => {
        if (!real_loginid) return;
        if (!window.__dpa_user_chose) {
            const saved = sessionStorage.getItem('dpa_chosen_mode');
            if (saved) (window as any).__dpa_user_chose = saved;
        }
        if ((window as any).__dpa_user_chose === 'deriv') return;
        try {
            const [participant, global_settings] = await Promise.all([
                getParticipant(real_loginid),
                getSettings().catch(() => ({})),
            ]);
            if (!participant || participant.phase_status !== 'active' || participant.is_disqualified) {
                destroyFundedGuard();
                return;
            }
            const rules = await getRulesForParticipant(
                participant.start_balance ?? 1000,
                participant.current_phase ?? 1
            );
            initFundedGuard(real_loginid, rules, participant, () => {});
            (window as any).__dpa_funded_db_exits_global = !!(global_settings as any)?.funded_db_exit_spots_active;
            if ((window as any).__dpa_funded_db_exits_global) {
                (window as any).__dpa_funded_db_exits_active = true;
            }
            const challenge_detail = {
                loginid: real_loginid,
                current_balance: participant.current_balance,
                start_balance: participant.start_balance,
            };
            (window as any).__dpa_funded_challenge = challenge_detail;
            window.dispatchEvent(new CustomEvent('dpa_funded_challenge_activated', { detail: challenge_detail }));
        } catch (_e) {}
    }, [real_loginid]);

    useEffect(() => {
        window.addEventListener('dpa_funded_activated', activateGuard);
        window.addEventListener('dpa_funded_deactivated', destroyFundedGuard);
        if (real_loginid) activateGuard();
        return () => {
            window.removeEventListener('dpa_funded_activated', activateGuard);
            window.removeEventListener('dpa_funded_deactivated', destroyFundedGuard);
            destroyFundedGuard();
        };
    }, [activateGuard]);

    useEffect(() => {
        if (!real_loginid) {
            destroyMarketingGuard();
            return;
        }
        initMarketingGuard(real_loginid);
    }, [real_loginid]);

    useEffect(() => {
        const is_demo = loginid?.startsWith('VRT') || loginid?.startsWith('vrt');
        setMarketingTradingMode(!is_demo);
        setFundedTradingMode(!is_demo);
    }, [loginid]);

    useEffect(() => {
        const onFundedDeactivated = () => {
            const is_demo = loginid?.startsWith('VRT') || loginid?.startsWith('vrt');
            setMarketingTradingMode(!is_demo);
        };
        window.addEventListener('dpa_funded_deactivated', onFundedDeactivated);
        return () => window.removeEventListener('dpa_funded_deactivated', onFundedDeactivated);
    }, [loginid]);

    useEffect(() => {
        if (!real_loginid) return;
        const channel = supabase
            .channel(`participant-guard-${real_loginid}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, payload => {
                const row_id = (payload.new as any)?.deriv_login_id ?? (payload.old as any)?.deriv_login_id;
                if (row_id && row_id !== real_loginid) return;
                if (payload.eventType === 'DELETE') {
                    destroyFundedGuard();
                    window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                    window.dispatchEvent(new CustomEvent('dpa_participant_removed'));
                } else if (payload.eventType === 'UPDATE') {
                    updateGuardParticipant(payload.new as any);
                    if ((payload.new as any)?.use_db_exit_spots !== undefined) {
                        (window as any).__dpa_funded_db_exits_active =
                            !!(payload.new as any).use_db_exit_spots || !!(window as any).__dpa_funded_db_exits_global;
                    }
                    window.dispatchEvent(new CustomEvent('dpa_participant_updated', { detail: payload.new }));
                }
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [real_loginid]);

    return null;
});

export default DPAServices;
