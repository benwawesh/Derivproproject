import React, { useEffect, useState } from 'react';
import { getParticipant, getSettings, registerParticipant, updateParticipant } from '../../../Services/supabase';
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

type TParticipant = {
    deriv_login_id: string;
    masked_login_id: string;
    current_phase: number;
    phase_status: string;
    start_balance: number;
    current_balance: number;
    net_profit: number;
    profit_percent: number;
    daily_loss_today: number;
    total_drawdown_percent: number;
    is_disqualified: boolean;
    disqualified_reason: string;
    flip_count: number;
    trading_days: number;
    phase_end_date: string;
};

type TChallengeProps = {
    deriv_login_id: string;
    account_balance: number;
    is_logged_in: boolean;
};

const Challenge = ({ deriv_login_id, account_balance, is_logged_in }: TChallengeProps) => {
    const [settings, setSettings] = useState<TSettings | null>(null);
    const [participant, setParticipant] = useState<TParticipant | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const s = await getSettings();
                setSettings(s);
                if (deriv_login_id) {
                    const p = await getParticipant(deriv_login_id);
                    setParticipant(p);
                }
            } catch (e) {
                setError('Failed to load challenge data.');
            } finally {
                setLoading(false);
            }
        };
        if (is_logged_in) load();
        else setLoading(false);
    }, [deriv_login_id, is_logged_in]);

    const handleJoin = async () => {
        if (!deriv_login_id || !settings) return;
        setJoining(true);
        try {
            const masked = deriv_login_id.slice(0, 4) + '***' + deriv_login_id.slice(-2);
            const end_date = new Date();
            end_date.setDate(end_date.getDate() + settings.phase1_duration_days);

            const p = await registerParticipant({
                deriv_login_id,
                masked_login_id: masked,
                start_balance: account_balance,
                current_balance: account_balance,
            });
            await updateParticipant(deriv_login_id, {
                phase_end_date: end_date.toISOString(),
            });
            setParticipant(p);
        } catch (e) {
            setError('Failed to join challenge. Please try again.');
        } finally {
            setJoining(false);
        }
    };

    const getDaysRemaining = (end_date: string) => {
        const end = new Date(end_date);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    };

    const getPhaseTarget = () => {
        if (!settings || !participant) return 0;
        if (participant.current_phase === 1) return settings.phase1_profit_target;
        if (participant.current_phase === 2) return settings.phase2_profit_target;
        return settings.phase3_profit_target;
    };

    const getStatusColor = (status: string) => {
        if (status === 'passed') return '#28a745';
        if (status === 'failed') return '#dc3545';
        if (status === 'disqualified') return '#ffc107';
        return '#800000';
    };

    if (!is_logged_in) {
        return (
            <div className='dpa-challenge dpa-challenge--locked'>
                <div className='dpa-challenge__lock-icon'>🔒</div>
                <h2>Log in to join the Challenge</h2>
                <p>
                    Register or log in with your Deriv account to start the DerivProAcademy Challenge and earn a funded
                    account.
                </p>
            </div>
        );
    }

    if (loading) return <div className='dpa-challenge__loading'>Loading challenge data...</div>;

    if (error) return <div className='dpa-challenge__error'>{error}</div>;

    return (
        <div className='dpa-challenge'>
            <div className='dpa-challenge__header'>
                <h1>DerivProAcademy Challenge</h1>
                <p>Pass 3 phases and earn a funded account up to $10,000</p>
            </div>

            {/* Phase Overview Cards */}
            <div className='dpa-challenge__phases'>
                {[1, 2, 3].map(phase => (
                    <div
                        key={phase}
                        className={`dpa-challenge__phase-card ${participant?.current_phase === phase ? 'active' : ''} ${
                            participant?.current_phase !== undefined && participant.current_phase > phase
                                ? 'completed'
                                : ''
                        }`}
                    >
                        <div className='dpa-challenge__phase-number'>Phase {phase}</div>
                        <div className='dpa-challenge__phase-target'>
                            {phase === 1 && `${settings?.phase1_profit_target}% Profit`}
                            {phase === 2 && `${settings?.phase2_profit_target}% Profit`}
                            {phase === 3 && `${settings?.phase3_profit_target}% Profit`}
                        </div>
                        <div className='dpa-challenge__phase-duration'>
                            {phase === 1 && `${settings?.phase1_duration_days} days`}
                            {phase === 2 && `${settings?.phase2_duration_days} days`}
                            {phase === 3 && 'Ongoing'}
                        </div>
                        {participant?.current_phase !== undefined && participant.current_phase > phase && (
                            <div className='dpa-challenge__phase-badge passed'>✓ Passed</div>
                        )}
                        {participant?.current_phase === phase && (
                            <div className='dpa-challenge__phase-badge active'>● Active</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Rules */}
            <div className='dpa-challenge__rules'>
                <h3>Challenge Rules</h3>
                <div className='dpa-challenge__rules-grid'>
                    <div className='dpa-challenge__rule'>
                        <span className='label'>Daily Drawdown Limit</span>
                        <span className='value'>{settings?.daily_drawdown_limit}% of balance</span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='label'>Disqualification Threshold</span>
                        <span className='value'>Lose more than {settings?.disqualification_threshold}%</span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='label'>Min Trading Days</span>
                        <span className='value'>{settings?.min_trading_days} days</span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='label'>Profit Split</span>
                        <span className='value'>{settings?.profit_split_trader}% to you</span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='label'>Flips to Re-enter</span>
                        <span className='value'>{settings?.flips_required_to_reenter} flips required</span>
                    </div>
                    <div className='dpa-challenge__rule'>
                        <span className='label'>Entry Fee</span>
                        <span className='value free'>FREE</span>
                    </div>
                </div>
            </div>

            {/* Participant Dashboard */}
            {participant ? (
                <div className='dpa-challenge__dashboard'>
                    <div className='dpa-challenge__status-bar'>
                        <span
                            className='dpa-challenge__status-badge'
                            style={{ background: getStatusColor(participant.phase_status) }}
                        >
                            Phase {participant.current_phase} —{' '}
                            {participant.is_disqualified ? 'Disqualified' : participant.phase_status.toUpperCase()}
                        </span>
                        {participant.phase_end_date && (
                            <span className='dpa-challenge__days-remaining'>
                                {getDaysRemaining(participant.phase_end_date)} days remaining
                            </span>
                        )}
                    </div>

                    {participant.is_disqualified && (
                        <div className='dpa-challenge__disqualified-notice'>
                            ⚠️ You have been disqualified from receiving a funded account but may continue trading.
                            <br />
                            To re-enter Phase 1, you must flip your account{' '}
                            <strong>{settings?.flips_required_to_reenter} times</strong>.
                            <br />
                            Current flips:{' '}
                            <strong>
                                {participant.flip_count} / {settings?.flips_required_to_reenter}
                            </strong>
                        </div>
                    )}

                    <div className='dpa-challenge__metrics'>
                        <div className='dpa-challenge__metric'>
                            <div className='label'>Profit Target</div>
                            <div className='progress-bar'>
                                <div
                                    className='fill'
                                    style={{
                                        width: `${Math.min((participant.profit_percent / getPhaseTarget()) * 100, 100)}%`,
                                        background:
                                            participant.profit_percent >= getPhaseTarget() ? '#28a745' : '#800000',
                                    }}
                                />
                            </div>
                            <div className='values'>
                                {participant.profit_percent.toFixed(2)}% / {getPhaseTarget()}%
                            </div>
                        </div>

                        <div className='dpa-challenge__metric'>
                            <div className='label'>Daily Drawdown</div>
                            <div className='progress-bar'>
                                <div
                                    className='fill danger'
                                    style={{
                                        width: `${Math.min(
                                            (participant.daily_loss_today / (settings?.daily_drawdown_limit || 10)) *
                                                100,
                                            100
                                        )}%`,
                                    }}
                                />
                            </div>
                            <div className='values'>
                                {participant.daily_loss_today.toFixed(2)}% / {settings?.daily_drawdown_limit}%
                            </div>
                        </div>

                        <div className='dpa-challenge__metric'>
                            <div className='label'>Total Drawdown</div>
                            <div className='progress-bar'>
                                <div
                                    className='fill danger'
                                    style={{
                                        width: `${Math.min(
                                            (participant.total_drawdown_percent /
                                                (settings?.disqualification_threshold || 30)) *
                                                100,
                                            100
                                        )}%`,
                                    }}
                                />
                            </div>
                            <div className='values'>
                                {participant.total_drawdown_percent.toFixed(2)}% /{' '}
                                {settings?.disqualification_threshold}%
                            </div>
                        </div>
                    </div>

                    <div className='dpa-challenge__stats'>
                        <div className='stat'>
                            <span className='stat-label'>Start Balance</span>
                            <span className='stat-value'>${participant.start_balance.toFixed(2)}</span>
                        </div>
                        <div className='stat'>
                            <span className='stat-label'>Current Balance</span>
                            <span className='stat-value'>${participant.current_balance.toFixed(2)}</span>
                        </div>
                        <div className='stat'>
                            <span className='stat-label'>Net Profit</span>
                            <span className={`stat-value ${participant.net_profit >= 0 ? 'profit' : 'loss'}`}>
                                ${participant.net_profit.toFixed(2)}
                            </span>
                        </div>
                        <div className='stat'>
                            <span className='stat-label'>Trading Days</span>
                            <span className='stat-value'>
                                {participant.trading_days} / {settings?.min_trading_days}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className='dpa-challenge__join'>
                    <h3>
                        Your account balance: <span>${account_balance.toFixed(2)}</span>
                    </h3>
                    <p>Real accounts only. Once you join, your start balance is locked in.</p>
                    <button className='dpa-challenge__join-btn' onClick={handleJoin} disabled={joining}>
                        {joining ? 'Joining...' : 'Join Challenge — FREE'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Challenge;
