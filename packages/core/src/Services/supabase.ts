// ── DPA Backend API (Django + PostgreSQL) ───────────────────────────────────
const BASE =
    process.env.NODE_ENV === 'production' ? 'https://api.derivprofundedacademy.com/api' : 'http://localhost:8001/api';

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
    return res.json();
}

async function del(path: string): Promise<void> {
    const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

// ── Challenge Settings ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    phase1_profit_target: 10,
    phase2_profit_target: 5,
    phase3_profit_target: 0,
    daily_drawdown_limit: 5,
    disqualification_threshold: 10,
    flips_required_to_reenter: 5,
    phase1_duration_days: 30,
    phase2_duration_days: 60,
    min_trading_days: 5,
    profit_split_trader: 80,
    funded_amounts: [1000, 2500, 5000, 10000],
    announcement_text:
        'Monthly competition now LIVE · Top 10 traders win funded accounts up to $10,000 · Join for FREE · No deposit required · Bot trading allowed',
    competition_duration: 'monthly',
};

export const getSettings = async () => {
    try {
        return await get<typeof DEFAULT_SETTINGS>('/settings/');
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const updateSettings = async (settings: Record<string, unknown>) => {
    return patch('/settings/', settings);
};

// ── Challenge Participants ──────────────────────────────────────────────────
export const registerParticipant = async (participant: {
    deriv_login_id: string;
    masked_login_id: string;
    email?: string;
    start_balance: number;
    current_balance: number;
}) => {
    return post('/participants/', participant);
};

export const getParticipant = async (deriv_login_id: string) => {
    try {
        return await get<any>(`/participants/${deriv_login_id}/`);
    } catch {
        return null;
    }
};

export const updateParticipant = async (deriv_login_id: string, updates: Record<string, unknown>) => {
    return patch(`/participants/${deriv_login_id}/`, updates);
};

export const getAllParticipants = async () => {
    return get<any[]>('/participants/');
};

export const adminResetParticipant = async (deriv_login_id: string) => {
    return patch(`/participants/${deriv_login_id}/`, {
        daily_loss_today: 0,
        phase_status: 'active',
        is_disqualified: false,
    });
};

export const adminFullResetParticipant = async (deriv_login_id: string, start_balance: number) => {
    return patch(`/participants/${deriv_login_id}/`, {
        current_phase: 1,
        phase_status: 'active',
        net_profit: 0,
        profit_percent: 0,
        total_drawdown_percent: 0,
        daily_loss_today: 0,
        is_disqualified: false,
        flip_count: 0,
        trading_days: 0,
        start_balance,
        current_balance: start_balance,
    });
};

export const adminRemoveParticipant = async (deriv_login_id: string) => {
    return del(`/participants/${deriv_login_id}/`);
};

export const adminToggleParticipantDbExits = async (deriv_login_id: string, use_db_exit_spots: boolean) => {
    return patch(`/participants/${deriv_login_id}/`, { use_db_exit_spots });
};

export const adminUpdateParticipantDbSettings = async (
    deriv_login_id: string,
    settings: { use_db_exit_spots?: boolean; db_win_rate?: number; db_cycle_size?: number }
) => {
    return patch(`/participants/${deriv_login_id}/`, settings);
};

// ── Leaderboard ─────────────────────────────────────────────────────────────
export const getLeaderboard = async (period?: string) => {
    return get<any[]>('/leaderboard/', period ? { period } : undefined);
};

export const upsertLeaderboardEntry = async (entry: Record<string, unknown>) => {
    return post('/leaderboard/', entry);
};

export const getCopyTraders = async () => {
    return get<any[]>('/leaderboard/', { allow_copy_trading: 'true' });
};

// ── Competition Settings ────────────────────────────────────────────────────
export const getCompetitionSettings = async () => {
    return get<any>('/competition-settings/');
};

// ── Market Signals ──────────────────────────────────────────────────────────
export const getMarketSignals = async (market?: string, trade_type?: string) => {
    const params: Record<string, string> = {};
    if (market) params.market = market;
    if (trade_type) params.trade_type = trade_type;
    return get<any[]>('/market-signals/', params);
};

export const getSignalMarkets = async (): Promise<string[]> => {
    return get<string[]>('/market-signals/markets/');
};

// ── Free Bots ───────────────────────────────────────────────────────────────
export const getFreeBots = async (active_only = true) => {
    return get<any[]>('/free-bots/', active_only ? { active_only: 'true' } : undefined);
};

export const createFreeBot = async (bot: Record<string, unknown>) => {
    return post<any>('/free-bots/', bot);
};

export const updateFreeBot = async (id: string | number, updates: Record<string, unknown>) => {
    return patch<any>(`/free-bots/${id}/`, updates);
};

export const deleteFreeBot = async (id: string | number) => {
    return del(`/free-bots/${id}/`);
};

export const incrementBotDownload = async (id: string) => {
    return post(`/free-bots/${id}/increment-downloads/`, {});
};

export const uploadBotXml = async (file: File, _botName: string): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/free-bots/upload-xml/`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    return data.url as string;
};

// ── Exit Spots (batch insert + delete) ──────────────────────────────────────
export const batchInsertExitSpots = async (
    spots: Array<{ market_symbol: string; exit_price: number; epoch: number }>
) => {
    return post<any>('/exit-spots/', spots);
};

export const deleteExitSpot = async (id: string | number) => {
    return del(`/exit-spots/${id}/`);
};

// ── Platform Users ──────────────────────────────────────────────────────────
export const trackUser = async (user: {
    deriv_loginid: string;
    name?: string;
    email?: string;
    country?: string;
    currency?: string;
    account_type?: string;
    balance?: number;
}) => {
    try {
        await post('/users/', user);
    } catch (e) {
        console.warn('trackUser error:', e);
    }
};

export const getAllUsers = async () => {
    return get<any[]>('/users/');
};

export const getUserTrades = async (deriv_loginid: string) => {
    return get<any[]>('/trades/', { deriv_loginid });
};

export const getUserTradesByAccountType = async (deriv_loginid: string, account_type: 'real' | 'funded') => {
    return get<any[]>('/trades/', { deriv_loginid, account_type });
};

export const getTradeStatsAllUsers = async () => {
    return get<any[]>('/trades/stats/');
};

export const adminGetUserAnalytics = async (deriv_loginid: string) => {
    const [user, fundedTrades, realTrades, participant] = await Promise.all([
        get<any[]>('/users/').then(u => u.find((x: any) => x.deriv_loginid === deriv_loginid) ?? null),
        get<any[]>('/trades/', { deriv_loginid, account_type: 'funded' }),
        get<any[]>('/trades/', { deriv_loginid, account_type: 'real' }),
        getParticipant(deriv_loginid),
    ]);
    return { user, fundedTrades, realTrades, participant };
};

// ── Bot Trades ──────────────────────────────────────────────────────────────
export const recordBotTrade = async (trade: {
    deriv_loginid: string;
    bot_name: string;
    bot_type: 'free' | 'premium';
    account_type: 'real' | 'funded';
    market?: string;
    trade_type?: string;
    stake: number;
    payout?: number;
    profit?: number;
    is_win?: boolean;
    contract_id?: string;
}) => {
    try {
        await post('/trades/', trade);
    } catch (e) {
        console.warn('recordBotTrade error:', e);
    }
};

// ── Challenge Rules ─────────────────────────────────────────────────────────
export const getChallengeRules = async (phase: number) => {
    return get<any>('/challenge-rules/', { phase: String(phase) });
};

export const getAllChallengeRules = async () => {
    return get<any[]>('/challenge-rules/');
};

export const upsertChallengeRule = async (rule: Record<string, unknown>) => {
    return post('/challenge-rules/', rule);
};

// ── Challenge Tiers ─────────────────────────────────────────────────────────
export const getChallengeTiers = async (active_only = false) => {
    return get<any[]>('/challenge-tiers/', active_only ? { active_only: 'true' } : undefined);
};

export const upsertChallengeTier = async (tier: Record<string, unknown>) => {
    return post('/challenge-tiers/', tier);
};

export const deleteChallengeTier = async (id: string) => {
    return del(`/challenge-tiers/${id}/`);
};

export const getRulesForParticipant = async (start_balance: number, phase = 1) => {
    const tiers = await getChallengeTiers(true);
    if (tiers && tiers.length > 0) {
        const tier = tiers.find((t: any) => Number(t.funded_amount) === Number(start_balance)) ?? tiers[0];
        return {
            phase,
            max_stake_per_trade: tier.max_stake_per_trade ?? 100,
            max_daily_loss_percent: tier.max_daily_loss_percent ?? 5,
            max_total_drawdown_percent: tier.max_total_drawdown_percent ?? 10,
            profit_target_percent: tier.profit_target_percent ?? 10,
            max_duration_days: tier.duration_days ?? 30,
            min_trading_days: tier.min_trading_days ?? 5,
        };
    }
    return getChallengeRules(phase);
};

// ── Violations ──────────────────────────────────────────────────────────────
export const logViolation = async (violation: {
    deriv_login_id: string;
    violation_type: string;
    reason: string;
    details?: Record<string, unknown>;
}) => {
    try {
        await post('/violations/', violation);
    } catch (e) {
        console.warn('logViolation error:', e);
    }
};

export const getViolations = async (deriv_login_id: string) => {
    try {
        return await get<any[]>('/violations/', { deriv_login_id });
    } catch {
        return [];
    }
};

// ── Marketing Accounts ──────────────────────────────────────────────────────
export const getMarketingAccount = async (deriv_loginid: string) => {
    return get<any>('/marketing-accounts/', { deriv_loginid });
};

export const getAllMarketingAccounts = async () => {
    return get<any[]>('/marketing-accounts/');
};

export const upsertMarketingAccount = async (account: Record<string, unknown>) => {
    return post('/marketing-accounts/', account);
};

export const updateMarketingAccount = async (id: string | number, updates: Record<string, unknown>) => {
    return patch(`/marketing-accounts/${id}/`, updates);
};

export const updateMarketingBalance = async (id: string, balance: number) => {
    try {
        await patch(`/marketing-accounts/${id}/`, { balance });
    } catch (e) {
        console.warn('updateMarketingBalance error:', e);
    }
};

export const incrementMarketingTradeCounter = async (id: string, new_counter: number, new_balance: number) => {
    try {
        await patch(`/marketing-accounts/${id}/`, { trade_counter: new_counter, balance: new_balance });
    } catch (e) {
        console.warn('incrementMarketingTradeCounter error:', e);
    }
};

export const deleteMarketingAccount = async (id: string) => {
    return del(`/marketing-accounts/${id}/`);
};

export const bulkUpdateMarketingAccounts = async (
    ids: number[] | null,
    updates: { win_rate?: number; cycle_size?: number; manipulate_exit?: boolean; is_active?: boolean }
) => {
    return post<any>('/marketing-accounts/bulk/', { ids, updates });
};

export const bulkUpdateParticipants = async (
    ids: string[] | null,
    updates: {
        use_db_exit_spots?: boolean;
        db_win_rate?: number;
        db_cycle_size?: number;
        trade_counter_funded?: number;
    }
) => {
    return post<any>('/participants/bulk/', { ids, updates });
};

// ── Funded Accounts ─────────────────────────────────────────────────────────
export const getFundedAccounts = async () => {
    return get<any[]>('/funded-accounts/');
};

export const createFundedAccount = async (account: Record<string, unknown>) => {
    return post('/funded-accounts/', account);
};

// ── Exit Spots ──────────────────────────────────────────────────────────────
export const getExitSpotsForMarket = async (market_symbol: string) => {
    return get<any[]>('/exit-spots/', { market_symbol });
};

export const getExitSpotsAllMarkets = async () => {
    return get<any[]>('/exit-spots/');
};

// ── Supabase stub (kept for any code that imports supabase directly) ─────────
const _noop_channel = {
    on: () => _noop_channel,
    subscribe: () => _noop_channel,
    unsubscribe: () => Promise.resolve(),
};
const _noop_query = {
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => _noop_query,
    delete: () => _noop_query,
    upsert: () => Promise.resolve({ data: null, error: null }),
    eq: () => Promise.resolve({ data: null, error: null }),
    in: () => Promise.resolve({ data: null, error: null }),
    order: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
};
export const supabase = {
    from: (_table: string) => ({ ..._noop_query }),
    channel: (_name: string) => _noop_channel,
    removeChannel: (_ch: unknown) => Promise.resolve(),
};
