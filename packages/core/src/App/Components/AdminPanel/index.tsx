import React, { useEffect, useState } from 'react';
import {
    getSettings,
    updateSettings,
    getCompetitionSettings,
    getLeaderboard,
    getFundedAccounts,
    createFundedAccount,
    getAllMarketingAccounts,
    upsertMarketingAccount,
    deleteMarketingAccount,
    supabase,
} from '../../../Services/supabase';
import './admin-panel.scss';

// Admin login IDs — add your own Deriv login ID here
const ADMIN_LOGIN_IDS = ['CR2357801'];

type TSettings = Record<string, number | string | string[]>;
type TParticipant = Record<string, string | number | boolean>;
type TFundedAccount = Record<string, string | number | boolean>;

type TMarketingAccount = Record<string, string | number | boolean>;

type TAdminPanelProps = {
    deriv_login_id: string;
};

const AdminPanel = ({ deriv_login_id }: TAdminPanelProps) => {
    const [is_admin, setIsAdmin] = useState(false);
    const [settings, setSettings] = useState<TSettings>({});
    const [participants, setParticipants] = useState<TParticipant[]>([]);
    const [funded_accounts, setFundedAccounts] = useState<TFundedAccount[]>([]);
    const [marketing_accounts, setMarketingAccounts] = useState<TMarketingAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [active_tab, setActiveTab] = useState('settings');
    const [save_msg, setSaveMsg] = useState('');
    const [marketing_form, setMarketingForm] = useState({
        deriv_loginid: '',
        balance: 1000,
        win_rate: 7,
        cycle_size: 10,
    });

    useEffect(() => {
        if (ADMIN_LOGIN_IDS.includes(deriv_login_id)) {
            setIsAdmin(true);
            loadData();
        } else {
            setLoading(false);
        }
    }, [deriv_login_id]);

    const loadData = async () => {
        try {
            const [s, p, f, m] = await Promise.all([
                getSettings(),
                supabase.from('challenge_participants').select('*').order('created_at', { ascending: false }),
                getFundedAccounts(),
                getAllMarketingAccounts(),
            ]);
            setSettings(s || {});
            setParticipants(p.data || []);
            setFundedAccounts(f || []);
            setMarketingAccounts(m || []);
        } catch (e) {
            console.error('Admin load error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMarketing = async () => {
        if (!marketing_form.deriv_loginid.trim()) {
            alert('Please enter a Deriv Login ID.');
            return;
        }
        const fake_loginid = 'CR' + (Math.floor(Math.random() * 9000000) + 1000000);
        try {
            await upsertMarketingAccount({
                deriv_loginid: marketing_form.deriv_loginid.trim(),
                fake_loginid,
                balance: marketing_form.balance,
                start_balance: marketing_form.balance,
                win_rate: marketing_form.win_rate,
                cycle_size: marketing_form.cycle_size,
                trade_counter: 0,
                is_active: true,
            });
            setMarketingForm({ deriv_loginid: '', balance: 1000, win_rate: 7, cycle_size: 10 });
            await loadData();
            alert('Marketing account created!');
        } catch (e) {
            alert('Failed to create marketing account.');
        }
    };

    const handleToggleMarketing = async (acc: TMarketingAccount) => {
        try {
            await upsertMarketingAccount({ ...acc, is_active: !acc.is_active });
            await loadData();
        } catch (e) {
            alert('Failed to toggle account.');
        }
    };

    const handleDeleteMarketing = async (acc: TMarketingAccount) => {
        if (!confirm(`Delete marketing account for ${acc.deriv_loginid}?`)) return;
        try {
            await deleteMarketingAccount(acc.id as string);
            await loadData();
        } catch (e) {
            alert('Failed to delete account.');
        }
    };

    const handleResetBalance = async (acc: TMarketingAccount) => {
        const input = prompt(`Reset balance for ${acc.deriv_loginid} to:`, String(acc.start_balance));
        if (!input) return;
        try {
            await upsertMarketingAccount({ ...acc, balance: parseFloat(input), trade_counter: 0 });
            await loadData();
        } catch (e) {
            alert('Failed to reset balance.');
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await updateSettings(settings);
            setSaveMsg('Settings saved successfully!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch (e) {
            setSaveMsg('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleApproveFunded = async (participant: TParticipant) => {
        const amount = prompt(`Enter funded amount for ${participant.masked_login_id} (e.g. 1000):`);
        if (!amount) return;
        try {
            await createFundedAccount({
                deriv_login_id: participant.deriv_login_id,
                masked_login_id: participant.masked_login_id,
                funded_amount: parseFloat(amount),
                start_balance: parseFloat(amount),
                source: 'challenge',
                approved_by: deriv_login_id,
                approved_at: new Date().toISOString(),
            });
            await supabase
                .from('challenge_participants')
                .update({ phase_status: 'funded', current_phase: 3 })
                .eq('deriv_login_id', participant.deriv_login_id);
            await loadData();
            alert('Funded account created successfully!');
        } catch (e) {
            alert('Failed to create funded account.');
        }
    };

    const handleDisqualify = async (participant: TParticipant) => {
        const reason = prompt('Reason for manual disqualification:');
        if (!reason) return;
        try {
            await supabase
                .from('challenge_participants')
                .update({ is_disqualified: true, disqualified_reason: reason })
                .eq('deriv_login_id', participant.deriv_login_id);
            await loadData();
        } catch (e) {
            alert('Failed to disqualify participant.');
        }
    };

    const updateSetting = (key: string, value: string | number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (!is_admin) {
        return (
            <div className='dpa-admin dpa-admin--denied'>
                <h2>Access Denied</h2>
                <p>You do not have admin privileges.</p>
            </div>
        );
    }

    if (loading) return <div className='dpa-admin__loading'>Loading admin data...</div>;

    return (
        <div className='dpa-admin'>
            <div className='dpa-admin__header'>
                <h1>Admin Panel</h1>
                <span className='dpa-admin__badge'>Administrator</span>
            </div>

            <div className='dpa-admin__tabs'>
                {['settings', 'participants', 'funded', 'competition', 'marketing'].map(tab => (
                    <button
                        key={tab}
                        className={`dpa-admin__tab ${active_tab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Settings Tab */}
            {active_tab === 'settings' && (
                <div className='dpa-admin__section'>
                    <h2>Challenge Settings</h2>
                    <div className='dpa-admin__settings-grid'>
                        {[
                            { key: 'phase1_profit_target', label: 'Phase 1 Profit Target (%)', type: 'number' },
                            { key: 'phase2_profit_target', label: 'Phase 2 Profit Target (%)', type: 'number' },
                            { key: 'phase3_profit_target', label: 'Phase 3 Profit Target (%)', type: 'number' },
                            { key: 'daily_drawdown_limit', label: 'Daily Drawdown Limit (%)', type: 'number' },
                            {
                                key: 'disqualification_threshold',
                                label: 'Disqualification Threshold (%)',
                                type: 'number',
                            },
                            { key: 'flips_required_to_reenter', label: 'Flips Required to Re-enter', type: 'number' },
                            { key: 'phase1_duration_days', label: 'Phase 1 Duration (days)', type: 'number' },
                            { key: 'phase2_duration_days', label: 'Phase 2 Duration (days)', type: 'number' },
                            { key: 'min_trading_days', label: 'Min Trading Days', type: 'number' },
                            { key: 'profit_split_trader', label: 'Trader Profit Split (%)', type: 'number' },
                            { key: 'profit_split_platform', label: 'Platform Profit Split (%)', type: 'number' },
                            { key: 'scale_up_months', label: 'Scale Up After (months)', type: 'number' },
                            { key: 'scale_up_target', label: 'Scale Up Target (%)', type: 'number' },
                        ].map(field => (
                            <div key={field.key} className='dpa-admin__field'>
                                <label>{field.label}</label>
                                <input
                                    type={field.type}
                                    value={(settings[field.key] as string | number) || ''}
                                    onChange={e =>
                                        updateSetting(
                                            field.key,
                                            field.type === 'number' ? parseFloat(e.target.value) : e.target.value
                                        )
                                    }
                                />
                            </div>
                        ))}

                        <div className='dpa-admin__field'>
                            <label>Competition Duration</label>
                            <select
                                value={(settings.competition_duration as string) || 'weekly'}
                                onChange={e => updateSetting('competition_duration', e.target.value)}
                            >
                                <option value='weekly'>Weekly</option>
                                <option value='monthly'>Monthly</option>
                            </select>
                        </div>
                    </div>

                    {save_msg && (
                        <div className={`dpa-admin__save-msg ${save_msg.includes('Failed') ? 'error' : 'success'}`}>
                            {save_msg}
                        </div>
                    )}

                    <button className='dpa-admin__save-btn' onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            )}

            {/* Participants Tab */}
            {active_tab === 'participants' && (
                <div className='dpa-admin__section'>
                    <h2>Challenge Participants ({participants.length})</h2>
                    <div className='dpa-admin__table-wrapper'>
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>Login ID</th>
                                    <th>Phase</th>
                                    <th>Status</th>
                                    <th>Balance</th>
                                    <th>Profit %</th>
                                    <th>Drawdown %</th>
                                    <th>Qualified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participants.map((p: TParticipant) => (
                                    <tr key={p.id as string}>
                                        <td className='login-id'>{p.masked_login_id as string}</td>
                                        <td>Phase {p.current_phase as number}</td>
                                        <td>
                                            <span className={`status-badge ${p.phase_status as string}`}>
                                                {p.is_disqualified ? 'Disqualified' : (p.phase_status as string)}
                                            </span>
                                        </td>
                                        <td>${(p.current_balance as number)?.toFixed(2)}</td>
                                        <td className={(p.profit_percent as number) >= 0 ? 'profit' : 'loss'}>
                                            {(p.profit_percent as number)?.toFixed(2)}%
                                        </td>
                                        <td>{(p.total_drawdown_percent as number)?.toFixed(2)}%</td>
                                        <td>{p.is_disqualified ? '❌' : '✅'}</td>
                                        <td className='actions'>
                                            {!p.is_disqualified && (
                                                <>
                                                    <button
                                                        className='btn-approve'
                                                        onClick={() => handleApproveFunded(p)}
                                                    >
                                                        Fund
                                                    </button>
                                                    <button
                                                        className='btn-disqualify'
                                                        onClick={() => handleDisqualify(p)}
                                                    >
                                                        Disqualify
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Funded Accounts Tab */}
            {active_tab === 'funded' && (
                <div className='dpa-admin__section'>
                    <h2>Funded Accounts ({funded_accounts.length})</h2>
                    <div className='dpa-admin__table-wrapper'>
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>Login ID</th>
                                    <th>Amount</th>
                                    <th>Source</th>
                                    <th>Status</th>
                                    <th>Total Profit</th>
                                    <th>Split</th>
                                    <th>Scale Ups</th>
                                    <th>Approved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {funded_accounts.map((f: TFundedAccount) => (
                                    <tr key={f.id as string}>
                                        <td className='login-id'>{f.masked_login_id as string}</td>
                                        <td>${(f.funded_amount as number)?.toFixed(2)}</td>
                                        <td>{f.source as string}</td>
                                        <td>
                                            <span className={`status-badge ${f.status as string}`}>
                                                {f.status as string}
                                            </span>
                                        </td>
                                        <td className={(f.total_profit as number) >= 0 ? 'profit' : 'loss'}>
                                            ${(f.total_profit as number)?.toFixed(2)}
                                        </td>
                                        <td>
                                            {f.profit_split_trader as number}% /{' '}
                                            {100 - (f.profit_split_trader as number)}%
                                        </td>
                                        <td>{f.scale_up_count as number}×</td>
                                        <td>{f.approved_by as string}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Marketing Accounts Tab */}
            {active_tab === 'marketing' && (
                <div className='dpa-admin__section'>
                    <h2>Marketing Accounts ({marketing_accounts.length})</h2>
                    <p style={{ color: '#666', marginBottom: '16px', fontSize: '13px' }}>
                        Assign users to a simulated account. Their bot will trade from stored exit spots using the
                        win/loss cycle you define. Looks identical to a real account.
                    </p>

                    {/* Create form */}
                    <div
                        className='dpa-admin__settings-grid'
                        style={{ marginBottom: '24px', background: '#f9f9f9', padding: '16px', borderRadius: '8px' }}
                    >
                        <div className='dpa-admin__field'>
                            <label>Deriv Login ID</label>
                            <input
                                type='text'
                                placeholder='e.g. CR1234567'
                                value={marketing_form.deriv_loginid}
                                onChange={e => setMarketingForm(f => ({ ...f, deriv_loginid: e.target.value }))}
                            />
                        </div>
                        <div className='dpa-admin__field'>
                            <label>Starting Balance ($)</label>
                            <input
                                type='number'
                                value={marketing_form.balance}
                                onChange={e => setMarketingForm(f => ({ ...f, balance: parseFloat(e.target.value) }))}
                            />
                        </div>
                        <div className='dpa-admin__field'>
                            <label>Win Rate (out of cycle size)</label>
                            <input
                                type='number'
                                min={1}
                                value={marketing_form.win_rate}
                                onChange={e => setMarketingForm(f => ({ ...f, win_rate: parseInt(e.target.value) }))}
                            />
                        </div>
                        <div className='dpa-admin__field'>
                            <label>Cycle Size (total trades per cycle)</label>
                            <input
                                type='number'
                                min={1}
                                value={marketing_form.cycle_size}
                                onChange={e => setMarketingForm(f => ({ ...f, cycle_size: parseInt(e.target.value) }))}
                            />
                        </div>
                        <div className='dpa-admin__field' style={{ alignSelf: 'flex-end' }}>
                            <button className='btn-approve' onClick={handleCreateMarketing}>
                                + Assign User
                            </button>
                        </div>
                    </div>

                    {/* Accounts table */}
                    {marketing_accounts.length === 0 ? (
                        <p style={{ color: '#999' }}>No marketing accounts assigned yet.</p>
                    ) : (
                        <div className='dpa-admin__table-wrapper'>
                            <table className='dpa-admin__table'>
                                <thead>
                                    <tr>
                                        <th>Login ID</th>
                                        <th>Fake ID</th>
                                        <th>Balance</th>
                                        <th>Win Rate</th>
                                        <th>Trades</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marketing_accounts.map((acc: TMarketingAccount) => (
                                        <tr key={acc.id as string}>
                                            <td className='login-id'>{acc.deriv_loginid as string}</td>
                                            <td className='login-id'>{acc.fake_loginid as string}</td>
                                            <td>${(acc.balance as number)?.toFixed(2)}</td>
                                            <td>
                                                {acc.win_rate as number}/{acc.cycle_size as number}
                                            </td>
                                            <td>{acc.trade_counter as number}</td>
                                            <td>
                                                <span
                                                    className={`status-badge ${acc.is_active ? 'active' : 'inactive'}`}
                                                >
                                                    {acc.is_active ? 'Active' : 'Off'}
                                                </span>
                                            </td>
                                            <td className='actions'>
                                                <button
                                                    className={acc.is_active ? 'btn-disqualify' : 'btn-approve'}
                                                    onClick={() => handleToggleMarketing(acc)}
                                                >
                                                    {acc.is_active ? 'Disable' : 'Enable'}
                                                </button>
                                                <button
                                                    className='btn-approve'
                                                    style={{ background: '#1565c0' }}
                                                    onClick={() => handleResetBalance(acc)}
                                                >
                                                    Reset
                                                </button>
                                                <button
                                                    className='btn-disqualify'
                                                    onClick={() => handleDeleteMarketing(acc)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Competition Tab */}
            {active_tab === 'competition' && (
                <div className='dpa-admin__section'>
                    <h2>Competition Control</h2>
                    <div className='dpa-admin__settings-grid'>
                        {[
                            { key: 'min_profit_for_top10', label: 'Min Profit for Top 10 ($)', type: 'number' },
                            { key: 'min_balance_for_top10', label: 'Min Balance for Top 10 ($)', type: 'number' },
                            { key: 'top10_min_funded', label: 'Top 10 Min Funded Amount ($)', type: 'number' },
                            { key: 'top10_max_funded', label: 'Top 10 Max Funded Amount ($)', type: 'number' },
                        ].map(field => (
                            <div key={field.key} className='dpa-admin__field'>
                                <label>{field.label}</label>
                                <input
                                    type={field.type}
                                    value={(settings[field.key] as string | number) || ''}
                                    onChange={e => updateSetting(field.key, parseFloat(e.target.value))}
                                />
                            </div>
                        ))}
                    </div>
                    <button className='dpa-admin__save-btn' onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Competition Settings'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
