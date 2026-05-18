import React, { useEffect, useState } from 'react';
import { observer, useStore } from '@deriv/stores';
import {
    getSettings,
    updateSettings,
    getFundedAccounts,
    getAllUsers,
    adminGetUserAnalytics,
    getTradeStatsAllUsers,
    uploadBotXml,
    getFreeBots,
    createFreeBot,
    updateFreeBot,
    deleteFreeBot,
    getAllParticipants,
    adminResetParticipant,
    adminFullResetParticipant,
    adminRemoveParticipant,
    adminToggleParticipantDbExits,
    adminUpdateParticipantDbSettings,
    getViolations,
    getChallengeTiers,
    upsertChallengeTier,
    deleteChallengeTier,
    getExitSpotsAllMarkets,
    getAllMarketingAccounts,
    upsertMarketingAccount,
    deleteMarketingAccount,
} from 'Services/supabase';
import { ALL_MARKETS } from 'Modules/MarketAnalysis/MarketAnalysisService';
import AdminUserDetail from './AdminUserDetail';
import './admin.scss';

const ADMIN_PASSWORD = 'DPA@Ben7801#secure';

// ── Types ─────────────────────────────────────────────────────────────────────
type TBot = {
    id?: string;
    name: string;
    version: string;
    description: string;
    market: string;
    trade_type: string;
    win_rate: number;
    avg_profit: string;
    risk: string;
    tags: string; // comma-separated in form
    download_url: string;
    bot_code: string;
    is_featured: boolean;
    is_active: boolean;
};

const EMPTY_BOT: TBot = {
    name: '',
    version: 'v1.0',
    description: '',
    market: '',
    trade_type: 'Rise/Fall',
    win_rate: 0,
    avg_profit: '',
    risk: 'Low',
    tags: '',
    download_url: '',
    bot_code: '',
    is_featured: false,
    is_active: true,
};

// ── ExitModeToggle ────────────────────────────────────────────────────────────
const ExitModeToggle = ({ is_active, onToggle }: { is_active: boolean; onToggle: () => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div
            onClick={onToggle}
            title={is_active ? 'DB exit spots ON — click to disable' : 'DB exit spots OFF — click to enable'}
            style={{
                width: 44,
                height: 22,
                borderRadius: 11,
                background: is_active ? '#16a534' : '#444',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 3,
                    left: is_active ? 23 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                }}
            />
        </div>
        <span style={{ fontSize: 10, color: is_active ? '#16a534' : '#666', fontWeight: 700 }}>
            {is_active ? 'DB Spots' : 'Live Tick'}
        </span>
    </div>
);

// ── ParticipantTable ──────────────────────────────────────────────────────────
type ParticipantTableProps = {
    participants: any[];
    db_settings_input: Record<string, { win_rate: string; cycle_size: string }>;
    setDbSettingsInput: React.Dispatch<React.SetStateAction<Record<string, { win_rate: string; cycle_size: string }>>>;
    new_balance_input: Record<string, string>;
    setNewBalanceInput: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    participant_violations: Record<string, any[]>;
    full_resetting: string | null;
    removing: string | null;
    db_save_status: Record<string, 'saving' | 'saved' | 'error'>;
    selected_ids: Set<string>;
    onToggleSelect: (login_id: string) => void;
    onSelectAll: (login_ids: string[]) => void;
    onToggleDbExits: (login_id: string, current: boolean) => void;
    onSaveDbSettings: (login_id: string, use_db: boolean) => void;
    onFullReset: (login_id: string, start_balance: number) => void;
    onRemove: (login_id: string) => void;
    onViewLog: (login_id: string) => void;
};

const ParticipantTable = ({
    participants,
    db_settings_input,
    setDbSettingsInput,
    new_balance_input,
    setNewBalanceInput,
    participant_violations,
    full_resetting,
    removing,
    db_save_status,
    selected_ids,
    onToggleSelect,
    onSelectAll,
    onToggleDbExits,
    onSaveDbSettings,
    onFullReset,
    onRemove,
    onViewLog,
}: ParticipantTableProps) => {
    const all_ids = participants.map((p: any) => p.deriv_login_id);
    const all_selected = all_ids.length > 0 && all_ids.every((id: string) => selected_ids.has(id));
    return (
        <table className='dpa-admin__table'>
            <thead>
                <tr>
                    <th style={{ width: 32 }}>
                        <input
                            type='checkbox'
                            checked={all_selected}
                            onChange={() => onSelectAll(all_ids)}
                            title='Select all in this group'
                            style={{ cursor: 'pointer' }}
                        />
                    </th>
                    <th>Login ID</th>
                    <th>Phase</th>
                    <th>Status</th>
                    <th>Balance</th>
                    <th>Net Profit</th>
                    <th>Drawdown</th>
                    <th>Exit Mode</th>
                    <th>Win / Cycle</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {participants.map((p: any) => {
                    const login_id = p.deriv_login_id;
                    const inputs = db_settings_input[login_id] ?? {};
                    const violations = participant_violations[login_id];
                    const is_blown = p.phase_status === 'blown' || p.is_disqualified;
                    const is_passed = p.phase_status === 'passed' || p.phase_status === 'funded';
                    return (
                        <React.Fragment key={login_id}>
                            <tr
                                style={{
                                    background: is_blown
                                        ? 'rgba(255,68,79,0.08)'
                                        : is_passed
                                          ? 'rgba(22,165,52,0.06)'
                                          : undefined,
                                }}
                            >
                                <td>
                                    <input
                                        type='checkbox'
                                        checked={selected_ids.has(login_id)}
                                        onChange={() => onToggleSelect(login_id)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>
                                <td>
                                    <strong>{login_id}</strong>
                                </td>
                                <td style={{ color: '#aaa', fontSize: 12 }}>Phase {p.current_phase ?? 1}</td>
                                <td>
                                    <span
                                        className={`dpa-admin__status dpa-admin__status--${p.phase_status ?? 'active'}`}
                                    >
                                        {p.phase_status ?? 'active'}
                                    </span>
                                </td>
                                <td>${parseFloat(p.current_balance ?? 0).toFixed(2)}</td>
                                <td
                                    style={{ color: (p.net_profit ?? 0) >= 0 ? '#16a534' : '#ff444f', fontWeight: 600 }}
                                >
                                    {(p.net_profit ?? 0) >= 0 ? '+' : ''}
                                    {parseFloat(p.net_profit ?? 0).toFixed(2)}
                                </td>
                                <td style={{ color: '#ff444f' }}>
                                    {parseFloat(p.total_drawdown_percent ?? 0).toFixed(1)}%
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <ExitModeToggle
                                        is_active={!!p.use_db_exit_spots}
                                        onToggle={() => onToggleDbExits(login_id, !!p.use_db_exit_spots)}
                                    />
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <input
                                            type='number'
                                            placeholder={`W:${p.db_win_rate ?? 7}`}
                                            value={inputs.win_rate ?? ''}
                                            disabled={!p.use_db_exit_spots}
                                            onChange={e =>
                                                setDbSettingsInput(prev => ({
                                                    ...prev,
                                                    [login_id]: { ...prev[login_id], win_rate: e.target.value },
                                                }))
                                            }
                                            style={{
                                                width: 52,
                                                background: 'transparent',
                                                border: '1px solid #666',
                                                color: 'inherit',
                                                borderRadius: 4,
                                                padding: '3px 6px',
                                                fontSize: 12,
                                                opacity: p.use_db_exit_spots ? 1 : 0.35,
                                                cursor: p.use_db_exit_spots ? 'auto' : 'not-allowed',
                                            }}
                                        />
                                        <span style={{ color: '#aaa', fontSize: 11 }}>/</span>
                                        <input
                                            type='number'
                                            placeholder={`C:${p.db_cycle_size ?? 10}`}
                                            value={inputs.cycle_size ?? ''}
                                            disabled={!p.use_db_exit_spots}
                                            onChange={e =>
                                                setDbSettingsInput(prev => ({
                                                    ...prev,
                                                    [login_id]: { ...prev[login_id], cycle_size: e.target.value },
                                                }))
                                            }
                                            style={{
                                                width: 52,
                                                background: 'transparent',
                                                border: '1px solid #666',
                                                color: 'inherit',
                                                borderRadius: 4,
                                                padding: '3px 6px',
                                                fontSize: 12,
                                                opacity: p.use_db_exit_spots ? 1 : 0.35,
                                                cursor: p.use_db_exit_spots ? 'auto' : 'not-allowed',
                                            }}
                                        />
                                        <button
                                            onClick={() => onSaveDbSettings(login_id, !!p.use_db_exit_spots)}
                                            disabled={db_save_status[login_id] === 'saving'}
                                            style={{
                                                background:
                                                    db_save_status[login_id] === 'saved'
                                                        ? '#16a534'
                                                        : db_save_status[login_id] === 'error'
                                                          ? '#ff444f'
                                                          : '#e8a000',
                                                color: '#111',
                                                border: 'none',
                                                borderRadius: 4,
                                                padding: '3px 8px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                minWidth: 44,
                                            }}
                                        >
                                            {db_save_status[login_id] === 'saving'
                                                ? '...'
                                                : db_save_status[login_id] === 'saved'
                                                  ? 'Saved!'
                                                  : db_save_status[login_id] === 'error'
                                                    ? 'Error'
                                                    : 'Save'}
                                        </button>
                                    </div>
                                </td>
                                <td className='dpa-admin__row-actions' style={{ minWidth: 200 }}>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                                        <input
                                            type='number'
                                            placeholder='New bal $'
                                            value={new_balance_input[login_id] ?? ''}
                                            onChange={e =>
                                                setNewBalanceInput(prev => ({ ...prev, [login_id]: e.target.value }))
                                            }
                                            style={{
                                                width: 90,
                                                background: '#1a1f23',
                                                border: '1px solid #e8a000',
                                                color: '#fff',
                                                borderRadius: 4,
                                                padding: '3px 6px',
                                                fontSize: 12,
                                            }}
                                        />
                                        <button
                                            style={{
                                                background: '#e8a000',
                                                color: '#1a1a1a',
                                                border: 'none',
                                                borderRadius: 4,
                                                padding: '4px 8px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                            }}
                                            onClick={() => onFullReset(login_id, p.start_balance ?? 1000)}
                                            disabled={full_resetting === login_id}
                                        >
                                            {full_resetting === login_id ? '…' : 'Restart'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                            className='dpa-admin__del-btn'
                                            style={{ fontSize: 11, padding: '3px 8px' }}
                                            onClick={() => onRemove(login_id)}
                                            disabled={removing === login_id}
                                        >
                                            {removing === login_id ? '…' : 'Remove'}
                                        </button>
                                        <button
                                            className='dpa-admin__edit-btn'
                                            style={{ fontSize: 11 }}
                                            onClick={() => onViewLog(login_id)}
                                        >
                                            {violations ? 'Hide Log' : 'View Log'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {violations && violations.length > 0 && (
                                <tr key={`${login_id}-viol`}>
                                    <td colSpan={10} style={{ background: '#111', padding: '8px 16px' }}>
                                        <div style={{ fontSize: 12, color: '#aaa' }}>
                                            <strong style={{ color: '#ff444f' }}>
                                                Violations ({violations.length}):
                                            </strong>
                                            {violations.slice(0, 10).map((v: any) => (
                                                <div
                                                    key={v.id}
                                                    style={{ padding: '4px 0', borderBottom: '1px solid #222' }}
                                                >
                                                    <span style={{ color: '#666', marginRight: 8 }}>
                                                        {new Date(v.created_at).toLocaleString()}
                                                    </span>
                                                    <span style={{ color: '#e8a000', marginRight: 8 }}>
                                                        [{v.violation_type}]
                                                    </span>
                                                    {v.reason}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {violations && violations.length === 0 && (
                                <tr key={`${login_id}-noviol`}>
                                    <td
                                        colSpan={10}
                                        style={{ background: '#111', padding: '8px 16px', fontSize: 12, color: '#555' }}
                                    >
                                        No violations recorded.
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })}
            </tbody>
        </table>
    );
};

// ── Admin Panel ───────────────────────────────────────────────────────────────
const AdminPage = observer(() => {
    useStore();
    const [auth, setAuth] = useState(sessionStorage.getItem('dpa_admin') === '1');
    const [pw, setPw] = useState('');
    const [pw_error, setPwError] = useState('');
    const [tab, setTab] = useState<
        | 'settings'
        | 'bots'
        | 'funded'
        | 'users'
        | 'participants'
        | 'challenges'
        | 'exitPrices'
        | 'marketing'
        | 'traderProfiles'
    >('settings');

    // ── Settings state ────────────────────────────────────────────────────
    const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
    const [settings_loading, setSettingsLoading] = useState(sessionStorage.getItem('dpa_admin') === '1');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // ── Funded accounts ───────────────────────────────────────────────────
    const [funded, setFunded] = useState<unknown[]>([]);

    // ── Participants ──────────────────────────────────────────────────────
    const [participants, setParticipants] = useState<any[]>([]);
    const [participants_loading, setParticipantsLoading] = useState(false);
    const [participant_violations, setParticipantViolations] = useState<Record<string, any[]>>({});
    const [resetting, setResetting] = useState<string | null>(null);
    const [full_resetting, setFullResetting] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [new_balance_input, setNewBalanceInput] = useState<Record<string, string>>({});
    const [expanded_tiers, setExpandedTiers] = useState<Set<string>>(new Set());
    const [db_settings_input, setDbSettingsInput] = useState<Record<string, { win_rate: string; cycle_size: string }>>(
        {}
    );
    const [db_save_status, setDbSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

    // ── Bulk participant actions ───────────────────────────────────────────
    const [selected_participants, setSelectedParticipants] = useState<Set<string>>(new Set());
    const [bulk_input, setBulkInput] = useState({ win_rate: '', cycle_size: '', use_db: true });
    const [bulk_status, setBulkStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const handleToggleSelect = (login_id: string) => {
        setSelectedParticipants(prev => {
            const next = new Set(prev);
            if (next.has(login_id)) next.delete(login_id);
            else next.add(login_id);
            return next;
        });
    };

    const handleSelectAll = (login_ids: string[]) => {
        setSelectedParticipants(prev => {
            const all_selected = login_ids.every(id => prev.has(id));
            const next = new Set(prev);
            if (all_selected) {
                login_ids.forEach(id => next.delete(id));
            } else {
                login_ids.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleBulkApply = async () => {
        if (selected_participants.size === 0) return;
        const raw_win = bulk_input.win_rate.trim();
        const raw_cycle = bulk_input.cycle_size.trim();
        const win_rate = raw_win ? parseInt(raw_win, 10) : null;
        const cycle_size = raw_cycle ? parseInt(raw_cycle, 10) : null;
        if (win_rate !== null && isNaN(win_rate)) {
            alert('Win rate must be a number.');
            return;
        }
        if (cycle_size !== null && isNaN(cycle_size)) {
            alert('Cycle size must be a number.');
            return;
        }
        if (win_rate !== null && cycle_size !== null && win_rate > cycle_size) {
            alert('Win rate cannot exceed cycle size.');
            return;
        }
        setBulkStatus('saving');
        try {
            await Promise.all(
                Array.from(selected_participants).map(login_id => {
                    const p = participants.find((x: any) => x.deriv_login_id === login_id);
                    return adminUpdateParticipantDbSettings(login_id, {
                        use_db_exit_spots: bulk_input.use_db,
                        db_win_rate: win_rate ?? p?.db_win_rate ?? 7,
                        db_cycle_size: cycle_size ?? p?.db_cycle_size ?? 10,
                    });
                })
            );
            await loadParticipants();
            setBulkStatus('saved');
            setTimeout(() => setBulkStatus('idle'), 2500);
        } catch (e: any) {
            setBulkStatus('error');
            alert(`Bulk update failed: ${e.message}`);
        }
    };

    // ── Challenge Tiers ───────────────────────────────────────────────────
    const EMPTY_TIER = {
        name: '',
        entry_fee: 0,
        funded_amount: 1000,
        profit_target_percent: 10,
        max_daily_loss_percent: 5,
        max_total_drawdown_percent: 10,
        max_stake_per_trade: 100,
        duration_days: 30,
        min_trading_days: 5,
        description: '',
        is_active: true,
    };
    const [tiers, setTiers] = useState<any[]>([]);
    const [tiers_loading, setTiersLoading] = useState(false);
    const [tier_form, setTierForm] = useState<any>(EMPTY_TIER);
    const [editing_tier_id, setEditingTierId] = useState<string | null>(null);
    const [show_tier_form, setShowTierForm] = useState(false);
    const [tier_msg, setTierMsg] = useState('');
    const [tier_saving, setTierSaving] = useState(false);

    // ── Exit Spots ───────────────────────────────────────────────────────
    // exitSpots: Map from market symbol → array of spots ordered epoch ASC
    const [exitSpots, setExitSpots] = useState<Map<string, any[]>>(new Map());
    const [exitSpotsLoading, setExitSpotsLoading] = useState(false);
    const [exitSpotsMarket, setExitSpotsMarket] = useState<string>(ALL_MARKETS[0]?.symbol ?? '');

    const loadExitPrices = async () => {
        setExitSpotsLoading(true);
        try {
            const data = await getExitSpotsAllMarkets();
            // Group by market
            const grouped = new Map<string, any[]>();
            ALL_MARKETS.forEach(m => grouped.set(m.symbol, []));
            data.forEach((row: any) => {
                const arr = grouped.get(row.market_symbol) ?? [];
                arr.push(row);
                grouped.set(row.market_symbol, arr);
            });
            setExitSpots(grouped);
        } catch (err) {
            console.error('Failed to load exit spots:', err);
        } finally {
            setExitSpotsLoading(false);
        }
    };

    // Poll exit spots every 5s while the tab is open
    useEffect(() => {
        if (tab !== 'exitPrices') return;
        const poll = () => {
            getExitSpotsAllMarkets()
                .then(rows => {
                    const next = new Map<string, any[]>();
                    rows.forEach((row: any) => {
                        const arr = next.get(row.market_symbol) ?? [];
                        arr.push(row);
                        next.set(row.market_symbol, arr);
                    });
                    setExitSpots(next);
                })
                .catch(() => {});
        };
        poll();
        const timer = setInterval(poll, 5000);
        return () => clearInterval(timer);
    }, [tab]);

    // ── Users state ───────────────────────────────────────────────────────────
    const [users, setUsers] = useState<any[]>([]);
    const [trade_stats, setTradeStats] = useState<any[]>([]);
    const [users_loading, setUsersLoading] = useState(false);
    const [selected_user, setSelectedUser] = useState<any | null>(null);
    const [user_analytics, setUserAnalytics] = useState<any | null>(null);
    const [user_detail_loading, setUserDetailLoading] = useState(false);
    const [user_search, setUserSearch] = useState('');

    // ── Marketing accounts state ──────────────────────────────────────────
    // ── Trader Profiles ───────────────────────────────────────────────────
    const DPA_API = /derivprofundedacademy\.com/.test(window.location.hostname)
        ? 'https://api.derivprofundedacademy.com/api'
        : 'http://localhost:8011/api';

    const DERIV_PAYOUTS: Record<string, number> = {
        Rise: 87,
        Fall: 87,
        Higher: 87,
        Lower: 87,
        Even: 95,
        Odd: 95,
        Matches: 95,
        Differs: 95,
        Over: 95,
        Under: 95,
        Touch: 75,
        'No Touch': 75,
    };

    const TRADE_TYPES = [
        'Rise',
        'Fall',
        'Even',
        'Odd',
        'Higher',
        'Lower',
        'Matches',
        'Differs',
        'Over',
        'Under',
        'Touch',
        'No Touch',
    ];
    const MARKETS = [
        'Volatility 10 (1s)',
        'Volatility 25 (1s)',
        'Volatility 50 (1s)',
        'Volatility 75 (1s)',
        'Volatility 100 (1s)',
        'Volatility 10',
        'Volatility 25',
        'Volatility 50',
        'Volatility 75',
        'Volatility 100',
        'EUR/USD',
        'GBP/USD',
        'USD/JPY',
        'AUD/USD',
        'Gold (XAU)',
        'Bitcoin (BTC)',
    ];

    // Auto-generate a masked CR ID like CR56**78 and an internal CR login
    const gen_cr = () => {
        const n = Math.floor(100000 + Math.random() * 900000); // 6-digit number
        const s = String(n);
        return {
            masked_id: `CR${s.slice(0, 2)}**${s.slice(4)}`,
            deriv_loginid: `CR${n}`,
        };
    };

    const EMPTY_PROFILE = {
        display_name: '',
        account_type: 'funded',
        funded_balance: '1000',
        show_on_leaderboard: true,
        show_on_free_bots: false,
    };

    const EMPTY_GEN = {
        num_trades: '100',
        trade_type: 'Rise',
        market: 'Volatility 100 (1s)',
        time_frame_days: '30',
        deriv_payout_rate: '87',
        platform_commission: '',
        win_rate_percent: '65',
        stake: '5',
        bot_used: '',
        reset_trades: false,
    };

    const [trader_profiles, setTraderProfiles] = useState<any[]>([]);
    const [tp_loading, setTpLoading] = useState(false);
    const [tp_form, setTpForm] = useState<any>({ ...EMPTY_PROFILE });
    const [tp_edit_id, setTpEditId] = useState<number | null>(null);
    const [tp_saving, setTpSaving] = useState(false);
    const [gen_profile_id, setGenProfileId] = useState<number | null>(null);
    const [gen_form, setGenForm] = useState<any>({ ...EMPTY_GEN });
    const [gen_loading, setGenLoading] = useState(false);
    const [gen_result, setGenResult] = useState<any>(null);
    const [commission_saving, setCommissionSaving] = useState(false);
    const [commission_saved, setCommissionSaved] = useState(false);
    const [markup_status, setMarkupStatus] = useState<'idle' | 'detecting' | 'ok' | 'fallback'>('idle');

    const loadTraderProfiles = async () => {
        setTpLoading(true);
        try {
            const r = await fetch(`${DPA_API}/admin/trader-profiles/`);
            setTraderProfiles(await r.json());
        } finally {
            setTpLoading(false);
        }
    };

    // Open one WebSocket proposal call and return the payout for $100 stake CALL on R_100 5t
    const _proposalPayout = (app_id: string): Promise<number> =>
        new Promise(resolve => {
            try {
                const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}`);
                const timer = setTimeout(() => {
                    try {
                        ws.close();
                    } catch {}
                    resolve(-1);
                }, 8000);
                ws.onopen = () =>
                    ws.send(
                        JSON.stringify({
                            proposal: 1,
                            amount: 100,
                            basis: 'stake',
                            contract_type: 'CALL',
                            currency: 'USD',
                            duration: 5,
                            duration_unit: 't',
                            symbol: 'R_100',
                        })
                    );
                ws.onmessage = e => {
                    const d = JSON.parse(e.data);
                    if (d.msg_type === 'proposal' && d.proposal?.payout) {
                        clearTimeout(timer);
                        ws.close();
                        resolve(d.proposal.payout);
                    }
                };
                ws.onerror = () => resolve(-1);
            } catch {
                resolve(-1);
            }
        });

    // Auto-detect markup from the Deriv API by comparing payout with vs without platform markup
    const detectDerivMarkup = async (): Promise<number> => {
        const platform_app_id = window.localStorage.getItem('config.app_id') || '36300';
        const [platform_payout, base_payout] = await Promise.all([
            _proposalPayout(platform_app_id),
            _proposalPayout('1089'), // Deriv's own tool app — 0% markup baseline
        ]);
        if (platform_payout < 0 || base_payout < 0) return -1;
        const effective_pct = ((platform_payout - 100) / 100) * 100;
        const base_pct = ((base_payout - 100) / 100) * 100;
        return Math.max(0, Math.round((base_pct - effective_pct) * 10) / 10);
    };

    const loadDpaCommission = async () => {
        setMarkupStatus('detecting');
        const markup = await detectDerivMarkup();
        if (markup >= 0) {
            // Successfully read from Deriv API — save it to Django for persistence
            setMarkupStatus('ok');
            setGenForm((f: any) => ({ ...f, platform_commission: String(markup) }));
            fetch(`${DPA_API}/settings/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform_commission: markup }),
            }).catch(() => {});
        } else {
            // Deriv API unreachable — fall back to last saved value in Django
            setMarkupStatus('fallback');
            try {
                const r = await fetch(`${DPA_API}/settings/`);
                const s = await r.json();
                setGenForm((f: any) => ({ ...f, platform_commission: String(s.platform_commission ?? 0) }));
            } catch {
                /* ignore */
            }
        }
    };

    const saveDefaultCommission = async () => {
        setCommissionSaving(true);
        setCommissionSaved(false);
        try {
            await fetch(`${DPA_API}/settings/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform_commission: parseFloat(gen_form.platform_commission) || 0 }),
            });
            setCommissionSaved(true);
            setTimeout(() => setCommissionSaved(false), 2500);
        } finally {
            setCommissionSaving(false);
        }
    };

    const saveTraderProfile = async () => {
        setTpSaving(true);
        try {
            const bal = parseFloat(tp_form.funded_balance) || 1000;
            const ids = tp_edit_id ? {} : gen_cr(); // auto-generate only on create
            const body = {
                display_name: tp_form.display_name,
                account_type: tp_form.account_type,
                start_balance: bal,
                current_balance: bal,
                total_trades: 0,
                winning_trades: 0,
                show_on_leaderboard: tp_form.show_on_leaderboard,
                show_on_free_bots: tp_form.show_on_free_bots,
                ...ids,
            };
            const url = tp_edit_id
                ? `${DPA_API}/admin/trader-profiles/${tp_edit_id}/`
                : `${DPA_API}/admin/trader-profiles/`;
            const method = tp_edit_id ? 'PATCH' : 'POST';
            const r = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!r.ok) throw new Error('Save failed');
            setTpEditId(null);
            setTpForm({ ...EMPTY_PROFILE });
            await loadTraderProfiles();
        } finally {
            setTpSaving(false);
        }
    };

    const deleteTraderProfile = async (id: number) => {
        if (!confirm('Delete this trader profile and all its trades?')) return;
        await fetch(`${DPA_API}/admin/trader-profiles/${id}/`, { method: 'DELETE' });
        await loadTraderProfiles();
    };

    const generateTrades = async () => {
        if (!gen_profile_id) return;
        setGenLoading(true);
        setGenResult(null);
        try {
            const BARRIER_PAYOUTS_GEN: Record<string, number> = {
                '0': 975,
                '1': 768,
                '2': 635,
                '3': 533,
                '4': 438,
                '5': 350,
                '6': 268,
                '7': 195,
                '8': 130,
                '9': 65,
            };
            const is_over_under = gen_form.trade_type === 'Over' || gen_form.trade_type === 'Under';
            const barrier = String(gen_form.barrier ?? '2');
            const markup = parseFloat(gen_form.platform_commission) || 0;
            const deriv_base = is_over_under
                ? (BARRIER_PAYOUTS_GEN[barrier] ?? 350)
                : (DERIV_PAYOUTS[gen_form.trade_type] ?? 87);
            const effective = Math.max(0, deriv_base - markup);
            const body = {
                num_trades: parseInt(gen_form.num_trades),
                trade_type: gen_form.trade_type,
                barrier: is_over_under ? parseInt(barrier) : undefined,
                market: gen_form.market,
                time_frame_days: parseInt(gen_form.time_frame_days),
                deriv_payout_rate: deriv_base,
                platform_payout_rate: effective, // what trader actually receives
                win_rate_percent: parseFloat(gen_form.win_rate_percent),
                stake: parseFloat(gen_form.stake),
                bot_used: gen_form.bot_used,
                reset_trades: gen_form.reset_trades,
            };
            const r = await fetch(`${DPA_API}/admin/trader-profiles/${gen_profile_id}/generate-trades/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await r.json();
            setGenResult(result);
            await loadTraderProfiles();
        } finally {
            setGenLoading(false);
        }
    };

    const [marketing_accounts, setMarketingAccounts] = useState<any[]>([]);
    const [marketing_loading, setMarketingLoading] = useState(false);
    const [marketing_form, setMarketingForm] = useState({
        deriv_loginid: '',
        balance: '',
        win_rate: '',
        cycle_size: '',
    });

    const loadMarketingAccounts = async () => {
        setMarketingLoading(true);
        try {
            setMarketingAccounts(await getAllMarketingAccounts());
        } catch (e) {
            console.error(e);
        } finally {
            setMarketingLoading(false);
        }
    };

    const handleCreateMarketing = async () => {
        if (!marketing_form.deriv_loginid.trim()) {
            alert('Enter a Deriv Login ID.');
            return;
        }
        const balance = parseFloat(marketing_form.balance);
        const win_rate = parseFloat(marketing_form.win_rate);
        const cycle_size = parseInt(marketing_form.cycle_size, 10);
        if (isNaN(balance) || balance <= 0) {
            alert('Enter a valid starting balance (e.g. 1000).');
            return;
        }
        if (isNaN(win_rate) || win_rate <= 0 || win_rate > 100) {
            alert('Enter a valid win rate between 1 and 100.');
            return;
        }
        if (isNaN(cycle_size) || cycle_size < 1) {
            alert('Enter a valid cycle size (e.g. 10).');
            return;
        }
        const fake_loginid = 'CR' + (Math.floor(Math.random() * 9000000) + 1000000);
        try {
            await upsertMarketingAccount({
                deriv_loginid: marketing_form.deriv_loginid.trim(),
                fake_loginid,
                balance,
                start_balance: balance,
                win_rate,
                cycle_size,
                trade_counter: 0,
                is_active: true,
            });
            setMarketingForm({ deriv_loginid: '', balance: '', win_rate: '', cycle_size: '' });
            await loadMarketingAccounts();
        } catch (e) {
            alert('Failed to create marketing account.');
        }
    };

    const handleToggleMarketing = async (acc: any) => {
        try {
            await upsertMarketingAccount({ ...acc, is_active: !acc.is_active });
            await loadMarketingAccounts();
        } catch (e) {
            alert('Failed to toggle.');
        }
    };

    const handleResetMarketingBalance = async (acc: any) => {
        const input = prompt(`Reset balance for ${acc.deriv_loginid} to:`, String(acc.start_balance));
        if (!input) return;
        try {
            await upsertMarketingAccount({ ...acc, balance: parseFloat(input), trade_counter: 0 });
            await loadMarketingAccounts();
        } catch (e) {
            alert('Failed to reset balance.');
        }
    };

    const handleDeleteMarketing = async (acc: any) => {
        if (!window.confirm(`Delete marketing account for ${acc.deriv_loginid}?`)) return;
        try {
            await deleteMarketingAccount(acc.id);
            await loadMarketingAccounts();
        } catch (e) {
            alert('Failed to delete.');
        }
    };

    // ── Bots state ────────────────────────────────────────────────────────
    const [bots, setBots] = useState<TBot[]>([]);
    const [bots_loading, setBotsLoading] = useState(false);
    const [bot_form, setBotForm] = useState<TBot>(EMPTY_BOT);
    const [editing_id, setEditingId] = useState<string | null>(null);
    const [bot_saving, setBotSaving] = useState(false);
    const [bot_msg, setBotMsg] = useState('');
    const [show_form, setShowForm] = useState(false);
    const [xml_file, setXmlFile] = useState<File | null>(null);
    const [xml_uploading, setXmlUploading] = useState(false);

    useEffect(() => {
        if (!auth) return;
        setSettingsLoading(true);
        getSettings()
            .then(data => setSettings(data ?? {}))
            .catch(() => setSettings({}))
            .finally(() => setSettingsLoading(false));
        getFundedAccounts()
            .then(setFunded)
            .catch(() => {});
        loadBots();
        loadMarketingAccounts();
    }, [auth]);

    const loadBots = async () => {
        setBotsLoading(true);
        const data = await getFreeBots(false).catch(() => []);
        setBots(data as TBot[]);
        setBotsLoading(false);
    };

    const loadParticipants = async () => {
        setParticipantsLoading(true);
        try {
            const data = await getAllParticipants();
            setParticipants(data);
        } finally {
            setParticipantsLoading(false);
        }
    };

    const handleParticipantReset = async (login_id: string) => {
        if (!window.confirm(`Reset account for ${login_id}? This will clear blown/suspended status and daily loss.`))
            return;
        setResetting(login_id);
        try {
            await adminResetParticipant(login_id);
            await loadParticipants();
        } catch (e: any) {
            alert(`Reset failed: ${e.message}`);
        } finally {
            setResetting(null);
        }
    };

    const handleFullReset = async (login_id: string, current_start_balance: number) => {
        const raw = new_balance_input[login_id];
        const balance = raw ? parseFloat(raw) : current_start_balance;
        if (!balance || balance <= 0) {
            alert('Enter a valid starting balance for the new challenge.');
            return;
        }
        if (
            !window.confirm(
                `Start a NEW challenge for ${login_id} with $${balance}?\n\nThis will WIPE all current phase progress, profit, and drawdown. This cannot be undone.`
            )
        )
            return;
        setFullResetting(login_id);
        try {
            await adminFullResetParticipant(login_id, balance);
            await loadParticipants();
        } catch (e: any) {
            alert(`Full reset failed: ${e.message}`);
        } finally {
            setFullResetting(null);
        }
    };

    const handleRemoveParticipant = async (login_id: string) => {
        if (!window.confirm(`Remove ${login_id} from all challenges? Their progress will be deleted.`)) return;
        setRemoving(login_id);
        try {
            await adminRemoveParticipant(login_id);
            await loadParticipants();
        } catch (e: any) {
            alert(`Remove failed: ${e.message}`);
        } finally {
            setRemoving(null);
        }
    };

    const handleToggleDbExits = async (login_id: string, current: boolean) => {
        try {
            await adminToggleParticipantDbExits(login_id, !current);
            await loadParticipants();
        } catch (e: any) {
            alert(`Failed to toggle DB exits: ${e.message}`);
        }
    };

    const handleSaveDbSettings = async (login_id: string, use_db: boolean) => {
        const inputs = db_settings_input[login_id] ?? {};
        const p = participants.find((x: any) => x.deriv_login_id === login_id);
        const raw_win = inputs.win_rate?.trim();
        const raw_cycle = inputs.cycle_size?.trim();
        const win_rate = raw_win ? parseInt(raw_win, 10) : (p?.db_win_rate ?? 7);
        const cycle_size = raw_cycle ? parseInt(raw_cycle, 10) : (p?.db_cycle_size ?? 10);
        if (isNaN(win_rate) || isNaN(cycle_size) || win_rate < 0 || cycle_size < 1 || win_rate > cycle_size) {
            alert('Win rate must be 0 or more and not exceed cycle size.');
            return;
        }
        setDbSaveStatus(prev => ({ ...prev, [login_id]: 'saving' }));
        try {
            await adminUpdateParticipantDbSettings(login_id, {
                use_db_exit_spots: use_db,
                db_win_rate: win_rate,
                db_cycle_size: cycle_size,
            });
            await loadParticipants();
            setDbSaveStatus(prev => ({ ...prev, [login_id]: 'saved' }));
            setTimeout(
                () =>
                    setDbSaveStatus(prev => {
                        const n = { ...prev };
                        delete n[login_id];
                        return n;
                    }),
                2000
            );
        } catch (e: any) {
            setDbSaveStatus(prev => ({ ...prev, [login_id]: 'error' }));
            alert(`Failed to save: ${e.message}`);
        }
    };

    const toggleTierExpand = (tier_id: string) => {
        setExpandedTiers(prev => {
            const next = new Set(prev);
            if (next.has(tier_id)) next.delete(tier_id);
            else next.add(tier_id);
            return next;
        });
    };

    const getTierParticipants = (tier: any) =>
        participants.filter(p => Number(p.start_balance) === Number(tier.funded_amount));

    const getUnmatchedParticipants = () =>
        participants.filter(p => !tiers.some(t => Number(t.funded_amount) === Number(p.start_balance)));

    const PHASE_CONFIG = [
        { phase: 1, label: 'Phase 1', color: '#1565c0' },
        { phase: 2, label: 'Phase 2', color: '#7b1fa2' },
        { phase: 3, label: 'Phase 3', color: '#e8a000' },
    ];

    const loadParticipantViolations = async (login_id: string) => {
        const data = await getViolations(login_id);
        setParticipantViolations(prev => ({ ...prev, [login_id]: data }));
    };

    const loadTiers = async () => {
        setTiersLoading(true);
        try {
            const data = await getChallengeTiers();
            setTiers(data);
        } finally {
            setTiersLoading(false);
        }
    };

    const openNewTier = () => {
        setTierForm(EMPTY_TIER);
        setEditingTierId(null);
        setShowTierForm(true);
        setTierMsg('');
    };

    const openEditTier = (tier: any) => {
        setTierForm({ ...tier });
        setEditingTierId(tier.id);
        setShowTierForm(true);
        setTierMsg('');
    };

    const handleTierSave = async () => {
        if (!tier_form.name.trim() || !tier_form.funded_amount) {
            setTierMsg('Challenge name and funded amount are required.');
            return;
        }
        setTierSaving(true);
        setTierMsg('');
        try {
            const payload = editing_tier_id ? { ...tier_form, id: editing_tier_id } : tier_form;
            await upsertChallengeTier(payload);
            setTierMsg(editing_tier_id ? '✓ Challenge updated.' : '✓ Challenge created.');
            await loadTiers();
            setShowTierForm(false);
        } catch (e: any) {
            setTierMsg(`Error: ${e.message}`);
        } finally {
            setTierSaving(false);
        }
    };

    const handleTierDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete challenge "${name}"? This cannot be undone.`)) return;
        try {
            await deleteChallengeTier(id);
            await loadTiers();
        } catch (e: any) {
            alert(`Delete failed: ${e.message}`);
        }
    };

    const toggleTierActive = async (tier: any) => {
        try {
            await upsertChallengeTier({ ...tier, is_active: !tier.is_active });
            await loadTiers();
        } catch (e: any) {
            alert(`Update failed: ${e.message}`);
        }
    };

    const loadUsers = async () => {
        setUsersLoading(true);
        try {
            const [usersData, statsData] = await Promise.all([getAllUsers(), getTradeStatsAllUsers()]);
            setUsers(usersData);
            setTradeStats(statsData);
        } catch {
        } finally {
            setUsersLoading(false);
        }
    };

    const handleViewUser = async (user: any) => {
        setSelectedUser(user);
        setUserAnalytics(null);
        setUserDetailLoading(true);
        try {
            const analytics = await adminGetUserAnalytics(user.deriv_loginid);
            setUserAnalytics(analytics);
        } catch {
            setUserAnalytics({ user, fundedTrades: [], realTrades: [], participant: null });
        } finally {
            setUserDetailLoading(false);
        }
    };

    const handleXmlUpload = async () => {
        if (!xml_file || !bot_form.name.trim()) {
            setBotMsg('Please enter a bot name and select an XML file.');
            return;
        }
        setXmlUploading(true);
        setBotMsg('');
        try {
            const url = await uploadBotXml(xml_file, bot_form.name);
            setBotForm(f => ({ ...f, xml_url: url }) as any);
            setBotMsg(`✓ XML uploaded. URL: ${url}`);
        } catch (e: any) {
            setBotMsg(`Upload error: ${e.message}`);
        } finally {
            setXmlUploading(false);
        }
    };

    const handleLogin = () => {
        if (pw === ADMIN_PASSWORD) {
            sessionStorage.setItem('dpa_admin', '1');
            setAuth(true);
        } else setPwError('Incorrect password');
    };

    const handleSave = async () => {
        if (!settings) return;
        try {
            setSaving(true);
            await updateSettings(settings);
            // Also persist platform_commission to the Django DPA backend
            const commission = (settings.platform_commission as number) ?? 0;
            fetch(`${DPA_API}/settings/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform_commission: commission }),
            }).catch(() => {});
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const set = (key: string, val: unknown) => setSettings(prev => ({ ...prev, [key]: val }));

    // ── Bot CRUD ──────────────────────────────────────────────────────────
    const openNew = () => {
        setBotForm(EMPTY_BOT);
        setEditingId(null);
        setShowForm(true);
        setBotMsg('');
    };

    const openEdit = (bot: TBot) => {
        setBotForm({
            ...bot,
            tags: Array.isArray((bot as any).tags) ? (bot as any).tags.join(', ') : (bot.tags ?? ''),
        });
        setEditingId((bot as any).id ?? null);
        setShowForm(true);
        setBotMsg('');
    };

    const handleBotSave = async () => {
        if (!bot_form.name.trim()) {
            setBotMsg('Bot name is required.');
            return;
        }
        setBotSaving(true);
        setBotMsg('');
        try {
            const { download_url, bot_code, ...rest } = bot_form as any;
            const payload = {
                ...rest,
                tags: bot_form.tags
                    .split(',')
                    .map((t: string) => t.trim())
                    .filter(Boolean),
                win_rate: Number(bot_form.win_rate),
                downloads: editing_id ? undefined : 0,
                xml_url: (bot_form as any).xml_url ?? null,
            };
            if (editing_id) {
                await updateFreeBot(editing_id, payload);
                setBotMsg('✓ Bot updated.');
            } else {
                await createFreeBot(payload);
                setBotMsg('✓ Bot added.');
            }
            await loadBots();
            setShowForm(false);
        } catch (e: any) {
            setBotMsg(`Error: ${e.message}`);
        } finally {
            setBotSaving(false);
        }
    };

    const handleBotDelete = async (id: string, name: string) => {
        if (!window.confirm(`Delete bot "${name}"? This cannot be undone.`)) return;
        await deleteFreeBot(id);
        await loadBots();
    };

    const toggleActive = async (id: string, current: boolean) => {
        await updateFreeBot(id, { is_active: !current });
        await loadBots();
    };

    // ── Login screen ──────────────────────────────────────────────────────
    if (!auth) {
        return (
            <div className='dpa-admin'>
                <div className='dpa-admin__login'>
                    <h2>Admin Access</h2>
                    <input
                        type='password'
                        placeholder='Enter admin password'
                        value={pw}
                        onChange={e => setPw(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        className='dpa-admin__input'
                    />
                    {pw_error && <p className='dpa-admin__error'>{pw_error}</p>}
                    <button className='dpa-admin__btn' onClick={handleLogin}>
                        Login
                    </button>
                </div>
            </div>
        );
    }

    if (!settings || settings_loading) return <div className='dpa-admin__loading'>Loading admin panel...</div>;

    return (
        <div className='dpa-admin'>
            <div className='dpa-admin__header'>
                <h1>Admin Panel</h1>
                <div className='dpa-admin__tabs'>
                    <button
                        className={`dpa-admin__tab${tab === 'settings' ? ' active' : ''}`}
                        onClick={() => setTab('settings')}
                    >
                        ⚙️ Settings
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'bots' ? ' active' : ''}`}
                        onClick={() => setTab('bots')}
                    >
                        🤖 Free Bots
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'funded' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('funded');
                            loadParticipants();
                        }}
                    >
                        💰 Funded Accounts
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'users' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('users');
                            loadUsers();
                        }}
                    >
                        👥 Users
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'participants' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('participants');
                            loadParticipants();
                        }}
                    >
                        🏆 Participants
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'challenges' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('challenges');
                            loadTiers();
                            loadParticipants();
                        }}
                    >
                        🎯 Challenges
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'exitPrices' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('exitPrices');
                            loadExitPrices();
                        }}
                    >
                        📊 Exit Prices
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'marketing' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('marketing');
                            loadMarketingAccounts();
                        }}
                    >
                        🎯 Marketing
                    </button>
                    <button
                        className={`dpa-admin__tab${tab === 'traderProfiles' ? ' active' : ''}`}
                        onClick={() => {
                            setTab('traderProfiles');
                            loadTraderProfiles();
                            loadDpaCommission();
                        }}
                    >
                        🏆 Trader Profiles
                    </button>
                </div>
            </div>

            {/* ── Settings Tab ─────────────────────────────────────────── */}
            {tab === 'settings' && (
                <>
                    <div className='dpa-admin__grid'>
                        <div className='dpa-admin__card'>
                            <h3>Challenge Settings</h3>
                            <div className='dpa-admin__fields'>
                                <label>
                                    Phase 1 Profit Target (%)
                                    <input
                                        type='number'
                                        value={settings.phase1_profit_target as number}
                                        onChange={e => set('phase1_profit_target', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Phase 2 Profit Target (%)
                                    <input
                                        type='number'
                                        value={settings.phase2_profit_target as number}
                                        onChange={e => set('phase2_profit_target', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Phase 3 Profit Target (%)
                                    <input
                                        type='number'
                                        value={settings.phase3_profit_target as number}
                                        onChange={e => set('phase3_profit_target', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Daily Drawdown Limit (%)
                                    <input
                                        type='number'
                                        value={settings.daily_drawdown_limit as number}
                                        onChange={e => set('daily_drawdown_limit', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Disqualification Threshold (%)
                                    <input
                                        type='number'
                                        value={settings.disqualification_threshold as number}
                                        onChange={e => set('disqualification_threshold', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Flips Required to Re-enter
                                    <input
                                        type='number'
                                        value={settings.flips_required_to_reenter as number}
                                        onChange={e => set('flips_required_to_reenter', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Phase 1 Duration (days)
                                    <input
                                        type='number'
                                        value={settings.phase1_duration_days as number}
                                        onChange={e => set('phase1_duration_days', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Phase 2 Duration (days)
                                    <input
                                        type='number'
                                        value={settings.phase2_duration_days as number}
                                        onChange={e => set('phase2_duration_days', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Min Trading Days
                                    <input
                                        type='number'
                                        value={settings.min_trading_days as number}
                                        onChange={e => set('min_trading_days', +e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                        <div className='dpa-admin__card'>
                            <h3>Funded Account Settings</h3>
                            <div className='dpa-admin__fields'>
                                <label>
                                    Trader Profit Split (%)
                                    <input
                                        type='number'
                                        value={settings.profit_split_trader as number}
                                        onChange={e => set('profit_split_trader', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Platform Commission on Payout (%)
                                    <input
                                        type='number'
                                        value={(settings.platform_commission as number) ?? 0}
                                        onChange={e => set('platform_commission', +e.target.value)}
                                    />
                                    <small style={{ color: '#888', fontSize: 11 }}>
                                        Deducted from Deriv rate when generating trades
                                    </small>
                                </label>
                                <label>
                                    Scale Up Months
                                    <input
                                        type='number'
                                        value={settings.scale_up_months as number}
                                        onChange={e => set('scale_up_months', +e.target.value)}
                                    />
                                </label>
                                <label>
                                    Scale Up Target (%)
                                    <input
                                        type='number'
                                        value={settings.scale_up_target as number}
                                        onChange={e => set('scale_up_target', +e.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                        <div className='dpa-admin__card'>
                            <h3>Competition Duration</h3>
                            <div className='dpa-admin__fields'>
                                <label>
                                    Duration
                                    <select
                                        value={settings.competition_duration as string}
                                        onChange={e => set('competition_duration', e.target.value)}
                                    >
                                        <option value='weekly'>Weekly</option>
                                        <option value='monthly'>Monthly</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                        <div className='dpa-admin__card' style={{ gridColumn: '1 / -1' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 16,
                                }}
                            >
                                <div>
                                    <h3 style={{ margin: 0, marginBottom: 6, fontSize: 15 }}>
                                        🎯 Controlled Exit Spots — Funded Accounts
                                    </h3>
                                    <p
                                        style={{
                                            margin: 0,
                                            color: '#888',
                                            fontSize: 12,
                                            maxWidth: 600,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        <strong style={{ color: '#ccc' }}>GLOBAL SWITCH:</strong> When enabled,{' '}
                                        <em>all</em> funded traders will use pre-recorded real market prices from the
                                        database as their trade exit spot, instead of the live tick at the time the
                                        contract expires. You can also enable/disable this per individual trader in the
                                        <strong style={{ color: '#ccc' }}> Participants tab → DB Spots column</strong>.
                                    </p>
                                </div>
                                <label
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 6,
                                        cursor: 'pointer',
                                        minWidth: 120,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: !!settings.funded_db_exit_spots_active ? '#16a534' : '#888',
                                            letterSpacing: 1,
                                        }}
                                    >
                                        {!!settings.funded_db_exit_spots_active ? 'ENABLED (ALL)' : 'DISABLED'}
                                    </span>
                                    <div
                                        onClick={() =>
                                            set('funded_db_exit_spots_active', !settings.funded_db_exit_spots_active)
                                        }
                                        style={{
                                            width: 56,
                                            height: 28,
                                            borderRadius: 14,
                                            background: !!settings.funded_db_exit_spots_active ? '#16a534' : '#444',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                            border: '2px solid transparent',
                                            outline:
                                                '2px solid ' +
                                                (!!settings.funded_db_exit_spots_active ? '#16a534' : '#555'),
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 2,
                                                left: !!settings.funded_db_exit_spots_active ? 28 : 2,
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                background: '#fff',
                                                transition: 'left 0.2s',
                                                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#666' }}>click to toggle · then Save</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className='dpa-admin__save-row'>
                        <button className='dpa-admin__save-btn' onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
                        </button>
                    </div>
                </>
            )}

            {/* ── Bots Tab ──────────────────────────────────────────────── */}
            {tab === 'bots' && (
                <div className='dpa-admin__bots'>
                    <div className='dpa-admin__bots-header'>
                        <h2>Free Bots ({bots.length})</h2>
                        <button className='dpa-admin__add-btn' onClick={openNew}>
                            + Add New Bot
                        </button>
                    </div>

                    {/* ── Bot form ────────────────────────────── */}
                    {show_form && (
                        <div className='dpa-admin__bot-form'>
                            <h3>{editing_id ? 'Edit Bot' : 'Add New Bot'}</h3>
                            <div className='dpa-admin__bot-form-grid'>
                                <label>
                                    Bot Name *
                                    <input
                                        value={bot_form.name}
                                        onChange={e => setBotForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder='e.g. Rise/Fall Pro'
                                    />
                                </label>
                                <label>
                                    Version
                                    <input
                                        value={bot_form.version}
                                        onChange={e => setBotForm(f => ({ ...f, version: e.target.value }))}
                                        placeholder='e.g. v1.0'
                                    />
                                </label>
                                <label>
                                    Market
                                    <input
                                        value={bot_form.market}
                                        onChange={e => setBotForm(f => ({ ...f, market: e.target.value }))}
                                        placeholder='e.g. Volatility 100'
                                    />
                                </label>
                                <label>
                                    Trade Type
                                    <select
                                        value={bot_form.trade_type}
                                        onChange={e => setBotForm(f => ({ ...f, trade_type: e.target.value }))}
                                    >
                                        <option>Rise/Fall</option>
                                        <option>Over/Under</option>
                                        <option>Even/Odd</option>
                                        <option>Digits</option>
                                        <option>Any</option>
                                    </select>
                                </label>
                                <label>
                                    Win Rate (%)
                                    <input
                                        type='number'
                                        value={bot_form.win_rate}
                                        onChange={e => setBotForm(f => ({ ...f, win_rate: +e.target.value }))}
                                    />
                                </label>
                                <label>
                                    Avg Monthly Profit
                                    <input
                                        value={bot_form.avg_profit}
                                        onChange={e => setBotForm(f => ({ ...f, avg_profit: e.target.value }))}
                                        placeholder='e.g. +18%/month'
                                    />
                                </label>
                                <label>
                                    Risk Level
                                    <select
                                        value={bot_form.risk}
                                        onChange={e => setBotForm(f => ({ ...f, risk: e.target.value }))}
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                    </select>
                                </label>
                                <label>
                                    Tags (comma-separated)
                                    <input
                                        value={bot_form.tags}
                                        onChange={e => setBotForm(f => ({ ...f, tags: e.target.value }))}
                                        placeholder='e.g. Martingale, Auto-recovery'
                                    />
                                </label>
                                <label className='dpa-admin__bot-form-full'>
                                    Description
                                    <textarea
                                        rows={3}
                                        value={bot_form.description}
                                        onChange={e => setBotForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder='Describe what the bot does...'
                                    />
                                </label>
                                <div className='dpa-admin__bot-form-full dpa-admin__xml-upload'>
                                    <label>Upload Bot XML File</label>
                                    <div className='dpa-admin__xml-row'>
                                        <input
                                            type='file'
                                            accept='.xml'
                                            onChange={e => setXmlFile(e.target.files?.[0] ?? null)}
                                            className='dpa-admin__file-input'
                                        />
                                        <button
                                            type='button'
                                            className='dpa-admin__upload-btn'
                                            onClick={handleXmlUpload}
                                            disabled={xml_uploading || !xml_file}
                                        >
                                            {xml_uploading ? 'Uploading...' : 'Upload'}
                                        </button>
                                    </div>
                                    {(bot_form as any).xml_url && (
                                        <p className='dpa-admin__xml-url'>
                                            ✓ XML uploaded:{' '}
                                            <a
                                                href={(bot_form as any).xml_url}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                            >
                                                View file
                                            </a>
                                        </p>
                                    )}
                                </div>
                                <div className='dpa-admin__bot-form-checks'>
                                    <label className='dpa-admin__checkbox'>
                                        <input
                                            type='checkbox'
                                            checked={bot_form.is_featured}
                                            onChange={e => setBotForm(f => ({ ...f, is_featured: e.target.checked }))}
                                        />
                                        Featured (shows star badge)
                                    </label>
                                    <label className='dpa-admin__checkbox'>
                                        <input
                                            type='checkbox'
                                            checked={bot_form.is_active}
                                            onChange={e => setBotForm(f => ({ ...f, is_active: e.target.checked }))}
                                        />
                                        Active (visible to users)
                                    </label>
                                </div>
                            </div>
                            {bot_msg && (
                                <p className={`dpa-admin__bot-msg${bot_msg.startsWith('✓') ? ' success' : ' error'}`}>
                                    {bot_msg}
                                </p>
                            )}
                            <div className='dpa-admin__bot-form-actions'>
                                <button className='dpa-admin__save-btn' onClick={handleBotSave} disabled={bot_saving}>
                                    {bot_saving ? 'Saving...' : editing_id ? 'Update Bot' : 'Add Bot'}
                                </button>
                                <button className='dpa-admin__cancel-btn' onClick={() => setShowForm(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Bots list ────────────────────────────── */}
                    {bots_loading ? (
                        <p className='dpa-admin__empty'>Loading bots...</p>
                    ) : bots.length === 0 ? (
                        <p className='dpa-admin__empty'>No bots yet. Click "Add New Bot" to create one.</p>
                    ) : (
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Version</th>
                                    <th>Market</th>
                                    <th>Trade Type</th>
                                    <th>Win %</th>
                                    <th>Risk</th>
                                    <th>Downloads</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bots.map((b: any) => (
                                    <tr key={b.id} className={!b.is_active ? 'dpa-admin__row--inactive' : ''}>
                                        <td>
                                            <strong>{b.name}</strong>
                                            {b.is_featured && <span className='dpa-admin__featured-dot'>⭐</span>}
                                        </td>
                                        <td>{b.version}</td>
                                        <td>{b.market}</td>
                                        <td>{b.trade_type}</td>
                                        <td>{b.win_rate}%</td>
                                        <td>
                                            <span
                                                className={`dpa-admin__risk dpa-admin__risk--${b.risk?.toLowerCase()}`}
                                            >
                                                {b.risk}
                                            </span>
                                        </td>
                                        <td>{b.downloads ?? 0}</td>
                                        <td>
                                            <button
                                                className={`dpa-admin__toggle${b.is_active ? ' active' : ''}`}
                                                onClick={() => toggleActive(b.id, b.is_active)}
                                            >
                                                {b.is_active ? 'Live' : 'Hidden'}
                                            </button>
                                        </td>
                                        <td className='dpa-admin__row-actions'>
                                            <button className='dpa-admin__edit-btn' onClick={() => openEdit(b)}>
                                                Edit
                                            </button>
                                            <button
                                                className='dpa-admin__del-btn'
                                                onClick={() => handleBotDelete(b.id, b.name)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Users Tab ─────────────────────────────────────────────── */}
            {tab === 'users' && (
                <div className='dpa-admin__card dpa-admin__card--full'>
                    {selected_user ? (
                        /* ── User detail view ──────────────────────────── */
                        user_detail_loading ? (
                            <p className='dpa-admin__empty'>Loading analytics...</p>
                        ) : user_analytics ? (
                            <AdminUserDetail
                                user={user_analytics.user ?? selected_user}
                                fundedTrades={user_analytics.fundedTrades}
                                realTrades={user_analytics.realTrades}
                                participant={user_analytics.participant}
                                onBack={() => {
                                    setSelectedUser(null);
                                    setUserAnalytics(null);
                                }}
                            />
                        ) : null
                    ) : (
                        /* ── User list ─────────────────────────────────── */
                        <>
                            <div className='dpa-admin__users-header'>
                                <h3>Platform Users ({users.length})</h3>
                                <input
                                    className='dpa-admin__search'
                                    placeholder='Search by login ID or name…'
                                    value={user_search}
                                    onChange={e => setUserSearch(e.target.value)}
                                />
                            </div>
                            {users_loading ? (
                                <p className='dpa-admin__empty'>Loading users...</p>
                            ) : users.length === 0 ? (
                                <p className='dpa-admin__empty'>No users have used the platform yet.</p>
                            ) : (
                                <table className='dpa-admin__table'>
                                    <thead>
                                        <tr>
                                            <th>Login ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Country</th>
                                            <th>Funded Trades</th>
                                            <th>Funded Win %</th>
                                            <th>Real Trades</th>
                                            <th>Real Win %</th>
                                            <th>Last Seen</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users
                                            .filter((u: any) => {
                                                if (!user_search) return true;
                                                const q = user_search.toLowerCase();
                                                return (
                                                    (u.deriv_loginid ?? '').toLowerCase().includes(q) ||
                                                    (u.name ?? '').toLowerCase().includes(q) ||
                                                    (u.email ?? '').toLowerCase().includes(q)
                                                );
                                            })
                                            .map((u: any) => {
                                                const user_trades = trade_stats.filter(
                                                    (t: any) => t.deriv_loginid === u.deriv_loginid
                                                );
                                                const funded = user_trades.filter(
                                                    (t: any) => t.account_type === 'funded'
                                                );
                                                const real = user_trades.filter((t: any) => t.account_type === 'real');
                                                const fundedWins = funded.filter((t: any) => t.is_win).length;
                                                const realWins = real.filter((t: any) => t.is_win).length;
                                                const fundedWR =
                                                    funded.length > 0
                                                        ? Math.round((fundedWins / funded.length) * 100)
                                                        : null;
                                                const realWR =
                                                    real.length > 0 ? Math.round((realWins / real.length) * 100) : null;
                                                return (
                                                    <tr
                                                        key={u.id}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => handleViewUser(u)}
                                                    >
                                                        <td>
                                                            <strong>{u.deriv_loginid}</strong>
                                                        </td>
                                                        <td>{u.name ?? '—'}</td>
                                                        <td style={{ fontSize: '12px', color: '#aaa' }}>
                                                            {u.email ?? '—'}
                                                        </td>
                                                        <td>{u.country ?? '—'}</td>
                                                        <td>{funded.length}</td>
                                                        <td
                                                            style={{
                                                                color:
                                                                    fundedWR !== null
                                                                        ? fundedWR >= 50
                                                                            ? '#16a534'
                                                                            : '#ff444f'
                                                                        : undefined,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {fundedWR !== null ? `${fundedWR}%` : '—'}
                                                        </td>
                                                        <td>{real.length}</td>
                                                        <td
                                                            style={{
                                                                color:
                                                                    realWR !== null
                                                                        ? realWR >= 50
                                                                            ? '#16a534'
                                                                            : '#ff444f'
                                                                        : undefined,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {realWR !== null ? `${realWR}%` : '—'}
                                                        </td>
                                                        <td>
                                                            {u.last_seen
                                                                ? new Date(u.last_seen).toLocaleDateString()
                                                                : '—'}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className='dpa-admin__edit-btn'
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleViewUser(u);
                                                                }}
                                                            >
                                                                View Reports
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── Participants Tab ───────────────────────────────────────── */}
            {tab === 'participants' && (
                <div className='dpa-admin__card dpa-admin__card--full'>
                    <div className='dpa-admin__users-header'>
                        <h3>Challenge Participants ({participants.length})</h3>
                        <button className='dpa-admin__add-btn' onClick={loadParticipants}>
                            Refresh
                        </button>
                    </div>
                    {participants_loading ? (
                        <p className='dpa-admin__empty'>Loading participants...</p>
                    ) : participants.length === 0 ? (
                        <p className='dpa-admin__empty'>No participants yet.</p>
                    ) : (
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>Login ID</th>
                                    <th>Phase</th>
                                    <th>Status</th>
                                    <th>Balance</th>
                                    <th>Net Profit</th>
                                    <th>Daily Loss</th>
                                    <th>Drawdown</th>
                                    <th>Blown</th>
                                    <th>Suspended</th>
                                    <th>DB Spots</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participants.map((p: any) => {
                                    const is_blown = p.is_blown;
                                    const is_suspended = p.is_suspended;
                                    const violations = participant_violations[p.deriv_login_id];
                                    return (
                                        <React.Fragment key={p.deriv_login_id}>
                                            <tr
                                                style={{
                                                    background: is_blown
                                                        ? 'rgba(255,68,79,0.08)'
                                                        : is_suspended
                                                          ? 'rgba(232,160,0,0.08)'
                                                          : undefined,
                                                }}
                                            >
                                                <td>
                                                    <strong>{p.deriv_login_id}</strong>
                                                </td>
                                                <td>Phase {p.current_phase ?? 1}</td>
                                                <td>
                                                    <span
                                                        className={`dpa-admin__status dpa-admin__status--${p.phase_status ?? 'active'}`}
                                                    >
                                                        {p.phase_status ?? 'active'}
                                                    </span>
                                                </td>
                                                <td>${parseFloat(p.current_balance ?? 0).toFixed(2)}</td>
                                                <td
                                                    style={{
                                                        color: (p.net_profit ?? 0) >= 0 ? '#16a534' : '#ff444f',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {(p.net_profit ?? 0) >= 0 ? '+' : ''}
                                                    {parseFloat(p.net_profit ?? 0).toFixed(2)}
                                                </td>
                                                <td style={{ color: '#e8a000' }}>
                                                    ${parseFloat(p.daily_loss_today ?? 0).toFixed(2)}
                                                </td>
                                                <td style={{ color: '#ff444f' }}>
                                                    {parseFloat(p.total_drawdown_percent ?? 0).toFixed(1)}%
                                                </td>
                                                <td>
                                                    {is_blown ? (
                                                        <span style={{ color: '#ff444f', fontWeight: 700 }}>YES</span>
                                                    ) : (
                                                        <span style={{ color: '#555' }}>—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {is_suspended ? (
                                                        <span style={{ color: '#e8a000', fontWeight: 700 }}>YES</span>
                                                    ) : (
                                                        <span style={{ color: '#555' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                        }}
                                                    >
                                                        <div
                                                            onClick={() =>
                                                                handleToggleDbExits(
                                                                    p.deriv_login_id,
                                                                    !!p.use_db_exit_spots
                                                                )
                                                            }
                                                            title={
                                                                p.use_db_exit_spots
                                                                    ? 'DB exit spots ON — click to disable'
                                                                    : 'DB exit spots OFF — click to enable'
                                                            }
                                                            style={{
                                                                width: 44,
                                                                height: 22,
                                                                borderRadius: 11,
                                                                background: p.use_db_exit_spots ? '#16a534' : '#444',
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                transition: 'background 0.2s',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 3,
                                                                    left: p.use_db_exit_spots ? 23 : 3,
                                                                    width: 16,
                                                                    height: 16,
                                                                    borderRadius: '50%',
                                                                    background: '#fff',
                                                                    transition: 'left 0.2s',
                                                                }}
                                                            />
                                                        </div>
                                                        <span
                                                            style={{
                                                                fontSize: 10,
                                                                color: p.use_db_exit_spots ? '#16a534' : '#666',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {p.use_db_exit_spots ? 'DB Spots' : 'Live Tick'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className='dpa-admin__row-actions' style={{ minWidth: 220 }}>
                                                    {/* Restart challenge with new balance */}
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: 4,
                                                            alignItems: 'center',
                                                            marginBottom: 6,
                                                        }}
                                                    >
                                                        <input
                                                            type='number'
                                                            placeholder='New balance $'
                                                            value={new_balance_input[p.deriv_login_id] ?? ''}
                                                            onChange={e =>
                                                                setNewBalanceInput(prev => ({
                                                                    ...prev,
                                                                    [p.deriv_login_id]: e.target.value,
                                                                }))
                                                            }
                                                            style={{
                                                                width: 110,
                                                                background: '#1a1f23',
                                                                border: '1px solid #e8a000',
                                                                color: '#fff',
                                                                borderRadius: 4,
                                                                padding: '4px 8px',
                                                                fontSize: 12,
                                                            }}
                                                        />
                                                        <button
                                                            style={{
                                                                background: '#e8a000',
                                                                color: '#1a1a1a',
                                                                border: 'none',
                                                                borderRadius: 4,
                                                                padding: '4px 8px',
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                            onClick={() =>
                                                                handleFullReset(
                                                                    p.deriv_login_id,
                                                                    p.start_balance ?? 1000
                                                                )
                                                            }
                                                            disabled={full_resetting === p.deriv_login_id}
                                                        >
                                                            {full_resetting === p.deriv_login_id
                                                                ? 'Resetting…'
                                                                : 'Restart'}
                                                        </button>
                                                    </div>
                                                    {/* Remove from challenge entirely */}
                                                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                                        <button
                                                            className='dpa-admin__del-btn'
                                                            style={{ fontSize: 11, padding: '4px 10px' }}
                                                            onClick={() => handleRemoveParticipant(p.deriv_login_id)}
                                                            disabled={removing === p.deriv_login_id}
                                                        >
                                                            {removing === p.deriv_login_id ? 'Removing…' : 'Remove'}
                                                        </button>
                                                        <button
                                                            className='dpa-admin__edit-btn'
                                                            style={{ fontSize: 11 }}
                                                            onClick={() =>
                                                                violations
                                                                    ? setParticipantViolations(prev => {
                                                                          const next = { ...prev };
                                                                          delete next[p.deriv_login_id];
                                                                          return next;
                                                                      })
                                                                    : loadParticipantViolations(p.deriv_login_id)
                                                            }
                                                        >
                                                            {violations ? 'Hide Log' : 'View Log'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {violations && violations.length > 0 && (
                                                <tr key={`${p.deriv_login_id}-violations`}>
                                                    <td
                                                        colSpan={10}
                                                        style={{
                                                            background: '#111',
                                                            padding: '8px 16px',
                                                        }}
                                                    >
                                                        <div style={{ fontSize: 12, color: '#aaa' }}>
                                                            <strong style={{ color: '#ff444f' }}>
                                                                Violations ({violations.length}):
                                                            </strong>
                                                            {violations.slice(0, 10).map((v: any) => (
                                                                <div
                                                                    key={v.id}
                                                                    style={{
                                                                        padding: '4px 0',
                                                                        borderBottom: '1px solid #222',
                                                                    }}
                                                                >
                                                                    <span style={{ color: '#666', marginRight: 8 }}>
                                                                        {new Date(v.created_at).toLocaleString()}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            color: '#e8a000',
                                                                            marginRight: 8,
                                                                        }}
                                                                    >
                                                                        [{v.violation_type}]
                                                                    </span>
                                                                    {v.reason}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {violations && violations.length === 0 && (
                                                <tr key={`${p.deriv_login_id}-no-violations`}>
                                                    <td
                                                        colSpan={10}
                                                        style={{
                                                            background: '#111',
                                                            padding: '8px 16px',
                                                            fontSize: 12,
                                                            color: '#555',
                                                        }}
                                                    >
                                                        No violations recorded.
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Challenges Tab ────────────────────────────────────────── */}
            {tab === 'challenges' && (
                <div className='dpa-admin__bots'>
                    <div className='dpa-admin__bots-header'>
                        <div>
                            <h2>Challenge Tiers ({tiers.length})</h2>
                            <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                                Create challenge packages with different funded amounts and rules. Users enrol in a tier
                                to start a funded challenge.
                            </p>
                        </div>
                        <button className='dpa-admin__add-btn' onClick={openNewTier}>
                            + New Challenge
                        </button>
                    </div>

                    {show_tier_form && (
                        <div className='dpa-admin__bot-form'>
                            <h3>{editing_tier_id ? 'Edit Challenge' : 'Create Challenge'}</h3>
                            <div className='dpa-admin__bot-form-grid'>
                                <label>
                                    Challenge Name *
                                    <input
                                        value={tier_form.name}
                                        onChange={e => setTierForm((f: any) => ({ ...f, name: e.target.value }))}
                                        placeholder='e.g. Starter $1,000'
                                    />
                                </label>
                                <label>
                                    Funded Amount ($) *
                                    <input
                                        type='number'
                                        value={tier_form.funded_amount}
                                        onChange={e =>
                                            setTierForm((f: any) => ({ ...f, funded_amount: +e.target.value }))
                                        }
                                        placeholder='e.g. 1000'
                                    />
                                </label>
                                <label>
                                    Entry Fee ($) — 0 for free
                                    <input
                                        type='number'
                                        value={tier_form.entry_fee}
                                        onChange={e => setTierForm((f: any) => ({ ...f, entry_fee: +e.target.value }))}
                                    />
                                </label>
                                <label>
                                    Profit Target (%)
                                    <input
                                        type='number'
                                        value={tier_form.profit_target_percent}
                                        onChange={e =>
                                            setTierForm((f: any) => ({ ...f, profit_target_percent: +e.target.value }))
                                        }
                                    />
                                </label>
                                <label>
                                    Max Daily Loss (%)
                                    <input
                                        type='number'
                                        value={tier_form.max_daily_loss_percent}
                                        onChange={e =>
                                            setTierForm((f: any) => ({
                                                ...f,
                                                max_daily_loss_percent: +e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    Max Total Drawdown (%)
                                    <input
                                        type='number'
                                        value={tier_form.max_total_drawdown_percent}
                                        onChange={e =>
                                            setTierForm((f: any) => ({
                                                ...f,
                                                max_total_drawdown_percent: +e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label>
                                    Max Stake Per Trade ($)
                                    <input
                                        type='number'
                                        value={tier_form.max_stake_per_trade}
                                        onChange={e =>
                                            setTierForm((f: any) => ({ ...f, max_stake_per_trade: +e.target.value }))
                                        }
                                    />
                                </label>
                                <label>
                                    Duration (days, 0 = unlimited)
                                    <input
                                        type='number'
                                        value={tier_form.duration_days}
                                        onChange={e =>
                                            setTierForm((f: any) => ({ ...f, duration_days: +e.target.value }))
                                        }
                                    />
                                </label>
                                <label>
                                    Min Trading Days
                                    <input
                                        type='number'
                                        value={tier_form.min_trading_days}
                                        onChange={e =>
                                            setTierForm((f: any) => ({ ...f, min_trading_days: +e.target.value }))
                                        }
                                    />
                                </label>
                                <label className='dpa-admin__bot-form-full'>
                                    Description
                                    <textarea
                                        rows={2}
                                        value={tier_form.description}
                                        onChange={e => setTierForm((f: any) => ({ ...f, description: e.target.value }))}
                                        placeholder='Describe this challenge tier...'
                                    />
                                </label>
                                <div className='dpa-admin__bot-form-checks'>
                                    <label className='dpa-admin__checkbox'>
                                        <input
                                            type='checkbox'
                                            checked={tier_form.is_active}
                                            onChange={e =>
                                                setTierForm((f: any) => ({ ...f, is_active: e.target.checked }))
                                            }
                                        />
                                        Active (visible to users)
                                    </label>
                                </div>
                            </div>
                            {tier_msg && (
                                <p className={`dpa-admin__bot-msg${tier_msg.startsWith('✓') ? ' success' : ' error'}`}>
                                    {tier_msg}
                                </p>
                            )}
                            <div className='dpa-admin__bot-form-actions'>
                                <button className='dpa-admin__save-btn' onClick={handleTierSave} disabled={tier_saving}>
                                    {tier_saving
                                        ? 'Saving…'
                                        : editing_tier_id
                                          ? 'Update Challenge'
                                          : 'Create Challenge'}
                                </button>
                                <button className='dpa-admin__cancel-btn' onClick={() => setShowTierForm(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Bulk action bar ── */}
                    {selected_participants.size > 0 && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 16px',
                                background: '#0e1417',
                                border: '1px solid #e8a000',
                                borderRadius: 8,
                                marginBottom: 12,
                                flexWrap: 'wrap',
                            }}
                        >
                            <span style={{ color: '#e8a000', fontWeight: 700, fontSize: 13 }}>
                                {selected_participants.size} selected
                            </span>
                            <button
                                style={{
                                    background: 'transparent',
                                    border: '1px solid #555',
                                    color: '#aaa',
                                    borderRadius: 4,
                                    padding: '3px 8px',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }}
                                onClick={() => setSelectedParticipants(new Set())}
                            >
                                Clear
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                                <label
                                    style={{
                                        fontSize: 12,
                                        color: '#aaa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    Exit Mode
                                    <div
                                        onClick={() => setBulkInput(prev => ({ ...prev, use_db: !prev.use_db }))}
                                        style={{
                                            width: 40,
                                            height: 20,
                                            borderRadius: 10,
                                            background: bulk_input.use_db ? '#16a534' : '#444',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            marginLeft: 4,
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 2,
                                                left: bulk_input.use_db ? 20 : 2,
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                background: '#fff',
                                                transition: 'left 0.2s',
                                            }}
                                        />
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: bulk_input.use_db ? '#16a534' : '#666',
                                            minWidth: 52,
                                        }}
                                    >
                                        {bulk_input.use_db ? 'DB Spots' : 'Live Tick'}
                                    </span>
                                </label>
                                <input
                                    type='number'
                                    placeholder='Win rate'
                                    value={bulk_input.win_rate}
                                    disabled={!bulk_input.use_db}
                                    onChange={e => setBulkInput(prev => ({ ...prev, win_rate: e.target.value }))}
                                    style={{
                                        width: 80,
                                        background: 'transparent',
                                        border: '1px solid #555',
                                        color: 'inherit',
                                        borderRadius: 4,
                                        padding: '3px 8px',
                                        fontSize: 12,
                                        opacity: bulk_input.use_db ? 1 : 0.35,
                                        cursor: bulk_input.use_db ? 'auto' : 'not-allowed',
                                    }}
                                />
                                <span style={{ color: '#666', fontSize: 11 }}>/</span>
                                <input
                                    type='number'
                                    placeholder='Cycle size'
                                    value={bulk_input.cycle_size}
                                    disabled={!bulk_input.use_db}
                                    onChange={e => setBulkInput(prev => ({ ...prev, cycle_size: e.target.value }))}
                                    style={{
                                        width: 80,
                                        background: 'transparent',
                                        border: '1px solid #555',
                                        color: 'inherit',
                                        borderRadius: 4,
                                        padding: '3px 8px',
                                        fontSize: 12,
                                        opacity: bulk_input.use_db ? 1 : 0.35,
                                        cursor: bulk_input.use_db ? 'auto' : 'not-allowed',
                                    }}
                                />
                                <button
                                    onClick={handleBulkApply}
                                    disabled={bulk_status === 'saving'}
                                    style={{
                                        background:
                                            bulk_status === 'saved'
                                                ? '#16a534'
                                                : bulk_status === 'error'
                                                  ? '#ff444f'
                                                  : '#e8a000',
                                        color: '#111',
                                        border: 'none',
                                        borderRadius: 4,
                                        padding: '4px 14px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {bulk_status === 'saving'
                                        ? '…'
                                        : bulk_status === 'saved'
                                          ? 'Applied!'
                                          : bulk_status === 'error'
                                            ? 'Error'
                                            : `Apply to ${selected_participants.size}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {tiers_loading ? (
                        <p className='dpa-admin__empty'>Loading challenges...</p>
                    ) : tiers.length === 0 ? (
                        <p className='dpa-admin__empty'>No challenge tiers yet. Click "New Challenge" to create one.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                            {tiers.map((t: any) => {
                                const tier_ps = getTierParticipants(t);
                                const is_open = expanded_tiers.has(t.id);
                                return (
                                    <div
                                        key={t.id}
                                        style={{ border: '1px solid #2a2f35', borderRadius: 10, overflow: 'hidden' }}
                                    >
                                        {/* ── Tier header ── */}
                                        <div
                                            style={{
                                                background: '#1a1f23',
                                                padding: '12px 16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => toggleTierExpand(t.id)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                                <span style={{ fontSize: 18 }}>{is_open ? '▾' : '▸'}</span>
                                                <div>
                                                    <strong style={{ fontSize: 15, color: '#fff' }}>{t.name}</strong>
                                                    {t.description && (
                                                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                                            {t.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <span
                                                    style={{
                                                        background: '#16a534',
                                                        color: '#fff',
                                                        borderRadius: 6,
                                                        padding: '2px 10px',
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ${Number(t.funded_amount).toLocaleString()}
                                                </span>
                                                <span style={{ color: '#aaa', fontSize: 12 }}>
                                                    {tier_ps.length} participant{tier_ps.length !== 1 ? 's' : ''}
                                                </span>
                                                <span style={{ fontSize: 11, color: '#666' }}>
                                                    Profit {t.profit_target_percent}% · Daily loss{' '}
                                                    {t.max_daily_loss_percent}% · Max stake ${t.max_stake_per_trade}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                                <button
                                                    className={`dpa-admin__toggle${t.is_active ? ' active' : ''}`}
                                                    onClick={() => toggleTierActive(t)}
                                                >
                                                    {t.is_active ? 'Live' : 'Hidden'}
                                                </button>
                                                <button className='dpa-admin__edit-btn' onClick={() => openEditTier(t)}>
                                                    Edit
                                                </button>
                                                <button
                                                    className='dpa-admin__del-btn'
                                                    onClick={() => handleTierDelete(t.id, t.name)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>

                                        {/* ── Tier participants by phase ── */}
                                        {is_open && (
                                            <div style={{ padding: '0 0 12px 0' }}>
                                                {tier_ps.length === 0 ? (
                                                    <p className='dpa-admin__empty' style={{ margin: '16px 20px' }}>
                                                        No participants in this challenge yet.
                                                    </p>
                                                ) : (
                                                    PHASE_CONFIG.map(({ phase, label, color }) => {
                                                        const phase_ps = tier_ps.filter(
                                                            p =>
                                                                (p.current_phase ?? 1) === phase &&
                                                                p.phase_status !== 'funded' &&
                                                                p.phase_status !== 'passed'
                                                        );
                                                        const funded_ps =
                                                            phase === 1
                                                                ? tier_ps.filter(
                                                                      p =>
                                                                          p.phase_status === 'funded' ||
                                                                          p.phase_status === 'passed'
                                                                  )
                                                                : [];
                                                        const show_section =
                                                            phase_ps.length > 0 ||
                                                            (phase === 1 && funded_ps.length > 0);
                                                        if (!show_section && phase !== 1) return null;
                                                        return (
                                                            <React.Fragment key={phase}>
                                                                {phase_ps.length > 0 && (
                                                                    <div style={{ marginTop: 12 }}>
                                                                        <div
                                                                            style={{
                                                                                padding: '6px 16px',
                                                                                background: '#12171a',
                                                                                borderTop: `2px solid ${color}`,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: 8,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    fontWeight: 700,
                                                                                    color,
                                                                                    fontSize: 13,
                                                                                }}
                                                                            >
                                                                                {label}
                                                                            </span>
                                                                            <span
                                                                                style={{ color: '#666', fontSize: 12 }}
                                                                            >
                                                                                {phase_ps.length} trader
                                                                                {phase_ps.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                        <ParticipantTable
                                                                            participants={phase_ps}
                                                                            db_settings_input={db_settings_input}
                                                                            setDbSettingsInput={setDbSettingsInput}
                                                                            new_balance_input={new_balance_input}
                                                                            setNewBalanceInput={setNewBalanceInput}
                                                                            participant_violations={
                                                                                participant_violations
                                                                            }
                                                                            full_resetting={full_resetting}
                                                                            removing={removing}
                                                                            db_save_status={db_save_status}
                                                                            selected_ids={selected_participants}
                                                                            onToggleSelect={handleToggleSelect}
                                                                            onSelectAll={handleSelectAll}
                                                                            onToggleDbExits={handleToggleDbExits}
                                                                            onSaveDbSettings={handleSaveDbSettings}
                                                                            onFullReset={handleFullReset}
                                                                            onRemove={handleRemoveParticipant}
                                                                            onViewLog={(id: string) =>
                                                                                participant_violations[id]
                                                                                    ? setParticipantViolations(prev => {
                                                                                          const n = { ...prev };
                                                                                          delete n[id];
                                                                                          return n;
                                                                                      })
                                                                                    : loadParticipantViolations(id)
                                                                            }
                                                                        />
                                                                    </div>
                                                                )}
                                                                {phase === 1 && funded_ps.length > 0 && (
                                                                    <div style={{ marginTop: 12 }}>
                                                                        <div
                                                                            style={{
                                                                                padding: '6px 16px',
                                                                                background: '#12171a',
                                                                                borderTop: '2px solid #16a534',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: 8,
                                                                            }}
                                                                        >
                                                                            <span
                                                                                style={{
                                                                                    fontWeight: 700,
                                                                                    color: '#16a534',
                                                                                    fontSize: 13,
                                                                                }}
                                                                            >
                                                                                ✅ Funded / Passed
                                                                            </span>
                                                                            <span
                                                                                style={{ color: '#666', fontSize: 12 }}
                                                                            >
                                                                                {funded_ps.length} trader
                                                                                {funded_ps.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                        <ParticipantTable
                                                                            participants={funded_ps}
                                                                            db_settings_input={db_settings_input}
                                                                            setDbSettingsInput={setDbSettingsInput}
                                                                            new_balance_input={new_balance_input}
                                                                            setNewBalanceInput={setNewBalanceInput}
                                                                            participant_violations={
                                                                                participant_violations
                                                                            }
                                                                            full_resetting={full_resetting}
                                                                            removing={removing}
                                                                            db_save_status={db_save_status}
                                                                            selected_ids={selected_participants}
                                                                            onToggleSelect={handleToggleSelect}
                                                                            onSelectAll={handleSelectAll}
                                                                            onToggleDbExits={handleToggleDbExits}
                                                                            onSaveDbSettings={handleSaveDbSettings}
                                                                            onFullReset={handleFullReset}
                                                                            onRemove={handleRemoveParticipant}
                                                                            onViewLog={(id: string) =>
                                                                                participant_violations[id]
                                                                                    ? setParticipantViolations(prev => {
                                                                                          const n = { ...prev };
                                                                                          delete n[id];
                                                                                          return n;
                                                                                      })
                                                                                    : loadParticipantViolations(id)
                                                                            }
                                                                        />
                                                                    </div>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* ── Unmatched participants ── */}
                            {(() => {
                                const unmatched = getUnmatchedParticipants();
                                if (unmatched.length === 0) return null;
                                return (
                                    <div style={{ border: '1px solid #444', borderRadius: 10, overflow: 'hidden' }}>
                                        <div style={{ background: '#1a1f23', padding: '12px 16px' }}>
                                            <strong style={{ color: '#e8a000' }}>
                                                ⚠ Unassigned Participants ({unmatched.length})
                                            </strong>
                                            <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>
                                                Not matched to any challenge tier
                                            </span>
                                        </div>
                                        <ParticipantTable
                                            participants={unmatched}
                                            db_settings_input={db_settings_input}
                                            setDbSettingsInput={setDbSettingsInput}
                                            new_balance_input={new_balance_input}
                                            setNewBalanceInput={setNewBalanceInput}
                                            participant_violations={participant_violations}
                                            full_resetting={full_resetting}
                                            removing={removing}
                                            db_save_status={db_save_status}
                                            selected_ids={selected_participants}
                                            onToggleSelect={handleToggleSelect}
                                            onSelectAll={handleSelectAll}
                                            onToggleDbExits={handleToggleDbExits}
                                            onSaveDbSettings={handleSaveDbSettings}
                                            onFullReset={handleFullReset}
                                            onRemove={handleRemoveParticipant}
                                            onViewLog={(id: string) =>
                                                participant_violations[id]
                                                    ? setParticipantViolations(prev => {
                                                          const n = { ...prev };
                                                          delete n[id];
                                                          return n;
                                                      })
                                                    : loadParticipantViolations(id)
                                            }
                                        />
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* ── Funded Accounts Tab ───────────────────────────────────── */}
            {tab === 'funded' && (
                <div className='dpa-admin__card dpa-admin__card--full'>
                    <h3>Funded Accounts ({(funded as any[]).length})</h3>
                    {(funded as any[]).length === 0 ? (
                        <p className='dpa-admin__empty'>No funded accounts yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {(() => {
                                const groups = new Map<number, any[]>();
                                (funded as any[]).forEach(f => {
                                    const amt = Number(f.funded_amount);
                                    if (!groups.has(amt)) groups.set(amt, []);
                                    groups.get(amt)!.push(f);
                                });
                                return Array.from(groups.entries())
                                    .sort(([a], [b]) => a - b)
                                    .map(([amount, accounts]) => (
                                        <div
                                            key={amount}
                                            style={{
                                                border: '1px solid #2a2f35',
                                                borderRadius: 10,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    background: '#1a1f23',
                                                    padding: '12px 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        background: '#16a534',
                                                        color: '#fff',
                                                        borderRadius: 6,
                                                        padding: '2px 10px',
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    ${amount.toLocaleString()} Funded
                                                </span>
                                                <span style={{ color: '#888', fontSize: 13 }}>
                                                    {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                            <table className='dpa-admin__table'>
                                                <thead>
                                                    <tr>
                                                        <th>Login ID</th>
                                                        <th>Source</th>
                                                        <th>Status</th>
                                                        <th>Total Profit</th>
                                                        <th>Split</th>
                                                        <th>Scale Ups</th>
                                                        <th>Exit Mode</th>
                                                        <th>Win Cycle</th>
                                                        <th>Approved</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {accounts.map((f: any, i: number) => {
                                                        const participant = participants.find(
                                                            p => p.deriv_login_id === f.deriv_login_id
                                                        );
                                                        const login_id = f.deriv_login_id ?? f.masked_login_id;
                                                        const inputs = db_settings_input[login_id] ?? {};
                                                        return (
                                                            <tr key={i}>
                                                                <td>
                                                                    <strong>{f.masked_login_id}</strong>
                                                                </td>
                                                                <td>{f.source}</td>
                                                                <td>
                                                                    <span
                                                                        className={`dpa-admin__status dpa-admin__status--${f.status}`}
                                                                    >
                                                                        {f.status}
                                                                    </span>
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        color:
                                                                            (f.total_profit ?? 0) >= 0
                                                                                ? '#16a534'
                                                                                : '#ff444f',
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    ${(f.total_profit ?? 0).toFixed(2)}
                                                                </td>
                                                                <td>
                                                                    {f.profit_split_trader}% /{' '}
                                                                    {100 - f.profit_split_trader}%
                                                                </td>
                                                                <td>{f.scale_up_count ?? 0}×</td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {login_id ? (
                                                                        <ExitModeToggle
                                                                            is_active={!!participant?.use_db_exit_spots}
                                                                            onToggle={() =>
                                                                                handleToggleDbExits(
                                                                                    login_id,
                                                                                    !!participant?.use_db_exit_spots
                                                                                )
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        '—'
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {login_id && participant ? (
                                                                        <div
                                                                            style={{
                                                                                display: 'flex',
                                                                                gap: 4,
                                                                                alignItems: 'center',
                                                                            }}
                                                                        >
                                                                            <input
                                                                                type='number'
                                                                                placeholder={`W: ${participant.db_win_rate ?? 7}`}
                                                                                value={inputs.win_rate ?? ''}
                                                                                onChange={e =>
                                                                                    setDbSettingsInput(prev => ({
                                                                                        ...prev,
                                                                                        [login_id]: {
                                                                                            ...prev[login_id],
                                                                                            win_rate: e.target.value,
                                                                                        },
                                                                                    }))
                                                                                }
                                                                                style={{
                                                                                    width: 52,
                                                                                    background: 'transparent',
                                                                                    border: '1px solid #666',
                                                                                    color: 'inherit',
                                                                                    borderRadius: 4,
                                                                                    padding: '3px 6px',
                                                                                    fontSize: 12,
                                                                                }}
                                                                            />
                                                                            <span
                                                                                style={{ color: '#aaa', fontSize: 11 }}
                                                                            >
                                                                                /
                                                                            </span>
                                                                            <input
                                                                                type='number'
                                                                                placeholder={`C: ${participant.db_cycle_size ?? 10}`}
                                                                                value={inputs.cycle_size ?? ''}
                                                                                onChange={e =>
                                                                                    setDbSettingsInput(prev => ({
                                                                                        ...prev,
                                                                                        [login_id]: {
                                                                                            ...prev[login_id],
                                                                                            cycle_size: e.target.value,
                                                                                        },
                                                                                    }))
                                                                                }
                                                                                style={{
                                                                                    width: 52,
                                                                                    background: 'transparent',
                                                                                    border: '1px solid #666',
                                                                                    color: 'inherit',
                                                                                    borderRadius: 4,
                                                                                    padding: '3px 6px',
                                                                                    fontSize: 12,
                                                                                }}
                                                                            />
                                                                            <button
                                                                                onClick={() =>
                                                                                    handleSaveDbSettings(
                                                                                        login_id,
                                                                                        !!participant?.use_db_exit_spots
                                                                                    )
                                                                                }
                                                                                style={{
                                                                                    background: '#e8a000',
                                                                                    color: '#111',
                                                                                    border: 'none',
                                                                                    borderRadius: 4,
                                                                                    padding: '3px 8px',
                                                                                    fontSize: 11,
                                                                                    fontWeight: 700,
                                                                                    cursor: 'pointer',
                                                                                }}
                                                                            >
                                                                                Save
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        '—'
                                                                    )}
                                                                </td>
                                                                <td style={{ fontSize: 12, color: '#888' }}>
                                                                    {f.approved_at
                                                                        ? new Date(f.approved_at).toLocaleDateString()
                                                                        : 'Pending'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ));
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* ── Exit Spots Tab ────────────────────────────────────── */}
            {tab === 'exitPrices' && (
                <div className='dpa-admin__card dpa-admin__card--full'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0 }}>Exit Spots — Live Tick Stream</h3>
                        <select
                            value={exitSpotsMarket}
                            onChange={e => setExitSpotsMarket(e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: 4, fontSize: 13 }}
                        >
                            {ALL_MARKETS.map(m => (
                                <option key={m.symbol} value={m.symbol}>
                                    {m.name} ({m.symbol})
                                </option>
                            ))}
                        </select>
                        <button
                            className='dpa-admin__btn dpa-admin__btn--sm'
                            onClick={loadExitPrices}
                            disabled={exitSpotsLoading}
                        >
                            {exitSpotsLoading ? 'Loading…' : '↻ Refresh'}
                        </button>
                        <span style={{ fontSize: 12, color: '#aaa' }}>
                            {exitSpots.get(exitSpotsMarket)?.length ?? 0} / 100 spots stored
                        </span>
                    </div>
                    {exitSpotsLoading ? (
                        <p className='dpa-admin__empty'>Loading exit spots...</p>
                    ) : (exitSpots.get(exitSpotsMarket) ?? []).length === 0 ? (
                        <p className='dpa-admin__empty'>
                            No exit spots recorded for {exitSpotsMarket} yet. The recorder runs automatically — spots
                            appear within a few seconds of loading the app.
                        </p>
                    ) : (
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Exit Price</th>
                                    <th>Epoch</th>
                                    <th>Recorded At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(exitSpots.get(exitSpotsMarket) ?? []).map((p: any, i: number) => (
                                    <tr key={p.id ?? i}>
                                        <td style={{ color: '#888', fontSize: 12 }}>{i + 1}</td>
                                        <td style={{ color: '#16a534', fontWeight: 600, fontFamily: 'monospace' }}>
                                            {parseFloat(p.exit_price).toFixed(5)}
                                        </td>
                                        <td style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>
                                            {p.epoch}
                                        </td>
                                        <td style={{ fontSize: 12, color: '#aaa' }}>
                                            {new Date(p.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Marketing Accounts Tab ────────────────────────────────── */}
            {tab === 'marketing' && (
                <div className='dpa-admin__section'>
                    <h2>🎯 Marketing Accounts</h2>
                    <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
                        Assign users to a simulated account. Their bot trades using stored exit spots with a controlled
                        win/loss cycle. Looks identical to a real account.
                    </p>

                    {/* Create form */}
                    <div
                        style={{
                            background: '#f5f5f5',
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 24,
                            display: 'flex',
                            gap: 16,
                            flexWrap: 'wrap',
                            alignItems: 'flex-end',
                        }}
                    >
                        {[
                            {
                                label: 'Deriv Login ID',
                                placeholder: 'e.g. CR1234567',
                                key: 'deriv_loginid',
                                type: 'text',
                            },
                            { label: 'Starting Balance ($)', placeholder: '1000', key: 'balance', type: 'number' },
                            { label: 'Wins per Cycle', placeholder: '7', key: 'win_rate', type: 'number' },
                            {
                                label: 'Cycle Size (total trades)',
                                placeholder: '10',
                                key: 'cycle_size',
                                type: 'number',
                            },
                        ].map(field => (
                            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{field.label}</label>
                                <input
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    value={(marketing_form as any)[field.key]}
                                    onChange={e =>
                                        setMarketingForm(f => ({
                                            ...f,
                                            [field.key]:
                                                field.type === 'number'
                                                    ? parseFloat(e.target.value) || 0
                                                    : e.target.value,
                                        }))
                                    }
                                    style={{
                                        border: '1px solid #ccc',
                                        borderRadius: 6,
                                        padding: '8px 12px',
                                        fontSize: 14,
                                        width: field.key === 'deriv_loginid' ? 160 : 120,
                                        outline: 'none',
                                        background: '#fff',
                                    }}
                                />
                            </div>
                        ))}
                        <button
                            onClick={handleCreateMarketing}
                            style={{
                                background: '#c0392b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '10px 20px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            + Assign User
                        </button>
                    </div>

                    {marketing_loading ? (
                        <p>Loading...</p>
                    ) : marketing_accounts.length === 0 ? (
                        <p style={{ color: '#aaa' }}>No marketing accounts assigned yet.</p>
                    ) : (
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>Login ID</th>
                                    <th>Fake ID shown</th>
                                    <th>Balance</th>
                                    <th>Win Rate</th>
                                    <th>Trades done</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {marketing_accounts.map((acc: any) => (
                                    <tr key={acc.id}>
                                        <td>{acc.deriv_loginid}</td>
                                        <td style={{ color: '#888' }}>{acc.fake_loginid}</td>
                                        <td>${Number(acc.balance).toFixed(2)}</td>
                                        <td>
                                            {acc.win_rate}/{acc.cycle_size}
                                        </td>
                                        <td>{acc.trade_counter}</td>
                                        <td>
                                            <span style={{ color: acc.is_active ? 'green' : '#aaa', fontWeight: 600 }}>
                                                {acc.is_active ? '● Active' : '○ Off'}
                                            </span>
                                        </td>
                                        <td style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                className='dpa-admin__btn'
                                                style={{
                                                    background: acc.is_active ? '#c62828' : '#2e7d32',
                                                    padding: '4px 10px',
                                                    fontSize: 12,
                                                }}
                                                onClick={() => handleToggleMarketing(acc)}
                                            >
                                                {acc.is_active ? 'Disable' : 'Enable'}
                                            </button>
                                            <button
                                                className='dpa-admin__btn'
                                                style={{ background: '#1565c0', padding: '4px 10px', fontSize: 12 }}
                                                onClick={() => handleResetMarketingBalance(acc)}
                                            >
                                                Reset
                                            </button>
                                            <button
                                                className='dpa-admin__btn'
                                                style={{ background: '#555', padding: '4px 10px', fontSize: 12 }}
                                                onClick={() => handleDeleteMarketing(acc)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
            {/* ── Trader Profiles Tab ──────────────────────────────────────── */}
            {tab === 'traderProfiles' && (
                <div className='dpa-admin__section'>
                    <h2>Trader Profiles</h2>

                    {/* Create / Edit form */}
                    <div className='dpa-admin__card' style={{ marginBottom: 28 }}>
                        <h3>{tp_edit_id ? 'Edit Profile' : 'Create New Profile'}</h3>
                        <p style={{ fontSize: 12, color: '#888', margin: '0 0 14px' }}>
                            Masked ID and CR login are auto-generated on create.
                        </p>
                        <div
                            className='dpa-admin__fields'
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
                                gap: 12,
                            }}
                        >
                            <label>
                                Display Name
                                <input
                                    className='dpa-admin__input'
                                    value={tp_form.display_name}
                                    onChange={e => setTpForm((f: any) => ({ ...f, display_name: e.target.value }))}
                                />
                            </label>
                            <label>
                                Account Type
                                <select
                                    className='dpa-admin__input'
                                    value={tp_form.account_type}
                                    onChange={e => setTpForm((f: any) => ({ ...f, account_type: e.target.value }))}
                                >
                                    <option value='funded'>Funded Account</option>
                                    <option value='real'>Real Account</option>
                                    <option value='marketing'>Marketing Account</option>
                                </select>
                            </label>
                            <label>
                                Funded Balance ($)
                                <input
                                    type='number'
                                    className='dpa-admin__input'
                                    value={tp_form.funded_balance}
                                    onChange={e => setTpForm((f: any) => ({ ...f, funded_balance: e.target.value }))}
                                />
                                <small style={{ color: '#888', fontSize: 11 }}>Starting funded account amount</small>
                            </label>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    alignSelf: 'end',
                                    paddingBottom: 6,
                                }}
                            >
                                <input
                                    type='checkbox'
                                    checked={tp_form.show_on_leaderboard}
                                    onChange={e =>
                                        setTpForm((f: any) => ({ ...f, show_on_leaderboard: e.target.checked }))
                                    }
                                />
                                Show on Leaderboard
                            </label>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    alignSelf: 'end',
                                    paddingBottom: 6,
                                }}
                            >
                                <input
                                    type='checkbox'
                                    checked={tp_form.show_on_free_bots}
                                    onChange={e =>
                                        setTpForm((f: any) => ({ ...f, show_on_free_bots: e.target.checked }))
                                    }
                                />
                                Show on Free Bots
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button
                                className='dpa-admin__btn'
                                onClick={saveTraderProfile}
                                disabled={tp_saving || !tp_form.display_name}
                            >
                                {tp_saving ? 'Saving…' : tp_edit_id ? 'Update Profile' : 'Create Profile'}
                            </button>
                            {tp_edit_id && (
                                <button
                                    className='dpa-admin__btn'
                                    style={{ background: '#555' }}
                                    onClick={() => {
                                        setTpEditId(null);
                                        setTpForm({ ...EMPTY_PROFILE });
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Trade Generator */}
                    {gen_profile_id &&
                        (() => {
                            const BARRIER_PAYOUTS: Record<string, number> = {
                                '0': 975,
                                '1': 768,
                                '2': 635,
                                '3': 533,
                                '4': 438,
                                '5': 350,
                                '6': 268,
                                '7': 195,
                                '8': 130,
                                '9': 65,
                            };
                            const is_over_under = gen_form.trade_type === 'Over' || gen_form.trade_type === 'Under';
                            const barrier = String(gen_form.barrier ?? '2');
                            const markup = parseFloat(gen_form.platform_commission) || 0;
                            const deriv_base = is_over_under
                                ? (BARRIER_PAYOUTS[barrier] ?? 350)
                                : (DERIV_PAYOUTS[gen_form.trade_type] ?? 87);
                            const effective = Math.max(0, deriv_base - markup);
                            const stake = parseFloat(gen_form.stake) || 0;
                            const win_profit = (stake * effective) / 100;
                            const label = is_over_under ? `${gen_form.trade_type} ${barrier}` : gen_form.trade_type;

                            const markupBadge =
                                markup_status === 'detecting' ? (
                                    <span style={{ color: '#f59e0b' }}>Detecting from Deriv API…</span>
                                ) : markup_status === 'ok' ? (
                                    <span style={{ color: '#16a534' }}>✓ {markup}% — read live from Deriv API</span>
                                ) : markup_status === 'fallback' ? (
                                    <span style={{ color: '#f59e0b' }}>
                                        ⚠ {markup}% — from saved settings (Deriv API unreachable)
                                    </span>
                                ) : (
                                    <span style={{ color: '#888' }}>{markup}%</span>
                                );

                            return (
                                <div
                                    className='dpa-admin__card'
                                    style={{ marginBottom: 28, border: '2px solid #00a79e' }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            flexWrap: 'wrap',
                                            gap: 8,
                                            marginBottom: 4,
                                        }}
                                    >
                                        <h3 style={{ color: '#00a79e', margin: 0 }}>
                                            Generate Trades —{' '}
                                            {trader_profiles.find(p => p.id === gen_profile_id)?.display_name}
                                        </h3>
                                        <button
                                            className='dpa-admin__btn'
                                            style={{
                                                fontSize: 11,
                                                padding: '4px 10px',
                                                background: '#222',
                                                border: '1px solid #444',
                                            }}
                                            onClick={loadDpaCommission}
                                            disabled={markup_status === 'detecting'}
                                            title='Re-read markup from Deriv API'
                                        >
                                            {markup_status === 'detecting' ? '⟳ Detecting…' : '⟳ Re-sync markup'}
                                        </button>
                                    </div>

                                    {/* Markup info bar — fully automatic, no manual input */}
                                    <div
                                        style={{
                                            marginBottom: 14,
                                            padding: '8px 14px',
                                            background: '#0d1a0d',
                                            border: '1px solid #1a3a1a',
                                            borderRadius: 6,
                                            fontSize: 12,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <span style={{ color: '#aaa' }}>API Markup:</span>
                                        {markupBadge}
                                    </div>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
                                            gap: 12,
                                        }}
                                    >
                                        <label>
                                            Number of Trades
                                            <input
                                                type='number'
                                                className='dpa-admin__input'
                                                value={gen_form.num_trades}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, num_trades: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Trade Type
                                            <select
                                                className='dpa-admin__input'
                                                value={gen_form.trade_type}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({
                                                        ...f,
                                                        trade_type: e.target.value,
                                                        barrier: '2',
                                                    }))
                                                }
                                            >
                                                {TRADE_TYPES.map(t => (
                                                    <option key={t} value={t}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        {is_over_under && (
                                            <label>
                                                Barrier Digit (0–9)
                                                <select
                                                    className='dpa-admin__input'
                                                    value={barrier}
                                                    onChange={e =>
                                                        setGenForm((f: any) => ({ ...f, barrier: e.target.value }))
                                                    }
                                                >
                                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                                                        <option key={d} value={String(d)}>
                                                            {gen_form.trade_type} {d} —{' '}
                                                            {Math.max(0, (BARRIER_PAYOUTS[String(d)] ?? 0) - markup)}%
                                                            payout
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        <label>
                                            Market
                                            <select
                                                className='dpa-admin__input'
                                                value={gen_form.market}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, market: e.target.value }))
                                                }
                                            >
                                                {MARKETS.map(m => (
                                                    <option key={m} value={m}>
                                                        {m}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            Time Frame (days)
                                            <input
                                                type='number'
                                                className='dpa-admin__input'
                                                value={gen_form.time_frame_days}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, time_frame_days: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Win Rate (%)
                                            <input
                                                type='number'
                                                className='dpa-admin__input'
                                                value={gen_form.win_rate_percent}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, win_rate_percent: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Stake per Trade ($)
                                            <input
                                                type='number'
                                                className='dpa-admin__input'
                                                value={gen_form.stake}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, stake: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label>
                                            Bot Name
                                            <input
                                                className='dpa-admin__input'
                                                value={gen_form.bot_used}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, bot_used: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                alignSelf: 'end',
                                                paddingBottom: 8,
                                            }}
                                        >
                                            <input
                                                type='checkbox'
                                                checked={gen_form.reset_trades}
                                                onChange={e =>
                                                    setGenForm((f: any) => ({ ...f, reset_trades: e.target.checked }))
                                                }
                                            />
                                            <span>Clear existing trades first</span>
                                        </label>
                                    </div>

                                    {/* Payout summary — read-only, fully computed */}
                                    <div
                                        style={{
                                            marginTop: 14,
                                            padding: '12px 16px',
                                            background: '#0d1f0d',
                                            border: '1px solid #1a3a1a',
                                            borderRadius: 8,
                                            fontSize: 13,
                                            lineHeight: 2,
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
                                            <span>
                                                <span style={{ color: '#aaa' }}>Contract:</span>{' '}
                                                <strong style={{ color: '#fff' }}>{label}</strong>
                                            </span>
                                            <span>
                                                <span style={{ color: '#aaa' }}>Deriv base:</span>{' '}
                                                <strong style={{ color: '#aaa' }}>{deriv_base}%</strong>
                                            </span>
                                            <span>
                                                <span style={{ color: '#aaa' }}>Markup:</span>{' '}
                                                <strong style={{ color: '#f59e0b' }}>−{markup}%</strong>
                                            </span>
                                            <span>
                                                <span style={{ color: '#aaa' }}>Trader payout:</span>{' '}
                                                <strong style={{ color: '#00a79e', fontSize: 15 }}>{effective}%</strong>
                                            </span>
                                        </div>
                                        <div
                                            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', marginTop: 2 }}
                                        >
                                            <span>
                                                <span style={{ color: '#aaa' }}>Win profit:</span>{' '}
                                                <strong style={{ color: '#16a534' }}>+${win_profit.toFixed(2)}</strong>
                                            </span>
                                            <span>
                                                <span style={{ color: '#aaa' }}>Loss:</span>{' '}
                                                <strong style={{ color: '#c62828' }}>−${stake.toFixed(2)}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
                                        <button
                                            className='dpa-admin__btn'
                                            style={{ background: '#00a79e' }}
                                            onClick={generateTrades}
                                            disabled={gen_loading || markup_status === 'detecting'}
                                        >
                                            {gen_loading ? 'Generating…' : `Generate ${gen_form.num_trades} Trades`}
                                        </button>
                                        <button
                                            className='dpa-admin__btn'
                                            style={{ background: '#555' }}
                                            onClick={() => {
                                                setGenProfileId(null);
                                                setGenResult(null);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    {gen_result && (
                                        <div
                                            style={{
                                                marginTop: 14,
                                                padding: '12px 16px',
                                                background: '#e0f2fe',
                                                borderRadius: 8,
                                                fontSize: 13,
                                            }}
                                        >
                                            <strong>Done!</strong> {gen_result.created} trades &nbsp;—&nbsp;
                                            {gen_result.wins}W / {gen_result.losses}L ({gen_result.win_rate}% win rate)
                                            &nbsp;|&nbsp; Trader payout: {gen_result.payout_rate}% &nbsp;|&nbsp; Final
                                            balance: <strong>${Number(gen_result.final_balance).toFixed(2)}</strong>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                    {/* Profiles list */}
                    {tp_loading ? (
                        <p style={{ color: '#aaa' }}>Loading…</p>
                    ) : trader_profiles.length === 0 ? (
                        <p style={{ color: '#aaa' }}>No trader profiles yet. Create one above.</p>
                    ) : (
                        <table className='dpa-admin__table'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Masked ID</th>
                                    <th>Type</th>
                                    <th>Balance</th>
                                    <th>Trades</th>
                                    <th>Win Rate</th>
                                    <th>Market</th>
                                    <th>Visible</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trader_profiles.map((p: any) => (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{p.display_name}</td>
                                        <td style={{ fontFamily: 'monospace', color: '#888' }}>{p.masked_id}</td>
                                        <td>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: 20,
                                                    background:
                                                        p.account_type === 'funded'
                                                            ? '#e3f2fd'
                                                            : p.account_type === 'real'
                                                              ? '#e6f4ea'
                                                              : '#fff8e1',
                                                    color:
                                                        p.account_type === 'funded'
                                                            ? '#1976d2'
                                                            : p.account_type === 'real'
                                                              ? '#16a534'
                                                              : '#f59e0b',
                                                }}
                                            >
                                                {p.account_type}
                                            </span>
                                        </td>
                                        <td>${Number(p.current_balance).toFixed(2)}</td>
                                        <td>{p.total_trades}</td>
                                        <td>{p.win_rate}%</td>
                                        <td style={{ fontSize: 12 }}>{p.market_traded}</td>
                                        <td style={{ fontSize: 12 }}>
                                            {p.show_on_leaderboard && <span style={{ color: '#00a79e' }}>LB </span>}
                                            {p.show_on_free_bots && <span style={{ color: '#f59e0b' }}>FB</span>}
                                        </td>
                                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button
                                                className='dpa-admin__btn'
                                                style={{ background: '#00a79e', padding: '4px 10px', fontSize: 12 }}
                                                onClick={() => {
                                                    setGenProfileId(p.id);
                                                    setGenForm((f: any) => ({
                                                        ...f,
                                                        bot_used: p.bot_used || '',
                                                        market: p.market_traded || 'Volatility 100',
                                                    }));
                                                    setGenResult(null);
                                                }}
                                            >
                                                Generate Trades
                                            </button>
                                            <button
                                                className='dpa-admin__btn'
                                                style={{ background: '#1565c0', padding: '4px 10px', fontSize: 12 }}
                                                onClick={() => {
                                                    setTpEditId(p.id);
                                                    setTpForm({
                                                        display_name: p.display_name,
                                                        masked_id: p.masked_id,
                                                        deriv_loginid: p.deriv_loginid || '',
                                                        country: p.country,
                                                        account_type: p.account_type,
                                                        current_balance: String(p.current_balance),
                                                        start_balance: String(p.start_balance),
                                                        bot_used: p.bot_used,
                                                        market_traded: p.market_traded,
                                                        total_trades: String(p.total_trades),
                                                        winning_trades: String(p.winning_trades),
                                                        show_on_leaderboard: p.show_on_leaderboard,
                                                        show_on_free_bots: p.show_on_free_bots,
                                                    });
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className='dpa-admin__btn'
                                                style={{ background: '#c62828', padding: '4px 10px', fontSize: 12 }}
                                                onClick={() => deleteTraderProfile(p.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
});

export default AdminPage;
