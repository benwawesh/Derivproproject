import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lwjsdrkarvtejtpszjct.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3anNkcmthcnZ0ZWp0cHN6amN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDM1MDgsImV4cCI6MjA4OTg3OTUwOH0.taNWgSQzZSS3Z-HQEDwz49Wb-oucIfi7yXIV6YAsDsE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Challenge Settings ──────────────────────────────────────────────
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
};

export const getSettings = async () => {
    const { data, error } = await supabase.from('challenge_settings').select('*').single();
    // PGRST116 = no rows found, 406 = same; fall back to defaults
    if (error) {
        if (error.code === 'PGRST116' || (error as any).status === 406) return DEFAULT_SETTINGS;
        throw error;
    }
    return data;
};

export const updateSettings = async (settings: Record<string, unknown>) => {
    const { data, error } = await supabase
        .from('challenge_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return data;
};

// ── Challenge Participants ──────────────────────────────────────────
export const registerParticipant = async (participant: {
    deriv_login_id: string;
    masked_login_id: string;
    email?: string;
    start_balance: number;
    current_balance: number;
}) => {
    const { data, error } = await supabase
        .from('challenge_participants')
        .upsert(
            {
                ...participant,
                current_phase: 1,
                phase_status: 'active',
                net_profit: 0,
                profit_percent: 0,
                total_drawdown_percent: 0,
                daily_loss_today: 0,
                is_disqualified: false,
                flip_count: 0,
                trading_days: 0,
                phase_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                bot_used: '',
                market_traded: '',
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'deriv_login_id' }
        )
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const getParticipant = async (deriv_login_id: string) => {
    const { data, error } = await supabase
        .from('challenge_participants')
        .select('*')
        .eq('deriv_login_id', deriv_login_id)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const updateParticipant = async (deriv_login_id: string, updates: Record<string, unknown>) => {
    const { data, error } = await supabase
        .from('challenge_participants')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('deriv_login_id', deriv_login_id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

// ── Leaderboard ─────────────────────────────────────────────────────
export const getLeaderboard = async (period?: string) => {
    let query = supabase.from('leaderboard').select('*').order('net_profit', { ascending: false });

    if (period) query = query.eq('competition_period', period);

    const { data, error } = await query;
    if (error) throw error;
    return data;
};

export const upsertLeaderboardEntry = async (entry: Record<string, unknown>) => {
    const { data, error } = await supabase
        .from('leaderboard')
        .upsert({ ...entry, updated_at: new Date().toISOString() }, { onConflict: 'deriv_login_id,competition_period' })
        .select()
        .single();
    if (error) throw error;
    return data;
};

// ── Competition Settings ────────────────────────────────────────────
export const getCompetitionSettings = async () => {
    const { data, error } = await supabase.from('competition_settings').select('*').eq('is_active', true).single();
    if (error) throw error;
    return data;
};

// ── Market Signals (Analysis Tool) ──────────────────────────────────
export const getMarketSignals = async (market?: string, trade_type?: string) => {
    let query = supabase
        .from('market_signals')
        .select('*')
        .eq('is_active', true)
        .order('hit_rate', { ascending: false });

    if (market) query = query.eq('market', market);
    if (trade_type) query = query.eq('trade_type', trade_type);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
};

export const getSignalMarkets = async (): Promise<string[]> => {
    const { data, error } = await supabase.from('market_signals').select('market').eq('is_active', true);
    if (error) throw error;
    const unique = [...new Set((data ?? []).map((r: any) => r.market as string))];
    return unique;
};

// ── Free Bots ────────────────────────────────────────────────────────
export const getFreeBots = async () => {
    const { data, error } = await supabase
        .from('free_bots')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

export const incrementBotDownload = async (id: string) => {
    const { error } = await supabase.rpc('increment_bot_downloads', { bot_id: id });
    if (error) throw error;
};

export const uploadBotXml = async (file: File, botName: string): Promise<string> => {
    const fileName = `${botName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.xml`;
    const { error } = await supabase.storage
        .from('bot-files')
        .upload(fileName, file, { contentType: 'text/xml', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('bot-files').getPublicUrl(fileName);
    return data.publicUrl;
};

// ── Platform Users ───────────────────────────────────────────────────
export const trackUser = async (user: {
    deriv_loginid: string;
    name?: string;
    email?: string;
    country?: string;
    currency?: string;
    account_type?: string;
    balance?: number;
}) => {
    const { error } = await supabase
        .from('platform_users')
        .upsert({ ...user, last_seen: new Date().toISOString() }, { onConflict: 'deriv_loginid' });
    if (error) console.warn('trackUser error:', error.message);
};

export const getAllUsers = async () => {
    const { data, error } = await supabase.from('platform_users').select('*').order('last_seen', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

export const getUserTrades = async (deriv_loginid: string) => {
    const { data, error } = await supabase
        .from('bot_trades')
        .select('*')
        .eq('deriv_loginid', deriv_loginid)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

// ── Admin: trade stats for all users (for users list) ───────────────
export const getTradeStatsAllUsers = async () => {
    const { data, error } = await supabase.from('bot_trades').select('deriv_loginid, account_type, is_win, profit');
    if (error) throw error;
    return data ?? [];
};

// ── Admin Analytics ──────────────────────────────────────────────────
// Fetch full split analytics for one user: funded trades, real trades, challenge status
export const adminGetUserAnalytics = async (deriv_loginid: string) => {
    const [userRes, fundedRes, realRes, participantRes] = await Promise.all([
        supabase.from('platform_users').select('*').eq('deriv_loginid', deriv_loginid).single(),
        supabase
            .from('bot_trades')
            .select('*')
            .eq('deriv_loginid', deriv_loginid)
            .eq('account_type', 'funded')
            .order('created_at', { ascending: false }),
        supabase
            .from('bot_trades')
            .select('*')
            .eq('deriv_loginid', deriv_loginid)
            .eq('account_type', 'real')
            .order('created_at', { ascending: false }),
        supabase.from('challenge_participants').select('*').eq('deriv_login_id', deriv_loginid).maybeSingle(),
    ]);
    return {
        user: userRes.data,
        fundedTrades: fundedRes.data ?? [],
        realTrades: realRes.data ?? [],
        participant: participantRes.data ?? null,
    };
};

// ── Bot Trades ───────────────────────────────────────────────────────
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
    const { error } = await supabase.from('bot_trades').insert(trade);
    if (error) console.warn('recordBotTrade error:', error.message);
};

export const getUserTradesByAccountType = async (deriv_loginid: string, account_type: 'real' | 'funded') => {
    const { data, error } = await supabase
        .from('bot_trades')
        .select('*')
        .eq('deriv_loginid', deriv_loginid)
        .eq('account_type', account_type)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

// ── Copy Trading ─────────────────────────────────────────────────────
export const getCopyTraders = async () => {
    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('allow_copy_trading', true)
        .order('net_profit', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

// ── Funded Accounts ─────────────────────────────────────────────────
export const getFundedAccounts = async () => {
    const { data, error } = await supabase
        .from('funded_accounts')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const createFundedAccount = async (account: Record<string, unknown>) => {
    const { data, error } = await supabase.from('funded_accounts').insert(account).select().single();
    if (error) throw error;
    return data;
};

// ── Challenge Rules (per phase) ──────────────────────────────────────
// SQL to create table (run once in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS challenge_rules (
//     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     phase integer UNIQUE NOT NULL,
//     max_stake_per_trade numeric DEFAULT 100,
//     max_daily_loss_percent numeric DEFAULT 5,
//     max_total_drawdown_percent numeric DEFAULT 10,
//     profit_target_percent numeric DEFAULT 10,
//     max_duration_days integer DEFAULT 30,
//     min_trading_days integer DEFAULT 5,
//     updated_at timestamptz DEFAULT now()
//   );
//   INSERT INTO challenge_rules (phase) VALUES (1),(2),(3) ON CONFLICT DO NOTHING;
//
// Also add to challenge_participants:
//   ALTER TABLE challenge_participants
//     ADD COLUMN IF NOT EXISTS is_blown boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS suspended_until date,
//     ADD COLUMN IF NOT EXISTS blown_at timestamptz;
//
// Create violations log:
//   CREATE TABLE IF NOT EXISTS challenge_violations (
//     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     deriv_login_id text NOT NULL,
//     violation_type text NOT NULL,
//     reason text,
//     details jsonb,
//     created_at timestamptz DEFAULT now()
//   );

const DEFAULT_RULES = {
    phase: 1,
    max_stake_per_trade: 100,
    max_daily_loss_percent: 5,
    max_total_drawdown_percent: 10,
    profit_target_percent: 10,
    max_duration_days: 30,
    min_trading_days: 5,
};

export const getChallengeRules = async (phase: number) => {
    const { data, error } = await supabase.from('challenge_rules').select('*').eq('phase', phase).single();
    if (error) return { ...DEFAULT_RULES, phase };
    return data;
};

/**
 * Read challenge rules from admin-created challenge_tiers (primary source).
 * Matches by funded_amount = participant start_balance; falls back to the
 * first active tier, then to the legacy challenge_rules table.
 */
export const getRulesForParticipant = async (start_balance: number, phase: number = 1) => {
    const { data: tiers } = await supabase
        .from('challenge_tiers')
        .select('*')
        .eq('is_active', true)
        .order('funded_amount');

    if (tiers && tiers.length > 0) {
        const tier = (tiers as any[]).find(t => Number(t.funded_amount) === Number(start_balance)) ?? tiers[0];
        return {
            phase,
            max_stake_per_trade: tier.max_stake_per_trade ?? 100,
            max_daily_loss_percent: tier.max_daily_loss_percent ?? DEFAULT_RULES.max_daily_loss_percent,
            max_total_drawdown_percent: tier.max_total_drawdown_percent ?? DEFAULT_RULES.max_total_drawdown_percent,
            profit_target_percent: tier.profit_target_percent ?? DEFAULT_RULES.profit_target_percent,
            max_duration_days: tier.duration_days ?? DEFAULT_RULES.max_duration_days,
            min_trading_days: tier.min_trading_days ?? DEFAULT_RULES.min_trading_days,
        };
    }

    // Fall back to legacy challenge_rules table
    return getChallengeRules(phase);
};

export const getAllChallengeRules = async () => {
    const { data, error } = await supabase.from('challenge_rules').select('*').order('phase');
    if (error) return [1, 2, 3].map(phase => ({ ...DEFAULT_RULES, phase }));
    return data ?? [1, 2, 3].map(phase => ({ ...DEFAULT_RULES, phase }));
};

export const upsertChallengeRule = async (rule: Record<string, unknown>) => {
    const { data, error } = await supabase
        .from('challenge_rules')
        .upsert({ ...rule, updated_at: new Date().toISOString() }, { onConflict: 'phase' })
        .select()
        .single();
    if (error) throw error;
    return data;
};

// ── Violations Log ───────────────────────────────────────────────────
export const logViolation = async (violation: {
    deriv_login_id: string;
    violation_type: string;
    reason: string;
    details?: Record<string, unknown>;
}) => {
    const { error } = await supabase.from('challenge_violations').insert({
        ...violation,
        created_at: new Date().toISOString(),
    });
    if (error) console.warn('logViolation error:', error.message);
};

export const getViolations = async (deriv_login_id: string) => {
    const { data, error } = await supabase
        .from('challenge_violations')
        .select('*')
        .eq('deriv_login_id', deriv_login_id)
        .order('created_at', { ascending: false });
    if (error) return [];
    return data ?? [];
};

// ── Admin: Participant Management ────────────────────────────────────
export const adminResetParticipant = async (deriv_login_id: string) => {
    const { data, error } = await supabase
        .from('challenge_participants')
        .update({
            daily_loss_today: 0,
            phase_status: 'active',
            is_disqualified: false,
            updated_at: new Date().toISOString(),
        })
        .eq('deriv_login_id', deriv_login_id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const adminFullResetParticipant = async (deriv_login_id: string, start_balance: number) => {
    /* Only updates columns that exist in the current schema */
    const { data, error } = await supabase
        .from('challenge_participants')
        .update({
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
            phase_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('deriv_login_id', deriv_login_id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const adminRemoveParticipant = async (deriv_login_id: string) => {
    const { error } = await supabase.from('challenge_participants').delete().eq('deriv_login_id', deriv_login_id);
    if (error) throw error;
};

export const adminToggleParticipantDbExits = async (deriv_login_id: string, use_db_exit_spots: boolean) => {
    const { error } = await supabase
        .from('challenge_participants')
        .update({ use_db_exit_spots })
        .eq('deriv_login_id', deriv_login_id);
    if (error) throw error;
};

export const adminUpdateParticipantDbSettings = async (
    deriv_login_id: string,
    settings: { use_db_exit_spots?: boolean; db_win_rate?: number; db_cycle_size?: number }
) => {
    const { error } = await supabase
        .from('challenge_participants')
        .update(settings)
        .eq('deriv_login_id', deriv_login_id);
    if (error) throw error;
};

// ── Challenge Tiers (admin-created, multiple per platform) ───────────
// SQL to create table (run once in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS challenge_tiers (
//     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     name text NOT NULL,
//     entry_fee numeric DEFAULT 0,
//     funded_amount numeric NOT NULL,
//     profit_target_percent numeric DEFAULT 10,
//     max_daily_loss_percent numeric DEFAULT 5,
//     max_total_drawdown_percent numeric DEFAULT 10,
//     max_stake_per_trade numeric DEFAULT 100,
//     duration_days integer DEFAULT 30,
//     min_trading_days integer DEFAULT 5,
//     is_active boolean DEFAULT true,
//     description text,
//     created_at timestamptz DEFAULT now(),
//     updated_at timestamptz DEFAULT now()
//   );

export const getChallengeTiers = async (active_only = false) => {
    let q = supabase.from('challenge_tiers').select('*').order('funded_amount');
    if (active_only) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) return [];
    return data ?? [];
};

export const upsertChallengeTier = async (tier: Record<string, unknown>) => {
    const payload = { ...tier, updated_at: new Date().toISOString() };
    if (tier.id) {
        const { data, error } = await supabase
            .from('challenge_tiers')
            .update(payload)
            .eq('id', tier.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
    const { data, error } = await supabase.from('challenge_tiers').insert(payload).select().single();
    if (error) throw error;
    return data;
};

export const deleteChallengeTier = async (id: string) => {
    const { error } = await supabase.from('challenge_tiers').delete().eq('id', id);
    if (error) throw error;
};

export const getAllParticipants = async () => {
    const { data, error } = await supabase
        .from('challenge_participants')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

// ── Marketing Accounts ───────────────────────────────────────────────
// Table: marketing_accounts
// CREATE TABLE IF NOT EXISTS marketing_accounts (
//   id              uuid       DEFAULT gen_random_uuid() PRIMARY KEY,
//   deriv_loginid   text       NOT NULL UNIQUE,
//   fake_loginid    text       NOT NULL DEFAULT 'CR' || floor(random()*9000000+1000000)::text,
//   currency        text       DEFAULT 'USD',
//   balance         numeric    DEFAULT 1000,
//   start_balance   numeric    DEFAULT 1000,
//   win_rate        integer    DEFAULT 7,
//   cycle_size      integer    DEFAULT 10,
//   trade_counter   integer    DEFAULT 0,
//   is_active       boolean    DEFAULT true,
//   created_at      timestamptz DEFAULT now(),
//   updated_at      timestamptz DEFAULT now()
// );
// ALTER PUBLICATION supabase_realtime ADD TABLE marketing_accounts;

export const getMarketingAccount = async (deriv_loginid: string) => {
    const { data, error } = await supabase
        .from('marketing_accounts')
        .select('*')
        .eq('deriv_loginid', deriv_loginid)
        .maybeSingle();
    console.log('[getMarketingAccount] loginid:', deriv_loginid, '| data:', data, '| error:', error);
    if (error) throw error;
    return data;
};

export const getAllMarketingAccounts = async () => {
    const { data, error } = await supabase
        .from('marketing_accounts')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
};

export const upsertMarketingAccount = async (account: Record<string, unknown>) => {
    const payload = { ...account, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('marketing_accounts')
        .upsert(payload, { onConflict: 'deriv_loginid' })
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateMarketingBalance = async (id: string, balance: number) => {
    const { error } = await supabase
        .from('marketing_accounts')
        .update({ balance, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) console.warn('updateMarketingBalance error:', error.message);
};

export const incrementMarketingTradeCounter = async (id: string, new_counter: number, new_balance: number) => {
    const { error } = await supabase
        .from('marketing_accounts')
        .update({ trade_counter: new_counter, balance: new_balance, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) console.warn('incrementMarketingTradeCounter error:', error.message);
};

export const deleteMarketingAccount = async (id: string) => {
    const { error } = await supabase.from('marketing_accounts').delete().eq('id', id);
    if (error) throw error;
};

// ── Admin: Exit Spot Monitoring ─────────────────────────────────────
// Table: admin_exit_spots
// CREATE TABLE IF NOT EXISTS admin_exit_spots (
//   id            uuid       DEFAULT gen_random_uuid() PRIMARY KEY,
//   market_symbol text       NOT NULL,
//   exit_price    numeric    NOT NULL,
//   epoch         bigint     NOT NULL,
//   created_at    timestamptz DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_admin_exit_spots_market_epoch
//   ON admin_exit_spots (market_symbol, epoch ASC);

export const getExitSpotsForMarket = async (market_symbol: string) => {
    const { data, error } = await supabase
        .from('admin_exit_spots')
        .select('*')
        .eq('market_symbol', market_symbol)
        .order('epoch', { ascending: true })
        .limit(100);
    if (error) throw error;
    return data ?? [];
};

export const getExitSpotsAllMarkets = async () => {
    const { data, error } = await supabase.from('admin_exit_spots').select('*').order('epoch', { ascending: true });
    if (error) throw error;
    return data ?? [];
};
