import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { observer } from '@deriv/stores';
import { routes } from '@deriv/shared';
import { getFreeBots } from 'Services/supabase';
import TraderQRModal from 'App/Components/TraderQR';
import 'App/Components/DPAHomepage/dpa-homepage.scss';
import './free-bots.scss';

const DPA_API = /derivprofundedacademy\.com/.test(window.location.hostname)
    ? 'https://api.derivprofundedacademy.com/api'
    : 'http://localhost:8011/api';

type TTraderProfile = {
    id: number;
    display_name: string;
    masked_id: string;
    avatar: string | null;
    country: string;
    account_type: string;
    qr_token: string;
    current_balance: number;
    start_balance: number;
    net_profit: number;
    profit_percent: number;
    win_rate: number;
    bot_used: string;
    market_traded: string;
    total_trades: number;
    winning_trades: number;
};

type TBot = {
    id: string;
    name: string;
    version: string;
    description: string;
    market: string;
    trade_type: string;
    win_rate: number;
    avg_profit: string;
    downloads: number;
    risk: string;
    tags: string[];
    is_featured: boolean;
    xml_url?: string;
};

const BETWIN_CSS = [
    '/wp-content/uploads/elementor/google-fonts/css/chakrapetchb160.css',
    '/wp-content/themes/betwins/assets/css/animate3517.css',
    '/wp-content/themes/betwins/assets/css/aos3517.css',
    '/wp-content/themes/betwins/assets/css/bootstrap.min3517.css',
    '/wp-content/themes/betwins/assets/fonts/css/tabler-icons.min7a5f.css',
    '/wp-content/themes/betwins/assets/css/magnific-popup3517.css',
    '/wp-content/plugins/betwins-core/assets/css/nice-select7406.css',
    '/wp-content/plugins/betwins-core/assets/css/odometer7406.css',
    '/wp-content/plugins/betwins-core/assets/css/swiper-bundle.min7406.css',
    '/wp-content/plugins/betwins-core/assets/css/main-style7406.css',
    '/wp-content/plugins/elementor/assets/css/frontend.min8e60.css',
    '/wp-content/plugins/elementor/assets/css/widget-image.min8e60.css',
    '/wp-content/plugins/elementor/assets/css/widget-heading.min8e60.css',
    '/wp-content/plugins/elementor/assets/css/widget-icon-box.min8e60.css',
    '/wp-content/plugins/elementor/assets/lib/animations/styles/fadeInUp.min8e60.css',
    '/wp-content/plugins/elementor/assets/lib/font-awesome/css/font-awesome.min1849.css',
    '/wp-content/themes/betwins/assets/css/master3517.css',
    '/wp-content/themes/betwins/assets/css/template-settings3517.css',
    '/wp-content/themes/betwins/assets/css/main-style3517.css',
    '/wp-content/themes/betwins/assets/css/responsive3517.css',
];

const BETWIN_JS = [
    '/wp-includes/js/jquery/jquery.minf43b.js',
    '/wp-includes/js/jquery/jquery-migrate.min5589.js',
    '/wp-content/plugins/betwins-core/assets/js/aos0ba6.js',
    '/wp-content/plugins/betwins-core/assets/js/gsap.min0ba6.js',
    '/wp-content/plugins/betwins-core/assets/js/isotope.pkgd.min0ba6.js',
    '/wp-content/plugins/betwins-core/assets/js/vanilla-tilt.min0ba6.js',
    '/wp-content/plugins/betwins-core/assets/js/odometer.min20b9.js',
    '/wp-content/plugins/betwins-core/assets/js/ScrollToPlugin.min20b9.js',
    '/wp-content/plugins/betwins-core/assets/js/ScrollTrigger.min20b9.js',
    '/wp-content/plugins/betwins-core/assets/js/SplitText.min20b9.js',
    '/wp-content/plugins/betwins-core/assets/js/viewport.jquery20b9.js',
    '/wp-content/plugins/betwins-core/assets/js/wow.minf39e.js',
    '/wp-content/plugins/elementor/assets/lib/swiper/v8/swiper.min94a4.js',
    '/wp-content/themes/betwins/assets/js/bootstrap.mince52.js',
    '/wp-content/themes/betwins/assets/js/fontawesome.min8a54.js',
    '/wp-content/plugins/betwins-core/assets/js/main3517.js',
    '/wp-content/themes/betwins/assets/js/main3517.js',
];

if (typeof document !== 'undefined') {
    BETWIN_CSS.forEach(href => {
        if (document.querySelector(`style[data-betwin-src="${href}"]`)) return;
        const style = document.createElement('style');
        style.setAttribute('data-betwin-src', href);
        style.textContent = `@import url("${href}") layer(betwin);`;
        document.head.appendChild(style);
    });
}

const BOT_IMAGES = [
    '/wp-content/uploads/2025/07/image-slider-one.png',
    '/wp-content/uploads/2025/07/image-slider-three.png',
    '/wp-content/uploads/2025/07/image-slider-four.png',
    '/wp-content/uploads/2025/07/image-slider-two.png',
];

const CHAMPION_AVATARS = [
    '/wp-content/uploads/2025/07/winner-one.png',
    '/wp-content/uploads/2025/07/a-two.png',
    '/wp-content/uploads/2025/07/a-three.png',
    '/wp-content/uploads/2025/07/a-four.png',
    '/wp-content/uploads/2025/07/a-five.png',
    '/wp-content/uploads/2025/07/a-six.png',
    '/wp-content/uploads/2025/07/a-seven.png',
    '/wp-content/uploads/2025/07/a-eight.png',
];

function useBetwinFreeBotAssets() {
    useEffect(() => {
        // Load CSS into betwin layer so unlayered DPA CSS always wins
        BETWIN_CSS.forEach(href => {
            if (document.querySelector(`style[data-betwin-src="${href}"]`)) return;
            const style = document.createElement('style');
            style.setAttribute('data-betwin-src', href);
            style.textContent = `@import url("${href}") layer(betwin);`;
            document.head.appendChild(style);
        });

        let aosObserver: IntersectionObserver | null = null;
        let initTimer: ReturnType<typeof setTimeout> | null = null;

        const loadScript = (src: string) =>
            new Promise<void>(resolve => {
                if (document.querySelector(`script[src="${src}"]`)) {
                    resolve();
                    return;
                }
                const s = document.createElement('script');
                s.src = src;
                s.async = false;
                s.onload = () => resolve();
                s.onerror = () => resolve();
                document.body.appendChild(s);
            });

        (async () => {
            const preMain = BETWIN_JS.slice(0, BETWIN_JS.length - 2);
            const mainScripts = BETWIN_JS.slice(BETWIN_JS.length - 2);

            for (const src of preMain) {
                await loadScript(src);
            }

            const scrollContainer = document.getElementById('app_contents');
            if ((window as any).gsap && (window as any).ScrollTrigger && scrollContainer) {
                (window as any).ScrollTrigger.defaults({ scroller: scrollContainer });
            }

            for (const src of mainScripts) {
                await loadScript(src);
            }

            initTimer = setTimeout(() => {
                const w = window as any;

                if (w.VanillaTilt) {
                    w.VanillaTilt.init(document.querySelectorAll('.tilt'), { max: 5, speed: 3000 });
                }

                // Title char animation
                const sc = document.getElementById('app_contents');
                if (sc) {
                    document.querySelectorAll('.title-animation').forEach((el: Element) => {
                        if (el.querySelector('.title-char')) return;
                        const text = (el.textContent || '').trim();
                        if (!text) return;
                        el.innerHTML = text
                            .split('')
                            .map((ch: string, i: number) => {
                                if (ch === ' ')
                                    return '<span style="display:inline-block;min-width:0.3em">&nbsp;</span>';
                                const delay = (i * 0.04).toFixed(2);
                                const tr = `opacity 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s,transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s`;
                                const esc = ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
                                return `<span class="title-char" data-tr="${tr}" style="display:inline-block;opacity:0;transform:translateX(40px);transition:${tr}">${esc}</span>`;
                            })
                            .join('');
                        const io = new IntersectionObserver(
                            entries => {
                                entries.forEach(entry => {
                                    const chars = Array.from(el.querySelectorAll('.title-char')) as HTMLElement[];
                                    if (entry.isIntersecting) {
                                        chars.forEach(span => {
                                            span.style.opacity = '1';
                                            span.style.transform = 'translateX(0)';
                                        });
                                    } else {
                                        chars.forEach(span => {
                                            span.style.transition = 'none';
                                            span.style.opacity = '0';
                                            span.style.transform = 'translateX(40px)';
                                            requestAnimationFrame(() => {
                                                span.style.transition = span.dataset.tr || '';
                                            });
                                        });
                                    }
                                });
                            },
                            { root: sc, threshold: 0.1 }
                        );
                        io.observe(el);
                    });

                    // AOS repeat on scroll
                    aosObserver = new IntersectionObserver(
                        entries => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) entry.target.classList.add('aos-animate');
                                else entry.target.classList.remove('aos-animate');
                            });
                        },
                        { root: sc, threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
                    );
                    document.querySelectorAll('[data-aos]').forEach(el => aosObserver!.observe(el));
                }
            }, 300);
        })();

        return () => {
            if (initTimer) clearTimeout(initTimer);
            aosObserver?.disconnect();
        };
    }, []);
}

// ── Bot card — mirrors lt-type__single from lottery page ─────────────────────
const FreeBotCard = ({ bot, index, onLoad }: { bot: TBot; index: number; onLoad: (bot: TBot) => void }) => (
    <div
        className='col-12 col-md-6 col-xl-4 col-xxl-3'
        data-aos='fade-up'
        data-aos-duration='600'
        data-aos-delay={String(index * 60)}
    >
        <div className='lt-type__single text-center tilt'>
            <span className='serial'>#{index + 1}</span>
            <span className='price'>{bot.win_rate}%</span>
            <div className='thumb'>
                <img src={BOT_IMAGES[index % BOT_IMAGES.length]} alt={bot.name} />
            </div>
            <div className='content mt-20'>
                <h6 className='fw-6'>{bot.name}</h6>
                <div className='timer mt-20'>
                    <p>
                        <i className='ti ti-robot' />
                        {bot.risk} Risk &nbsp;·&nbsp; {bot.market}
                    </p>
                </div>
            </div>
            <div className='cta mt-25'>
                <button className='btn--primary' onClick={() => onLoad(bot)}>
                    Load Bot <i className='ti ti-arrow-narrow-right' />
                </button>
            </div>
        </div>
    </div>
);

// ── Champion card — pulls from Django TraderProfile API ───────────────────────
const ChampionCard = ({
    trader,
    index,
    onQR,
}: {
    trader: TTraderProfile;
    index: number;
    onQR: (t: TTraderProfile) => void;
}) => {
    const avatar_src = trader.avatar || CHAMPION_AVATARS[index % CHAMPION_AVATARS.length];
    const profit_color = trader.net_profit >= 0 ? '#4caf50' : '#ef5350';
    return (
        <div className='col-12 col-md-6 col-xl-4 col-xxl-3' data-aos='fade-up' data-aos-duration='600'>
            <div className='lt-type__single champion__single text-center tilt'>
                <span className='serial'>#{index + 1}</span>
                <div className='thumb'>
                    <img src={avatar_src} alt={trader.display_name} />
                </div>
                <div className='content mt-20'>
                    <h6 className='fw-6'>{trader.display_name}</h6>
                    <p className='text-sm mt-4 primary-text'>
                        {trader.bot_used || trader.market_traded || 'DPA Platform'}
                    </p>
                </div>
                <div className='cta mt-25'>
                    <ul className='champion'>
                        <li className='active'>{trader.win_rate}%</li>
                        <li>{trader.total_trades} trades</li>
                        <li style={{ color: profit_color }}>
                            {trader.net_profit >= 0 ? '+' : ''}${trader.net_profit.toFixed(2)}
                        </li>
                    </ul>
                </div>
                <div className='timer mt-30'>
                    <button
                        onClick={() => onQR(trader)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(156,236,254,0.1)',
                            border: '1px solid rgba(156,236,254,0.3)',
                            borderRadius: '8px',
                            padding: '7px 16px',
                            color: '#9cecfe',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        <i className='ti ti-qrcode' /> View Trade Report
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const FreeBotsPage = observer(() => {
    const history = useHistory();
    const [bots, setBots] = useState<TBot[]>([]);
    const [loading, setLoading] = useState(true);
    const [champions, setChampions] = useState<TTraderProfile[]>([]);
    const [qr_trader, setQrTrader] = useState<TTraderProfile | null>(null);

    useBetwinFreeBotAssets();

    useEffect(() => {
        getFreeBots()
            .then(data => setBots(data as TBot[]))
            .catch(() => setBots([]))
            .finally(() => setLoading(false));

        fetch(`${DPA_API}/trader-profiles/?placement=free_bots`)
            .then(r => r.json())
            .then(data => setChampions(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const handleLoad = (bot: TBot) => {
        if (!bot.xml_url) {
            alert('This bot does not have an XML file yet.');
            return;
        }
        localStorage.setItem('dpa_load_xml', bot.xml_url);
        localStorage.setItem('dpa_bot_mode', '1');
        history.push(routes.bot as any);
    };

    return (
        <div className='betwins-page'>
            {/* ── Section 1: Bot cards (mirrors lottery lt-type section) ──────── */}
            <div className='lt-type section-pad' style={{ paddingTop: '40px' }}>
                <div className='left-thumb-th'>
                    <img src='/wp-content/uploads/2025/07/left-th.png' alt='' />
                </div>
                <div className='chart'>
                    <img src='/wp-content/uploads/2025/07/chart.png' alt='' />
                </div>

                <div className='container'>
                    <div className='section__header text-center mb-50' data-aos='fade-up' data-aos-duration='1000'>
                        <span
                            style={{
                                fontSize: '15px',
                                fontWeight: 600,
                                color: 'var(--secondary-color)',
                                opacity: 0.75,
                            }}
                        >
                            Automated, Trading Bots
                        </span>
                        <h3 className='title-animation fw-6 mt-16' style={{ fontSize: '32px', opacity: 0.85 }}>
                            Browse &amp; Load a Free Bot
                        </h3>
                        <p className='mt-20 title-description' style={{ fontSize: '14px', opacity: 0.6 }}>
                            Select a bot and click <strong style={{ color: 'var(--primary-color)' }}>Load Bot</strong>{' '}
                            to start trading automatically on your Deriv account.
                        </p>
                    </div>

                    {/* Cards grid */}
                    {loading ? (
                        <div className='text-center section-pad-sm'>
                            <i className='ti ti-loader-2' style={{ fontSize: '48px', color: 'var(--primary-color)' }} />
                            <p className='mt-25'>Loading bots...</p>
                        </div>
                    ) : bots.length === 0 ? (
                        <div className='text-center section-pad-sm'>
                            <i
                                className='ti ti-robot'
                                style={{
                                    fontSize: '64px',
                                    color: 'var(--primary-color)',
                                    display: 'block',
                                    marginBottom: '20px',
                                }}
                            />
                            <h3>Bots Coming Soon</h3>
                            <p className='mt-25'>The DPA team is building bots for you. Check back soon.</p>
                        </div>
                    ) : (
                        <div className='row gutter-24'>
                            {bots.map((bot, i) => (
                                <FreeBotCard key={bot.id} bot={bot} index={i} onLoad={handleLoad} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Section 2: Champions (mirrors lottery winners section) ──────── */}
            <div className='champion section-pad'>
                <div className='left-thumb'>
                    <img src='/wp-content/uploads/2025/07/left-thumb.png' alt='' />
                </div>
                <div className='left-thumb-th'>
                    <img src='/wp-content/uploads/2025/07/left-th.png' alt='' />
                </div>

                <div className='container'>
                    <div className='section__header text-center mb-50' data-aos='fade-up' data-aos-duration='1000'>
                        <span className='fw-6 secondary-text text-xl'>
                            <strong>Top,</strong> Bot Users
                        </span>
                        <h2 className='title-animation fw-6 mt-25'>Meet Our Trading Champions</h2>
                        <p className='mt-25 title-description'>
                            These traders are consistently winning using our free bots. You can too.
                        </p>
                    </div>
                    <div className='row gutter-24'>
                        {champions.length === 0 ? (
                            <div
                                className='col-12 text-center'
                                style={{ padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}
                            >
                                <i
                                    className='ti ti-trophy'
                                    style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}
                                />
                                <p>Champion profiles coming soon.</p>
                            </div>
                        ) : (
                            champions.map((trader, i) => (
                                <ChampionCard key={trader.id} trader={trader} index={i} onQR={setQrTrader} />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* ── Disclaimer ──────────────────────────────────────────────────── */}
            <div
                className='section-pad-sm'
                style={{ borderTop: '1px solid var(--septenary-color)', textAlign: 'center' }}
            >
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                    Bots are provided for educational purposes. Past performance does not guarantee future results.
                    Always test on a demo account first.
                </p>
            </div>

            {/* ── QR Modal ──────────────────────────────────────────────────────── */}
            {qr_trader && (
                <TraderQRModal
                    qr_token={qr_trader.qr_token}
                    display_name={qr_trader.display_name}
                    masked_id={qr_trader.masked_id}
                    avatar={qr_trader.avatar}
                    account_type={qr_trader.account_type}
                    on_close={() => setQrTrader(null)}
                />
            )}
        </div>
    );
});

export default FreeBotsPage;
