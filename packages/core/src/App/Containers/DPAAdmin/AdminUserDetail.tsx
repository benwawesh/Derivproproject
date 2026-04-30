import React, { useState } from 'react';
import AdminUserReportView from './AdminUserReportView';

interface Props {
    user: any;
    fundedTrades: any[];
    realTrades: any[];
    participant: any | null;
    onBack: () => void;
}

const AdminUserDetail = ({ user, fundedTrades, realTrades, participant, onBack }: Props) => {
    const [activeTab, setActiveTab] = useState<'funded' | 'real'>(fundedTrades.length > 0 ? 'funded' : 'real');

    const startBalance = participant?.start_balance ?? 0;
    const currentBalance = participant?.current_balance ?? 0;
    const pnl = currentBalance - startBalance;
    const drawdownPct =
        startBalance > 0 ? ((startBalance - Math.min(currentBalance, startBalance)) / startBalance) * 100 : 0;

    return (
        <div className='admin-user-detail'>
            {/* ── Back + header ──────────────────────────────────────── */}
            <div className='admin-user-detail__topbar'>
                <button className='dpa-admin__back-btn' onClick={onBack}>
                    ← Back to Users
                </button>
            </div>

            <div className='admin-user-detail__header'>
                {/* User info */}
                <div className='admin-user-info'>
                    <div className='admin-user-info__avatar'>
                        {(user?.name || user?.deriv_loginid || '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className='admin-user-info__name'>{user?.name || user?.deriv_loginid}</h2>
                        <div className='admin-user-info__meta'>
                            <span>{user?.deriv_loginid}</span>
                            {user?.email && <span>· {user.email}</span>}
                            {user?.country && <span>· {user.country}</span>}
                            {user?.currency && <span>· {user.currency}</span>}
                        </div>
                        <div className='admin-user-info__last-seen'>
                            Last seen: {user?.last_seen ? new Date(user.last_seen).toLocaleString() : '—'}
                        </div>
                    </div>
                </div>

                {/* Challenge status — only when user is a participant */}
                {participant && (
                    <div className='admin-challenge-card'>
                        <div className='admin-challenge-card__title'>
                            Challenge — Phase {participant.current_phase}
                            <span
                                className={`admin-challenge-card__status admin-challenge-card__status--${participant.phase_status}`}
                            >
                                {participant.is_disqualified ? 'Disqualified' : participant.phase_status}
                            </span>
                        </div>
                        <div className='admin-challenge-card__grid'>
                            <div className='admin-challenge-card__item'>
                                <span className='label'>Start Balance</span>
                                <span className='value'>
                                    ${startBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className='admin-challenge-card__item'>
                                <span className='label'>Current Balance</span>
                                <span className='value'>
                                    ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className='admin-challenge-card__item'>
                                <span className='label'>Net P&L</span>
                                <span className='value' style={{ color: pnl >= 0 ? '#16a534' : '#ff444f' }}>
                                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                                </span>
                            </div>
                            <div className='admin-challenge-card__item'>
                                <span className='label'>Drawdown</span>
                                <span className='value' style={{ color: drawdownPct > 5 ? '#ff444f' : '#f59e0b' }}>
                                    {drawdownPct.toFixed(1)}%
                                </span>
                            </div>
                            <div className='admin-challenge-card__item'>
                                <span className='label'>Trading Days</span>
                                <span className='value'>{participant.trading_days ?? 0}</span>
                            </div>
                            <div className='admin-challenge-card__item'>
                                <span className='label'>Daily Loss Today</span>
                                <span className='value'>${(participant.daily_loss_today ?? 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Account type tabs ──────────────────────────────────── */}
            <div className='admin-account-tabs'>
                <button
                    className={`admin-account-tab${activeTab === 'funded' ? ' admin-account-tab--active' : ''}`}
                    onClick={() => setActiveTab('funded')}
                >
                    Funded Account
                    <span className='admin-account-tab__count'>{fundedTrades.length}</span>
                </button>
                <button
                    className={`admin-account-tab${activeTab === 'real' ? ' admin-account-tab--active' : ''}`}
                    onClick={() => setActiveTab('real')}
                >
                    Real Account
                    <span className='admin-account-tab__count'>{realTrades.length}</span>
                </button>
            </div>

            {/* ── Report view ────────────────────────────────────────── */}
            <AdminUserReportView
                trades={activeTab === 'funded' ? fundedTrades : realTrades}
                accountType={activeTab}
                startBalance={activeTab === 'funded' ? startBalance : 0}
            />
        </div>
    );
};

export default AdminUserDetail;
