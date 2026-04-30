import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { observer, useStore } from '@deriv/stores';
import { routes } from '@deriv/shared';
import { getSettings, trackUser, getParticipant, getRulesForParticipant, supabase } from 'Services/supabase';
import { initFundedGuard, destroyFundedGuard, updateGuardParticipant, AlertType } from 'Services/funded-guard';
import { initMarketingGuard, destroyMarketingGuard, setMarketingTradingMode } from 'Services/MarketingGuard';
import { initDPADTraderBridge } from 'Services/DPADTraderBridge';
import './dpa-navbar.scss';

// Initialise bridge once at module load — exposes window.__dpa_execute_dtrader_trade
initDPADTraderBridge();

// ── Nav Items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
    { label: 'Home', path: '/' },
    { label: 'Challenge 🔥', path: '/challenge' },
    { label: 'Leaderboard', path: '/leaderboard' },
    { label: 'Free Bots', path: '/free-bots' },
    { label: 'Super Bots ⭐', path: '/superbot' },
    { label: 'Copy Trading', path: '/copy-trading' },
    { label: 'Analysis Tool', path: '/analysis' },
    { label: 'Strategies', path: '/strategies' },
    { label: 'Risk Calculator', path: '/risk-calculator' },
    { label: 'My Reports', path: routes.my_reports },
    { label: 'Bot Builder', path: routes.bot },
    { label: 'D-Trader', path: routes.trade },
];

// ── Countdown ─────────────────────────────────────────────────────────────────
const getCompetitionEnd = (duration: string) => {
    const now = new Date();
    if (duration === 'weekly') {
        const end = new Date(now);
        end.setDate(now.getDate() + (7 - now.getDay()));
        end.setHours(23, 59, 59, 0);
        return end;
    }
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
};

const useCountdown = (endDate: Date) => {
    const calc = () => {
        const diff = endDate.getTime() - Date.now();
        if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
        return {
            days: Math.floor(diff / 86400000),
            hours: Math.floor((diff % 86400000) / 3600000),
            mins: Math.floor((diff % 3600000) / 60000),
        };
    };
    const [time, setTime] = useState(calc);
    useEffect(() => {
        const t = setInterval(() => setTime(calc()), 60000);
        return () => clearInterval(t);
    }, [endDate]);
    return time;
};

// ── Funded Guard Alert overlay ────────────────────────────────────────────────
type GuardAlert = { message: string; type: AlertType; title?: string } | null;

const GuardAlertOverlay = ({ alert, onClose }: { alert: GuardAlert; onClose: () => void }) => {
    if (!alert) return null;
    const is_blocked = alert.type === 'blocked';
    const is_passed = alert.type === 'passed';
    const default_title = is_blocked ? 'Trade Blocked' : is_passed ? 'Phase Passed!' : 'Warning';
    const display_title = alert.title ?? default_title;
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
            }}
        >
            <div
                style={{
                    background: '#1a1f23',
                    border: `2px solid ${is_blocked ? '#ff444f' : is_passed ? '#16a534' : '#e8a000'}`,
                    borderRadius: 12,
                    padding: '32px 36px',
                    maxWidth: 420,
                    textAlign: 'center',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                }}
            >
                <div style={{ fontSize: 40, marginBottom: 12 }}>{is_blocked ? '🚫' : is_passed ? '🎉' : '⚠️'}</div>
                <h3
                    style={{
                        color: is_blocked ? '#ff444f' : is_passed ? '#16a534' : '#e8a000',
                        fontSize: 18,
                        marginBottom: 12,
                        fontWeight: 700,
                    }}
                >
                    {display_title}
                </h3>
                <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{alert.message}</p>
                <button
                    onClick={onClose}
                    style={{
                        background: is_blocked ? '#ff444f' : is_passed ? '#16a534' : '#e8a000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '10px 28px',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    OK
                </button>
            </div>
        </div>
    );
};

// ── Navbar ────────────────────────────────────────────────────────────────────
const DEFAULT_ANNOUNCEMENT =
    'Monthly competition now LIVE · Top 10 traders win funded accounts up to $10,000 · Join for FREE · No deposit required · Bot trading allowed';

const DPANavbar = observer(() => {
    const { client } = useStore();
    const { is_logged_in, loginid, accounts, is_virtual, email, currency, residence, account_settings } = client as any;

    // Always use real account ID for funded challenge — challenge tracks real account
    const real_loginid: string = React.useMemo(
        () =>
            Object.keys(accounts || {}).find((id: string) => !id.startsWith('VRT') && !id.startsWith('vrt')) ||
            loginid ||
            '',
        [accounts, loginid]
    );
    const history = useHistory();
    const location = useLocation();
    const nav_ref = useRef<HTMLDivElement>(null);
    const [announcement, setAnnouncement] = useState(DEFAULT_ANNOUNCEMENT);
    const [competition_duration, setDuration] = useState('monthly');
    const [is_dragging, setIsDragging] = useState(false);
    const [guard_alert, setGuardAlert] = useState<GuardAlert>(null);
    const [trade_alert, setTradeAlert] = useState<GuardAlert>(null);
    const drag_start_x = useRef(0);
    const drag_scroll = useRef(0);

    useEffect(() => {
        getSettings()
            .then((s: any) => {
                if (s?.announcement_text) setAnnouncement(s.announcement_text);
                if (s?.competition_duration) setDuration(s.competition_duration);
            })
            .catch(() => {});
    }, []);

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

    /* ── Funded Guard — DB-driven, no localStorage ──────────────────── */
    const activateGuard = useCallback(async () => {
        if (!real_loginid) return;
        // Respect the user's session-level mode choice (survives page refresh)
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
            initFundedGuard(real_loginid, rules, participant, (message, type) => {
                setGuardAlert({ message, type });
            });
            /* Cache global setting for realtime handler reference */
            (window as any).__dpa_funded_db_exits_global = !!(global_settings as any)?.funded_db_exit_spots_active;
            /* OR in global setting — individual flag already set by initFundedGuard */
            if ((window as any).__dpa_funded_db_exits_global) {
                (window as any).__dpa_funded_db_exits_active = true;
            }
            /* Cache challenge detail on window so FundedAccountStore can self-initialize
               if it loads after this event already fired (race condition fix) */
            const challenge_detail = {
                loginid: real_loginid,
                current_balance: participant.current_balance,
                start_balance: participant.start_balance,
            };
            (window as any).__dpa_funded_challenge = challenge_detail;
            /* Tell FundedAccountStore the real balance from DB so its internal stats are correct */
            window.dispatchEvent(
                new CustomEvent('dpa_funded_challenge_activated', {
                    detail: challenge_detail,
                })
            );
        } catch (_e) {
            /* Guard unavailable — fail silently so normal trading is unaffected */
        }
    }, [real_loginid]);

    useEffect(() => {
        window.addEventListener('dpa_funded_activated', activateGuard);
        window.addEventListener('dpa_funded_deactivated', destroyFundedGuard);

        /* On mount: auto-activate guard if user has an active participant in DB */
        if (real_loginid) activateGuard();

        return () => {
            window.removeEventListener('dpa_funded_activated', activateGuard);
            window.removeEventListener('dpa_funded_deactivated', destroyFundedGuard);
            destroyFundedGuard();
        };
    }, [activateGuard]);

    /* ── Marketing guard: activate when user logs in ─────────────────── */
    useEffect(() => {
        if (!real_loginid) {
            destroyMarketingGuard();
            return;
        }
        initMarketingGuard(real_loginid);
    }, [real_loginid]);

    /* ── Suppress marketing intercept when demo account is active ────── */
    useEffect(() => {
        const is_demo = loginid?.startsWith('VRT') || loginid?.startsWith('vrt');
        setMarketingTradingMode(!is_demo);
    }, [loginid]);

    /* ── Restore marketing display when funded mode is deactivated ────── */
    useEffect(() => {
        const onFundedDeactivated = () => {
            const is_demo = loginid?.startsWith('VRT') || loginid?.startsWith('vrt');
            setMarketingTradingMode(!is_demo);
        };
        window.addEventListener('dpa_funded_deactivated', onFundedDeactivated);
        return () => window.removeEventListener('dpa_funded_deactivated', onFundedDeactivated);
    }, [loginid]);

    /* ── D-Trader trade result notification ─────────────────────────── */
    useEffect(() => {
        const onTradeResult = (e: Event) => {
            const { is_win, profit, exit_spot, stake, currency: cur } = (e as CustomEvent).detail ?? {};
            const fmt = (n: number) =>
                Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const msg = is_win
                ? `Exit spot: ${exit_spot}\nProfit: +$${fmt(profit)} ${cur ?? 'USD'}`
                : `Exit spot: ${exit_spot}\nLoss: -$${fmt(stake)} ${cur ?? 'USD'}`;
            setTradeAlert({
                message: msg,
                type: is_win ? 'passed' : 'blocked',
                title: is_win ? 'Trade Won!' : 'Trade Lost',
            });
        };
        window.addEventListener('dpa_dtrader_trade_result', onTradeResult);
        return () => window.removeEventListener('dpa_dtrader_trade_result', onTradeResult);
    }, []);

    /* ── Real-time: admin changes push instantly to user ─────────────── */
    useEffect(() => {
        if (!real_loginid) return;

        const channel = supabase
            .channel(`participant-guard-${real_loginid}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, payload => {
                /* Filter client-side — DELETE payloads may omit non-PK columns */
                const row_id = (payload.new as any)?.deriv_login_id ?? (payload.old as any)?.deriv_login_id;
                if (row_id && row_id !== real_loginid) return;

                if (payload.eventType === 'DELETE') {
                    /* Admin removed user from challenge — exit funded mode instantly */
                    destroyFundedGuard();
                    window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                    window.dispatchEvent(new CustomEvent('dpa_participant_removed'));
                } else if (payload.eventType === 'UPDATE') {
                    /* Admin restarted challenge — refresh guard with new data */
                    updateGuardParticipant(payload.new as any);
                    /* Refresh DB exit spots flag if admin toggled it */
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

    const end_date = getCompetitionEnd(competition_duration);
    const { days, hours, mins } = useCountdown(end_date);

    const go = (path: string) => history.push(path as any);
    const isActive = (path: string) => location.pathname === path;

    // ── Mouse drag to scroll ──────────────────────────────────────────
    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        drag_start_x.current = e.pageX - (nav_ref.current?.offsetLeft ?? 0);
        drag_scroll.current = nav_ref.current?.scrollLeft ?? 0;
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!is_dragging || !nav_ref.current) return;
        e.preventDefault();
        const x = e.pageX - nav_ref.current.offsetLeft;
        nav_ref.current.scrollLeft = drag_scroll.current - (x - drag_start_x.current);
    };
    const onMouseUp = () => setIsDragging(false);

    return (
        <>
            <GuardAlertOverlay alert={guard_alert} onClose={() => setGuardAlert(null)} />
            <GuardAlertOverlay alert={trade_alert} onClose={() => setTradeAlert(null)} />
            <nav className='dpa-navbar'>
                {/* ── Announcement Bar ───────────────────────────── */}
                <div className='dpa-navbar__announcement'>
                    <div className='dpa-navbar__marquee'>
                        <span>
                            {announcement}&nbsp;&nbsp;·&nbsp;&nbsp;
                            {announcement}&nbsp;&nbsp;·&nbsp;&nbsp;
                            {announcement}
                        </span>
                    </div>
                    <div className='dpa-navbar__countdown'>
                        <span className='dpa-navbar__countdown-label'>Competition ends in</span>
                        <span className='dpa-navbar__countdown-time'>
                            {days}d {hours}h {mins}m
                        </span>
                    </div>
                </div>

                {/* ── Nav Links Bar ──────────────────────────────────── */}
                <div className='dpa-navbar__main'>
                    <div
                        className={`dpa-navbar__links${is_dragging ? ' dragging' : ''}`}
                        ref={nav_ref}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    >
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.path}
                                className={`dpa-navbar__link${isActive(item.path) ? ' active' : ''}`}
                                onClick={() => go(item.path)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Scroll indicator ───────────────────────────── */}
                <div className='dpa-navbar__scroll-hint'>
                    <div className='dpa-navbar__scroll-track'>
                        <div className='dpa-navbar__scroll-thumb'></div>
                    </div>
                </div>
            </nav>
        </>
    );
});

export default DPANavbar;
