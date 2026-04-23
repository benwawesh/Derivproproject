import { useEffect, useState, useCallback } from 'react';
import { observer, useStore } from '@deriv/stores';
import { getParticipant, getSettings, getChallengeTiers, registerParticipant, supabase } from 'Services/supabase';
import './challenge.scss';

type TSettings = {
    phase1_profit_target: number;
    phase2_profit_target: number;
    phase3_profit_target: number;
    daily_drawdown_limit: number;
    disqualification_threshold: number;
    flips_required_to_reenter: number;
    phase1_duration_days: number;
    phase2_duration_days: number;
    min_trading_days: number;
    profit_split_trader: number;
};

type TTier = {
    id: string;
    name: string;
    funded_amount: number;
    entry_fee: number;
    profit_target_percent: number;
    max_daily_loss_percent: number;
    max_total_drawdown_percent: number;
    max_stake_per_trade: number;
    duration_days: number;
    min_trading_days: number;
    description: string;
    is_active: boolean;
};

type TParticipant = {
    current_phase: number;
    phase_status: string;
    start_balance: number;
    current_balance: number;
    net_profit: number;
    profit_percent: number;
    total_drawdown_percent: number;
    daily_loss_today: number;
    is_disqualified: boolean;
    flip_count: number;
    trading_days: number;
    phase_end_date: string;
    bot_used: string;
    market_traded: string;
    funded_loginid: string;
};

const PHASE_LABELS = ['', 'Challenge', 'Verification', 'Funded'];

const ChallengePage = observer(() => {
    const { client } = useStore();
    const { loginid, accounts, is_logged_in } = client;

    // Always use real account ID — challenge tracks real account regardless of active account
    const real_loginid =
        Object.keys(accounts || {}).find((id: string) => !id.startsWith('VRT') && !id.startsWith('vrt')) || loginid;

    const [settings, setSettings] = useState<TSettings | null>(null);
    const [tiers, setTiers] = useState<TTier[]>([]);
    const [participant, setParticipant] = useState<TParticipant | null>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);
    const [error, setError] = useState('');
    const [selected_tier, setSelectedTier] = useState<TTier | null>(null);

    const masked_id = real_loginid ? real_loginid.replace(/(.{2})(.+)(.{2})$/, '$1***$3') : '';

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [s, t, p] = await Promise.all([
                getSettings(),
                getChallengeTiers(true), // active only
                real_loginid ? getParticipant(real_loginid) : Promise.resolve(null),
            ]);
            setSettings(s);
            setTiers(t ?? []);
            setParticipant(p);
        } catch (e) {
            setError('Failed to load challenge data.');
        } finally {
            setLoading(false);
        }
    }, [real_loginid]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    /* ── Real-time: admin changes reflect instantly ───────────────────── */
    useEffect(() => {
        if (!real_loginid) return;

        const channel = supabase
            .channel(`participant-challenge-${real_loginid}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_participants' }, payload => {
                const row_id = (payload.new as any)?.deriv_login_id ?? (payload.old as any)?.deriv_login_id;
                if (row_id && row_id !== real_loginid) return;

                if (payload.eventType === 'DELETE') {
                    window.dispatchEvent(new CustomEvent('dpa_funded_deactivated'));
                    setParticipant(null);
                    setSelectedTier(null);
                } else if (payload.eventType === 'UPDATE') {
                    setParticipant(payload.new as TParticipant);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [real_loginid]);

    const handleRegister = async () => {
        if (!real_loginid || !selected_tier) return;
        try {
            setRegistering(true);
            const p = await registerParticipant({
                deriv_login_id: real_loginid,
                masked_login_id: masked_id,
                start_balance: selected_tier.funded_amount,
                current_balance: selected_tier.funded_amount,
            });
            setParticipant(p);
        } catch (e: any) {
            setError('Registration failed. Please try again.');
        } finally {
            setRegistering(false);
        }
    };

    if (!is_logged_in) {
        return (
            <div className='dpa-challenge'>
                <div className='dpa-challenge__login-prompt'>
                    <div className='dpa-challenge__login-icon'>🏆</div>
                    <h2>Log in to join the Challenge</h2>
                    <p>You need a real Deriv account to participate in the DerivProAcademy Challenge.</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className='dpa-challenge__loading'>Loading challenge data...</div>;

    const phase_target = settings
        ? [0, settings.phase1_profit_target, settings.phase2_profit_target, settings.phase3_profit_target][
              participant?.current_phase ?? 1
          ]
        : 30;

    const profit_progress = participant ? Math.min((participant.profit_percent / phase_target) * 100, 100) : 0;
    const drawdown_progress = participant
        ? Math.min((participant.total_drawdown_percent / (settings?.disqualification_threshold ?? 30)) * 100, 100)
        : 0;
    const days_left = participant?.phase_end_date
        ? Math.max(0, Math.ceil((new Date(participant.phase_end_date).getTime() - Date.now()) / 86400000))
        : null;

    return (
        <div className='dpa-challenge'>
            <div className='dpa-challenge__header'>
                <h1>DerivProAcademy Challenge</h1>
                <p>Pass all 3 phases to get a funded trading account</p>
            </div>

            {/* Phase overview */}
            <div className='dpa-challenge__phases'>
                {[1, 2, 3].map(phase => (
                    <div
                        key={phase}
                        className={`dpa-challenge__phase-card ${
                            participant?.current_phase === phase ? 'dpa-challenge__phase-card--active' : ''
                        } ${(participant?.current_phase ?? 0) > phase ? 'dpa-challenge__phase-card--done' : ''}`}
                    >
                        <div className='dpa-challenge__phase-num'>{phase}</div>
                        <div className='dpa-challenge__phase-label'>{PHASE_LABELS[phase]}</div>
                        <div className='dpa-challenge__phase-target'>
                            {phase === 1 && `${settings?.phase1_profit_target ?? 10}% profit`}
                            {phase === 2 && `${settings?.phase2_profit_target ?? 5}% profit`}
                            {phase === 3 && `${settings?.phase3_profit_target ?? 0}% profit`}
                        </div>
                        <div className='dpa-challenge__phase-duration'>
                            {phase === 1 && `${settings?.phase1_duration_days ?? 30} days`}
                            {phase === 2 && `${settings?.phase2_duration_days ?? 60} days`}
                            {phase === 3 && 'Ongoing'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Rules */}
            <div className='dpa-challenge__rules'>
                <h3>Challenge Rules</h3>
                <div className='dpa-challenge__rules-grid'>
                    <div className='dpa-challenge__rule'>
                        <span className='dpa-challenge__rule-icon'>📈</span>
                        <span>
                            Max daily loss: <strong>{settings?.daily_drawdown_limit ?? 5}%</strong> of balance
                        </span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='dpa-challenge__rule-icon'>⚠️</span>
                        <span>
                            Lose more than <strong>{settings?.disqualification_threshold ?? 10}%</strong> = disqualified
                            from funding
                        </span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='dpa-challenge__rule-icon'>📅</span>
                        <span>
                            Minimum <strong>{settings?.min_trading_days ?? 5} trading days</strong> required
                        </span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='dpa-challenge__rule-icon'>💰</span>
                        <span>
                            Profit split: <strong>{settings?.profit_split_trader ?? 80}% to you</strong>
                        </span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='dpa-challenge__rule-icon'>🔄</span>
                        <span>
                            Re-entry requires <strong>{settings?.flips_required_to_reenter ?? 5} account flips</strong>
                        </span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='dpa-challenge__rule-icon'>🤖</span>
                        <span>Any trading method allowed (bot or manual)</span>
                    </div>
                </div>
            </div>

            {/* Challenge Tiers — shown only when not yet enrolled */}
            {!participant && (
                <div className='dpa-challenge__funded'>
                    <h3>Select Your Challenge</h3>
                    {tiers.length === 0 ? (
                        <p style={{ color: '#aaa', textAlign: 'center', padding: '24px 0' }}>
                            No challenges available yet. Check back soon.
                        </p>
                    ) : (
                        <div className='dpa-challenge__tiers'>
                            {tiers.map(tier => (
                                <div
                                    key={tier.id}
                                    className={`dpa-challenge__tier-card ${selected_tier?.id === tier.id ? 'dpa-challenge__tier-card--selected' : ''}`}
                                    onClick={() => setSelectedTier(tier)}
                                >
                                    <div className='dpa-challenge__tier-name'>{tier.name}</div>
                                    <div className='dpa-challenge__tier-amount'>
                                        ${tier.funded_amount.toLocaleString()}
                                    </div>
                                    <div className='dpa-challenge__tier-fee'>
                                        {tier.entry_fee > 0 ? `Entry: $${tier.entry_fee}` : 'FREE'}
                                    </div>
                                    <div className='dpa-challenge__tier-rules'>
                                        <span>🎯 {tier.profit_target_percent}% target</span>
                                        <span>📉 {tier.max_daily_loss_percent}% daily loss</span>
                                        <span>
                                            ⏱ {tier.duration_days > 0 ? `${tier.duration_days}d` : 'Unlimited'}
                                        </span>
                                    </div>
                                    {tier.description && (
                                        <div className='dpa-challenge__tier-desc'>{tier.description}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* User dashboard */}
            {!participant ? (
                <div className='dpa-challenge__register'>
                    <h3>Ready to start?</h3>
                    {selected_tier ? (
                        <p>
                            Selected:{' '}
                            <strong>
                                {selected_tier.name} — ${selected_tier.funded_amount.toLocaleString()} USD
                            </strong>
                        </p>
                    ) : (
                        <p>Select a challenge above to get started.</p>
                    )}
                    {error && <p className='dpa-challenge__error'>{error}</p>}
                    <button
                        className='dpa-challenge__register-btn'
                        onClick={handleRegister}
                        disabled={registering || !selected_tier}
                    >
                        {registering ? 'Registering...' : 'Join Challenge — FREE'}
                    </button>
                </div>
            ) : (
                <div className='dpa-challenge__dashboard'>
                    <div className='dpa-challenge__dashboard-header'>
                        <div>
                            <h3>Your Progress</h3>
                            <span className='dpa-challenge__login'>{masked_id}</span>
                        </div>
                        <div className={`dpa-challenge__status dpa-challenge__status--${participant.phase_status}`}>
                            Phase {participant.current_phase} — {PHASE_LABELS[participant.current_phase]}
                            {participant.is_disqualified && ' (Disqualified)'}
                        </div>
                    </div>

                    <div className='dpa-challenge__stats'>
                        <div className='dpa-challenge__stat'>
                            <span className='dpa-challenge__stat-label'>Start Balance</span>
                            <span className='dpa-challenge__stat-value'>${participant.start_balance.toFixed(2)}</span>
                        </div>
                        <div className='dpa-challenge__stat'>
                            <span className='dpa-challenge__stat-label'>Current Balance</span>
                            <span className='dpa-challenge__stat-value'>${participant.current_balance.toFixed(2)}</span>
                        </div>
                        <div className='dpa-challenge__stat'>
                            <span className='dpa-challenge__stat-label'>Net Profit</span>
                            <span
                                className={`dpa-challenge__stat-value ${participant.net_profit >= 0 ? 'dpa-challenge__stat-value--profit' : 'dpa-challenge__stat-value--loss'}`}
                            >
                                ${participant.net_profit.toFixed(2)} ({participant.profit_percent.toFixed(2)}%)
                            </span>
                        </div>
                        <div className='dpa-challenge__stat'>
                            <span className='dpa-challenge__stat-label'>Trading Days</span>
                            <span className='dpa-challenge__stat-value'>
                                {participant.trading_days} / {settings?.min_trading_days ?? 5}
                            </span>
                        </div>
                        {days_left !== null && (
                            <div className='dpa-challenge__stat'>
                                <span className='dpa-challenge__stat-label'>Days Left</span>
                                <span className='dpa-challenge__stat-value'>{days_left}</span>
                            </div>
                        )}
                        {participant.is_disqualified && (
                            <div className='dpa-challenge__stat'>
                                <span className='dpa-challenge__stat-label'>Flips to Re-enter</span>
                                <span className='dpa-challenge__stat-value'>
                                    {participant.flip_count} / {settings?.flips_required_to_reenter ?? 5}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Profit progress */}
                    <div className='dpa-challenge__progress-section'>
                        <div className='dpa-challenge__progress-label'>
                            <span>Profit Target</span>
                            <span>
                                {participant.profit_percent.toFixed(2)}% / {phase_target}%
                            </span>
                        </div>
                        <div className='dpa-challenge__progress-bar'>
                            <div
                                className='dpa-challenge__progress-fill dpa-challenge__progress-fill--profit'
                                style={{ width: `${profit_progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Drawdown progress */}
                    <div className='dpa-challenge__progress-section'>
                        <div className='dpa-challenge__progress-label'>
                            <span>Total Drawdown</span>
                            <span className={drawdown_progress > 70 ? 'dpa-challenge__progress-label--danger' : ''}>
                                {participant.total_drawdown_percent.toFixed(2)}% /{' '}
                                {settings?.disqualification_threshold ?? 10}%
                            </span>
                        </div>
                        <div className='dpa-challenge__progress-bar'>
                            <div
                                className={`dpa-challenge__progress-fill dpa-challenge__progress-fill--drawdown${drawdown_progress > 70 ? ' dpa-challenge__progress-fill--danger' : ''}`}
                                style={{ width: `${drawdown_progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default ChallengePage;
