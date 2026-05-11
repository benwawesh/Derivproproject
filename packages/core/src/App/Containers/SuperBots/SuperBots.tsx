import { useState, useEffect, useRef, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { observer, useStore } from '@deriv/stores';
import { recordBotTrade } from 'Services/supabase';
import './super-bots.scss';

// ── Types ─────────────────────────────────────────────────────────────────────
type TSuperBot = {
    id: string;
    page?: string;
    name: string;
    description: string;
    market: string;
    symbol: string;
    trade_type: string;
    risk: 'Low' | 'Medium' | 'High';
    strategy: string;
    tags: string[];
    multiMarket?: boolean;
    markets?: string[];
};

type TSession = {
    runs: number;
    wins: number;
    losses: number;
    total_stake: number;
    total_payout: number;
    profit: number;
    trades: TTrade[];
};

type TTrade = {
    id: string;
    time: string;
    type: string;
    stake: number;
    payout: number;
    profit: number;
    result: 'WIN' | 'LOSS';
};

// ── Super Bots List ──────────────────────────────────────────────────────────
const SUPER_BOTS: TSuperBot[] = [
    {
        id: 'multi-market-differs',
        page: '/superbot/multi-market-differs',
        name: 'Multi-Market Differs Bot',
        description:
            'Execute "Differs" trades on multiple volatility indices simultaneously. Wins when the last digit is DIFFERENT from your target (90% win rate).',
        market: 'Multi-Market',
        symbol: 'R_100',
        trade_type: 'DIGITDIFF',
        risk: 'Medium',
        strategy: 'matches_differs',
        tags: ['Multi-Market', 'Differs', 'High Win Rate'],
        multiMarket: true,
        markets: ['R_100', 'R_75', 'R_50', 'R_25', 'R_10', 'RDBEAR', 'RDBOOM'],
    },
    {
        id: 'rise-fall-bot',
        name: 'Rise/Fall Bot',
        description: 'Simple strategy that alternates between Rise and Fall calls on every tick.',
        market: 'Volatility 100',
        symbol: 'R_100',
        trade_type: 'Rise/Fall',
        risk: 'High',
        strategy: 'rise_fall',
        tags: ['Simple', 'Classic'],
    },
    {
        id: 'even-odd-bot',
        name: 'Even/Odd Bot',
        description: 'Predicts whether the last digit will be Even or Odd. 50% win rate with consistent payouts.',
        market: 'Volatility 75',
        symbol: 'R_75',
        trade_type: 'Even/Odd',
        risk: 'Low',
        strategy: 'even_odd',
        tags: ['Simple', 'Consistent'],
    },
];

const RISK_COLORS: Record<string, string> = {
    Low: '#2e7d32',
    Medium: '#f57c00',
    High: '#c62828',
};

const EMPTY_SESSION: TSession = { runs: 0, wins: 0, losses: 0, total_stake: 0, total_payout: 0, profit: 0, trades: [] };

// ── WebSocket Bot Engine ──────────────────────────────────────────────────────
class BotEngine {
    private ws: WebSocket | null = null;
    private token: string;
    private symbol: string;
    private strategy: string;
    private stake: number;
    private loginid: string;
    private onTrade: (trade: TTrade) => void;
    private onBalance: (balance: number) => void;
    private onError: (msg: string) => void;
    private running = false;
    private req_id = 1;

    constructor(opts: {
        token: string;
        loginid: string;
        symbol: string;
        strategy: string;
        stake: number;
        onTrade: (trade: TTrade) => void;
        onBalance: (balance: number) => void;
        onError: (msg: string) => void;
    }) {
        this.token = opts.token;
        this.loginid = opts.loginid;
        this.symbol = opts.symbol;
        this.strategy = opts.strategy;
        this.stake = opts.stake;
        this.onTrade = opts.onTrade;
        this.onBalance = opts.onBalance;
        this.onError = opts.onError;
    }

    start() {
        this.running = true;
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        this.ws.onopen = () => this.authorize();
        this.ws.onmessage = e => this.handleMessage(JSON.parse(e.data));
        this.ws.onerror = () => this.onError('Connection error. Please try again.');
        this.ws.onclose = () => {
            if (this.running) this.onError('Connection closed.');
        };
    }

    stop() {
        this.running = false;
        this.ws?.close();
        this.ws = null;
    }

    private send(obj: Record<string, unknown>) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ ...obj, req_id: this.req_id++ }));
        }
    }

    private authorize() {
        this.send({ authorize: this.token });
    }

    private getContractType(): { contract_type: string; direction?: string } {
        switch (this.strategy) {
            case 'rise_fall':
                return { contract_type: 'CALL' }; // will alternate
            case 'even_odd':
                return { contract_type: 'DIGITEVEN' };
            case 'over_under':
                return { contract_type: 'DIGITOVER', direction: '5' };
            case 'matches_differs':
                return { contract_type: 'DIGITDIFF', direction: '5' };
            default:
                return { contract_type: 'CALL' };
        }
    }

    private tick_count = 0;

    private getContractTypeForTick(): string {
        this.tick_count++;
        switch (this.strategy) {
            case 'rise_fall':
                return this.tick_count % 2 === 0 ? 'CALL' : 'PUT';
            case 'even_odd':
                return this.tick_count % 2 === 0 ? 'DIGITEVEN' : 'DIGITODD';
            case 'over_under':
                return 'DIGITOVER';
            case 'matches_differs':
                return 'DIGITDIFF';
            default:
                return 'CALL';
        }
    }

    private placeTrade() {
        if (!this.running) return;
        const contract_type = this.getContractTypeForTick();
        const isDigit = ['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(
            contract_type
        );
        const payload: Record<string, unknown> = {
            buy: '1',
            price: this.stake,
            parameters: {
                amount: this.stake,
                basis: 'stake',
                contract_type,
                currency: 'USD',
                duration: isDigit ? 1 : 5,
                duration_unit: isDigit ? 't' : 't',
                symbol: this.symbol,
            },
        };
        if (contract_type === 'DIGITOVER' || contract_type === 'DIGITUNDER') {
            (payload.parameters as any).barrier = '5';
        }
        if (contract_type === 'DIGITMATCH' || contract_type === 'DIGITDIFF') {
            (payload.parameters as any).barrier = '5';
        }
        this.send(payload);
    }

    private pending_contract_id: string | null = null;
    private pending_start: number = 0;

    private handleMessage(msg: any) {
        if (!this.running) return;

        if (msg.msg_type === 'authorize') {
            if (msg.error) {
                this.onError(msg.error.message);
                return;
            }
            this.onBalance(msg.authorize?.balance ?? 0);
            setTimeout(() => this.placeTrade(), 1000);
        }

        if (msg.msg_type === 'balance') {
            this.onBalance(msg.balance?.balance ?? 0);
        }

        if (msg.msg_type === 'buy') {
            if (msg.error) {
                this.onError(msg.error.message);
                return;
            }
            this.pending_contract_id = msg.buy?.contract_id;
            this.pending_start = Date.now();
            // Subscribe to contract updates
            this.send({ proposal_open_contract: 1, contract_id: this.pending_contract_id, subscribe: 1 });
        }

        if (msg.msg_type === 'proposal_open_contract') {
            const contract = msg.proposal_open_contract;
            if (!contract || !contract.is_sold) return;

            const profit = parseFloat(contract.profit ?? '0');
            const payout = parseFloat(contract.payout ?? '0');
            const stake = parseFloat(contract.buy_price ?? String(this.stake));
            const is_win = profit > 0;

            const trade: TTrade = {
                id: contract.contract_id ?? String(Date.now()),
                time: new Date().toLocaleTimeString(),
                type: contract.contract_type ?? '',
                stake,
                payout,
                profit,
                result: is_win ? 'WIN' : 'LOSS',
            };

            this.onTrade(trade);

            // Record to Supabase
            recordBotTrade({
                deriv_loginid: this.loginid,
                bot_name: `Premium Bot (${this.strategy})`,
                bot_type: 'premium',
                account_type: 'real',
                market: this.symbol,
                trade_type: contract.contract_type,
                stake,
                payout,
                profit,
                is_win,
                contract_id: String(contract.contract_id),
            }).catch(() => {});

            // Get updated balance
            this.send({ balance: 1, subscribe: 1 });

            // Place next trade after delay
            if (this.running) setTimeout(() => this.placeTrade(), 2000);
        }
    }
}

// ── Super Bot Card ────────────────────────────────────────────────────────────
const SuperBotCard = ({
    bot,
    onLoad,
    isLoaded,
    onNavigate,
}: {
    bot: TSuperBot;
    onLoad: (bot: TSuperBot) => void;
    isLoaded: boolean;
    onNavigate: (path: string) => void;
}) => (
    <div className={`dpa-premium__card${isLoaded ? ' loaded' : ''}`}>
        <div className='dpa-premium__badge'>{bot.multiMarket ? 'SUPER' : 'PREMIUM'}</div>
        <div className='dpa-premium__card-header'>
            <div className='dpa-premium__card-icon'>{bot.multiMarket ? '🚀' : '🤖'}</div>
            <div className='dpa-premium__card-info'>
                <div className='dpa-premium__card-name'>{bot.name}</div>
                <div className='dpa-premium__card-market'>{bot.market}</div>
            </div>
            <div
                className='dpa-premium__risk'
                style={{ color: RISK_COLORS[bot.risk], background: `${RISK_COLORS[bot.risk]}18` }}
            >
                {bot.risk} Risk
            </div>
        </div>

        <p className='dpa-premium__card-desc'>{bot.description}</p>

        <div className='dpa-premium__meta'>
            <span className='dpa-premium__meta-item'>📊 {bot.trade_type}</span>
            <span className='dpa-premium__meta-item'>💹 {bot.market}</span>
        </div>

        <div className='dpa-premium__tags'>
            {bot.tags.map((t: string) => (
                <span key={t} className='dpa-premium__tag'>
                    {t}
                </span>
            ))}
        </div>

        {bot.multiMarket && bot.markets && (
            <div className='dpa-premium__markets'>
                <span className='dpa-premium__markets-label'>Markets:</span>
                <div className='dpa-premium__markets-list'>
                    {bot.markets.slice(0, 4).map((m: string) => (
                        <span key={m} className='dpa-premium__market-tag'>
                            {m}
                        </span>
                    ))}
                    {bot.markets.length > 4 && (
                        <span className='dpa-premium__market-tag'>+{bot.markets.length - 4}</span>
                    )}
                </div>
            </div>
        )}

        <button
            className={`dpa-premium__load-btn${isLoaded ? ' loaded' : ''}`}
            onClick={() => (bot.page ? onNavigate(bot.page) : onLoad(bot))}
        >
            {`Load ${bot.multiMarket ? 'Super' : 'Premium'} Bot`}
        </button>
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const SuperBotsPage = observer(() => {
    const { client } = useStore();
    const { is_logged_in, loginid } = client;
    const history = useHistory();

    const [loaded_bot, setLoadedBot] = useState<TSuperBot | null>(null);
    const [stake, setStake] = useState('1.00');
    const [running, setRunning] = useState(false);
    const [session, setSession] = useState<TSession>(EMPTY_SESSION);
    const [balance, setBalance] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'summary' | 'transactions' | 'journal'>('summary');
    const engine_ref = useRef<BotEngine | null>(null);

    const handleLoad = (bot: TSuperBot) => {
        if (running) return;
        setLoadedBot(bot);
        setSession(EMPTY_SESSION);
        setError('');
    };

    const handleRun = useCallback(() => {
        if (!loaded_bot || !is_logged_in) return;
        const token = (client as any).getToken?.() ?? sessionStorage.getItem('client.tokens') ?? '';
        const stake_num = parseFloat(stake);
        if (isNaN(stake_num) || stake_num <= 0) {
            setError('Please enter a valid stake amount.');
            return;
        }

        setError('');
        setRunning(true);

        engine_ref.current = new BotEngine({
            token,
            loginid: loginid ?? '',
            symbol: loaded_bot.symbol,
            strategy: loaded_bot.strategy,
            stake: stake_num,
            onTrade: trade => {
                setSession(prev => ({
                    runs: prev.runs + 1,
                    wins: prev.wins + (trade.result === 'WIN' ? 1 : 0),
                    losses: prev.losses + (trade.result === 'LOSS' ? 1 : 0),
                    total_stake: prev.total_stake + trade.stake,
                    total_payout: prev.total_payout + trade.payout,
                    profit: prev.profit + trade.profit,
                    trades: [trade, ...prev.trades].slice(0, 100),
                }));
            },
            onBalance: bal => setBalance(bal),
            onError: msg => {
                setError(msg);
                setRunning(false);
            },
        });
        engine_ref.current.start();
    }, [loaded_bot, is_logged_in, loginid, client, stake]);

    const handleStop = () => {
        engine_ref.current?.stop();
        engine_ref.current = null;
        setRunning(false);
    };

    useEffect(() => () => engine_ref.current?.stop(), []);

    return (
        <div className='dpa-premium'>
            {/* ── Banner ──────────────────────────────────────── */}
            <div className='dpa-premium__banner'>
                <div className='dpa-premium__banner-inner'>
                    <span className='dpa-premium__banner-tag'>SUPER</span>
                    <h1 className='dpa-premium__banner-title'>Super Bots</h1>
                    <p className='dpa-premium__banner-sub'>
                        Professionally coded bots that trade live on your Deriv account. Select a bot, set your stake
                        and click Run.
                    </p>
                </div>
            </div>

            <div className='dpa-premium__layout'>
                {/* ── Left: Bot List ───────────────────────────── */}
                <div className='dpa-premium__list'>
                    <div className='dpa-premium__list-header'>
                        <h2>Select a Bot</h2>
                        <span className='dpa-premium__list-count'>{SUPER_BOTS.length} bots</span>
                    </div>
                    <div className='dpa-premium__grid'>
                        {SUPER_BOTS.map((bot: TSuperBot) => (
                            <SuperBotCard
                                key={bot.id}
                                bot={bot}
                                onLoad={handleLoad}
                                isLoaded={loaded_bot?.id === bot.id}
                                onNavigate={path => history.push(path)}
                            />
                        ))}
                    </div>
                </div>

                {/* ── Right: Trading Panel ─────────────────────── */}
                <div className='dpa-premium__panel'>
                    {!loaded_bot ? (
                        <div className='dpa-premium__panel-empty'>
                            <div className='dpa-premium__panel-empty-icon'>🤖</div>
                            <h3>No Bot Loaded</h3>
                            <p>Select a premium bot from the list to get started.</p>
                        </div>
                    ) : (
                        <>
                            {/* Bot info */}
                            <div className='dpa-premium__panel-bot'>
                                <span className='dpa-premium__panel-name'>{loaded_bot.name}</span>
                                <span className='dpa-premium__panel-market'>
                                    {loaded_bot.market} · {loaded_bot.trade_type}
                                </span>
                            </div>

                            {/* Login warning */}
                            {!is_logged_in && (
                                <div className='dpa-premium__warning'>
                                    ⚠️ Please log in to your Deriv account to run bots.
                                </div>
                            )}

                            {/* Stake input */}
                            <div className='dpa-premium__stake-row'>
                                <label className='dpa-premium__stake-label'>Stake (USD)</label>
                                <input
                                    className='dpa-premium__stake-input'
                                    type='number'
                                    min='0.35'
                                    step='0.01'
                                    value={stake}
                                    onChange={e => setStake(e.target.value)}
                                    disabled={running}
                                />
                            </div>

                            {/* Error */}
                            {error && <div className='dpa-premium__error'>{error}</div>}

                            {/* Balance */}
                            {balance !== null && (
                                <div className='dpa-premium__balance'>
                                    Balance: <strong>${balance.toFixed(2)}</strong>
                                </div>
                            )}

                            {/* Tabs */}
                            <div className='dpa-premium__tabs'>
                                {(['summary', 'transactions', 'journal'] as const).map(t => (
                                    <button
                                        key={t}
                                        className={`dpa-premium__tab${tab === t ? ' active' : ''}`}
                                        onClick={() => setTab(t)}
                                    >
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {/* Summary Tab */}
                            {tab === 'summary' && (
                                <div className='dpa-premium__summary'>
                                    <div className='dpa-premium__stat-grid'>
                                        <div className='dpa-premium__stat-box'>
                                            <span className='dpa-premium__stat-label'>Total Stake</span>
                                            <span className='dpa-premium__stat-value'>
                                                ${session.total_stake.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className='dpa-premium__stat-box'>
                                            <span className='dpa-premium__stat-label'>Total Payout</span>
                                            <span className='dpa-premium__stat-value'>
                                                ${session.total_payout.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className='dpa-premium__stat-box'>
                                            <span className='dpa-premium__stat-label'>No. of Runs</span>
                                            <span className='dpa-premium__stat-value'>{session.runs}</span>
                                        </div>
                                        <div className='dpa-premium__stat-box'>
                                            <span className='dpa-premium__stat-label'>Contracts Won</span>
                                            <span className='dpa-premium__stat-value green'>{session.wins}</span>
                                        </div>
                                        <div className='dpa-premium__stat-box'>
                                            <span className='dpa-premium__stat-label'>Contracts Lost</span>
                                            <span className='dpa-premium__stat-value red'>{session.losses}</span>
                                        </div>
                                        <div className='dpa-premium__stat-box'>
                                            <span className='dpa-premium__stat-label'>Total Profit/Loss</span>
                                            <span
                                                className={`dpa-premium__stat-value ${session.profit >= 0 ? 'green' : 'red'}`}
                                            >
                                                {session.profit >= 0 ? '+' : ''}
                                                {session.profit.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    {session.runs === 0 && (
                                        <p className='dpa-premium__hint'>
                                            When you&apos;re ready to trade, hit <strong>Run</strong>. You&apos;ll be
                                            able to track your bot&apos;s performance here.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Transactions Tab */}
                            {tab === 'transactions' && (
                                <div className='dpa-premium__transactions'>
                                    {session.trades.length === 0 ? (
                                        <p className='dpa-premium__hint'>No trades yet. Hit Run to start.</p>
                                    ) : (
                                        <table className='dpa-premium__table'>
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>Type</th>
                                                    <th>Stake</th>
                                                    <th>Payout</th>
                                                    <th>Profit</th>
                                                    <th>Result</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {session.trades.map(t => (
                                                    <tr key={t.id}>
                                                        <td>{t.time}</td>
                                                        <td>{t.type}</td>
                                                        <td>${t.stake.toFixed(2)}</td>
                                                        <td>${t.payout.toFixed(2)}</td>
                                                        <td className={t.profit >= 0 ? 'green' : 'red'}>
                                                            {t.profit >= 0 ? '+' : ''}
                                                            {t.profit.toFixed(2)}
                                                        </td>
                                                        <td className={t.result === 'WIN' ? 'green' : 'red'}>
                                                            {t.result}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}

                            {/* Journal Tab */}
                            {tab === 'journal' && (
                                <div className='dpa-premium__journal'>
                                    {session.trades.length === 0 ? (
                                        <p className='dpa-premium__hint'>Journal will appear here when trades start.</p>
                                    ) : (
                                        <div className='dpa-premium__journal-list'>
                                            {session.trades.map(t => (
                                                <div
                                                    key={t.id}
                                                    className={`dpa-premium__journal-entry ${t.result === 'WIN' ? 'win' : 'loss'}`}
                                                >
                                                    <span className='dpa-premium__journal-time'>{t.time}</span>
                                                    <span>
                                                        {t.result === 'WIN' ? '✓' : '✗'} {t.type} — Stake: $
                                                        {t.stake.toFixed(2)} →{' '}
                                                        {t.result === 'WIN'
                                                            ? `Won $${t.payout.toFixed(2)}`
                                                            : `Lost $${t.stake.toFixed(2)}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Run/Stop Button ──────────────────────── */}
                    {loaded_bot && (
                        <div className='dpa-premium__controls'>
                            {running ? (
                                <>
                                    <div className='dpa-premium__running-indicator'>
                                        <span className='dpa-premium__dot'></span> Bot is running
                                    </div>
                                    <button className='dpa-premium__stop-btn' onClick={handleStop}>
                                        ⏹ Stop
                                    </button>
                                </>
                            ) : (
                                <button className='dpa-premium__run-btn' onClick={handleRun} disabled={!is_logged_in}>
                                    ▶ Run
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default SuperBotsPage;
