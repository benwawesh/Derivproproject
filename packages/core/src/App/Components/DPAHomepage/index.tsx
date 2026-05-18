import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { observer, useStore } from '@deriv/stores';
import { redirectToLogin, routes } from '@deriv/shared';
import { getLanguage } from '@deriv/translations';
import './dpa-homepage.scss';

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
    '/wp-content/uploads/elementor/css/post-149c2f.css',
    '/wp-content/uploads/elementor/css/post-155873.css',
];

// Load scripts sequentially so dependencies are satisfied
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

// Inject CSS at module-load time so the browser starts fetching
// betwin stylesheets before the first React render, reducing FOUC.
if (typeof document !== 'undefined') {
    BETWIN_CSS.forEach(href => {
        if (document.querySelector(`style[data-betwin-src="${href}"]`)) return;
        const style = document.createElement('style');
        style.setAttribute('data-betwin-src', href);
        style.textContent = `@import url("${href}") layer(betwin);`;
        document.head.appendChild(style);
    });
}

function useBetwinAssets() {
    useEffect(() => {
        BETWIN_CSS.forEach(href => {
            if (document.querySelector(`style[data-betwin-src="${href}"]`)) return;
            const style = document.createElement('style');
            style.setAttribute('data-betwin-src', href);
            // Load in a CSS layer so all unlayered DPA CSS always wins in cascade
            style.textContent = `@import url("${href}") layer(betwin);`;
            document.head.appendChild(style);
        });

        const scripts: HTMLScriptElement[] = [];
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
                scripts.push(s);
            });

        (async () => {
            // Phase 1: load all dependencies before the main3517 scripts.
            // This lets us set ScrollTrigger's scroller to Deriv's #app_contents
            // BEFORE main3517.js creates any ScrollTrigger instances (title-animation,
            // progress bars, parallax). Without this, they all default to window and
            // never fire inside Deriv's custom scroll container.
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

                if (w.$ && w.$.fn.isotope) {
                    w.$('.filter-wrapper').isotope({ itemSelector: '.filter-item', layoutMode: 'fitRows' });
                }

                // Reinitialize Swiper sliders explicitly — main3517.js may have run
                // before React finished painting, so sliders need a fresh init.
                if (w.Swiper) {
                    new w.Swiper('.lottery__type-slider', {
                        loop: true,
                        speed: 1000,
                        slidesPerView: 1,
                        slidesPerGroup: 1,
                        spaceBetween: 24,
                        freeMode: true,
                        centeredSlides: true,
                        autoplay: { delay: 2000, disableOnInteraction: false, pauseOnMouseEnter: true },
                        navigation: { nextEl: '.next-lottery', prevEl: '.prev-lottery' },
                        breakpoints: { 576: { slidesPerView: 2 }, 992: { slidesPerView: 3 } },
                    });
                    new w.Swiper('.testimonial__slider', {
                        loop: true,
                        speed: 800,
                        slidesPerView: 1,
                        spaceBetween: 24,
                        navigation: { nextEl: '.next-testimonial', prevEl: '.prev-testimonial' },
                    });
                }

                // Reinitialize VanillaTilt for .tilt cards
                if (w.VanillaTilt) {
                    w.VanillaTilt.init(document.querySelectorAll('.tilt'), { max: 5, speed: 3000 });
                }

                // Title animation: char-by-char slide-in that REPEATS on every scroll pass.
                // When the heading leaves the viewport we instantly reset the chars back to
                // their hidden state (no transition) so the slide-in plays again on the
                // next entry.
                const sc = document.getElementById('app_contents');
                if (sc) {
                    document.querySelectorAll('.title-animation').forEach((el: Element) => {
                        if (el.querySelector('.title-char')) return; // already split
                        const text = (el.textContent || '').trim();
                        if (!text) return;
                        el.innerHTML = text
                            .split('')
                            .map((ch: string, i: number) => {
                                const esc = ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
                                if (ch === ' ')
                                    return '<span style="display:inline-block;min-width:0.3em">&nbsp;</span>';
                                const delay = (i * 0.04).toFixed(2);
                                const tr = `opacity 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s,transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}s`;
                                return `<span class="title-char" data-tr="${tr}" style="display:inline-block;opacity:0;transform:translateX(40px);transition:${tr}">${esc}</span>`;
                            })
                            .join('');
                        const io = new IntersectionObserver(
                            entries => {
                                entries.forEach(entry => {
                                    const chars = Array.from(el.querySelectorAll('.title-char')) as HTMLElement[];
                                    if (entry.isIntersecting) {
                                        // Animate in
                                        chars.forEach(span => {
                                            span.style.opacity = '1';
                                            span.style.transform = 'translateX(0)';
                                        });
                                    } else {
                                        // Instantly reset so animation replays next scroll
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
                }

                // AOS animations: toggle on every scroll pass instead of once.
                // Removing unobserve + toggling the class means elements re-animate
                // every time they scroll into view.
                const scrollContainer = document.getElementById('app_contents');
                if (scrollContainer) {
                    aosObserver = new IntersectionObserver(
                        entries => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) {
                                    entry.target.classList.add('aos-animate');
                                } else {
                                    entry.target.classList.remove('aos-animate');
                                }
                            });
                        },
                        { root: scrollContainer, threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
                    );
                    document.querySelectorAll('[data-aos]').forEach(el => aosObserver!.observe(el));
                }
            }, 300);
        })();

        return () => {
            if (initTimer) clearTimeout(initTimer);
            aosObserver?.disconnect();
            // CSS and scripts are kept in the DOM intentionally — removing them on
            // unmount causes a visible flash when navigating away and back.
            // The !important overrides in dpa-homepage.scss protect the DPA header.
        };
    }, []);
}

const IMG = '/wp-content/uploads/2025/07/';

const DPAHomepage = observer(() => {
    useBetwinAssets();

    const { client } = useStore();
    const { is_logged_in } = client;
    const history = useHistory();

    const go = (path: string) => history.push(path as any);
    const goLogin = () => (is_logged_in ? go('/challenge') : redirectToLogin(false, getLanguage()));

    const contests = [
        {
            cat: 'Car',
            img: 'car-four.png',
            badge: 'Exclusive',
            num: '9T2',
            title: 'Treasure Draw',
            price: '$12.85',
            tickets: '95K+ Remaining',
            days: '5 Days',
        },
        {
            cat: 'Watch',
            img: 'car-one.png',
            badge: 'Exclusive',
            num: '9T2',
            title: 'Drive & Win',
            price: '$12.85',
            tickets: '95K+ Remaining',
            days: '5 Days',
        },
        {
            cat: 'Laptop',
            img: 'car-two.png',
            badge: 'Exclusive',
            num: '5B2',
            title: 'Wheel Triumph',
            price: '$36.22',
            tickets: '95K+ Remaining',
            days: '7 Days',
        },
        {
            cat: 'Car',
            img: 'car-three.png',
            badge: 'Exclusive',
            num: '5B2',
            title: 'Luxury Wheels',
            price: '$36.22',
            tickets: '95K+ Remaining',
            days: '7 Days',
        },
        {
            cat: 'Bike',
            img: 'car-five.png',
            badge: 'Exclusive',
            num: 'R15',
            title: 'Draw Treasure',
            price: '$1420',
            tickets: '95K+ Remaining',
            days: '3 Days',
        },
        {
            cat: 'Cycle',
            img: 'car-six.png',
            badge: 'Exclusive',
            num: 'B1k',
            title: 'Fast Lane Lottery',
            price: '$14.40',
            tickets: '95K+ Remaining',
            days: '3 Days',
        },
    ];

    return (
        <div className='betwins-page'>
            {/* Back to top */}
            <button className='progress-wrap' aria-label='scroll indicator' title='back to top'>
                <span></span>
                <svg className='progress-circle svg-content' width='100%' height='100%' viewBox='-1 -1 102 102'>
                    <path d='M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98' />
                </svg>
            </button>

            {/* Body overlay */}
            <div className='body-overlay' id='body-overlay'></div>

            {/* Search popup */}
            <div className='search-popup'>
                <button className='close-search' aria-label='close search box' title='close search box'>
                    <i className='fa fa-times' />
                </button>
                <form>
                    <div className='search-popup__group'>
                        <input type='text' name='s' placeholder='Search.....' />
                        <button type='submit' aria-label='search'>
                            <i className='fa-solid fa-magnifying-glass' />
                        </button>
                    </div>
                </form>
            </div>

            {/* ── HERO ─────────────────────────────────────────────── */}
            <div className='hero' style={{ backgroundImage: `url('${IMG}hero01-bg.png')` }}>
                <div className='container'>
                    <div className='row'>
                        <div className='col-12 col-lg-7 col-xl-7'>
                            <div className='hero__content'>
                                <span className='fw-6 secondary-text text-xl sub-title'>
                                    <strong>Fair,</strong> Fast &amp; Crypto-Backed Jackpots
                                </span>
                                <h1 className='title-animation fw-7 mt-25'>Win Weekly Lottery Draws, Risk-Free</h1>
                                <p className='text-xl mt-25'>
                                    Welcome to Betwins, the ultimate online gaming platform where every bet you place
                                    brings you closer to winning real cryptocurrency!
                                </p>
                                <div className='banner-action mt-40'>
                                    <button onClick={goLogin} className='btn--primary'>
                                        Play Games <i className='ti ti-arrow-narrow-right' />
                                    </button>
                                    <button onClick={() => go(routes.trade)} className='btn--secondary'>
                                        Explore Lottery <i className='ti ti-arrow-narrow-right' />
                                    </button>
                                </div>
                                <div className='mt-60 hero__review'>
                                    <p className='text-lg'>Excellent</p>
                                    <div className='review'>
                                        <i className='ti ti-star-filled' />
                                        <i className='ti ti-star-filled' />
                                        <i className='ti ti-star-filled' />
                                        <i className='ti ti-star-filled' />
                                        <i className='ti ti-star-half-filled' />
                                    </div>
                                    <p className='text-lg'>Based on 25,1005+ reviews.</p>
                                </div>
                            </div>
                        </div>
                        <div className='col-12 col-lg-5 col-xl-5'>
                            <div className='hero__thumb-wrapper d-none d-lg-block'>
                                <div className='hero__thumb'>
                                    <div className='main-img'>
                                        <img src={`${IMG}hero-thumb.png`} alt='img' />
                                    </div>
                                </div>
                                <div className='star-img'>
                                    <img src={`${IMG}lotter-stars.png`} alt='' />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='ball-img-one'>
                    <img src={`${IMG}ball-one.png`} alt='' />
                </div>
                <div className='ball-img-two'>
                    <img src={`${IMG}ball-four.png`} alt='' />
                </div>
                <div className='ball-img-three'>
                    <img src={`${IMG}ball-two.png`} alt='' />
                </div>
                <div className='ball-img-four'>
                    <img src={`${IMG}ball-three.png`} alt='' />
                </div>
                <div className='rocket'>
                    <img src={`${IMG}rocket-two.png`} alt='' />
                </div>
                <div className='btc d-none d-sm-block'>
                    <img src={`${IMG}premium.png`} alt='' />
                </div>
            </div>

            {/* ── SERVICES / FANTASY BENTO ─────────────────────────── */}
            <div className='e-con-boxed' style={{ position: 'relative' }}>
                <div className='e-con-inner'>
                    {/* Decorative floating images */}
                    <div
                        className='elementor-widget elementor-absolute image-animation-rotate'
                        style={{ position: 'absolute', top: '40px', right: '60px', zIndex: 0, pointerEvents: 'none' }}
                    >
                        <img src={`${IMG}service-btc.png`} alt='' width='120' />
                    </div>
                    <div
                        className='elementor-widget elementor-absolute image-animation-up-down'
                        style={{ position: 'absolute', bottom: '40px', left: '20px', zIndex: 0, pointerEvents: 'none' }}
                    >
                        <img src={`${IMG}service-bottom-thumb.png`} alt='' width='200' />
                    </div>
                    <div
                        className='elementor-widget elementor-absolute image-animation-up-down'
                        style={{
                            position: 'absolute',
                            top: '50%',
                            right: '0',
                            transform: 'translateY(-50%)',
                            zIndex: 0,
                            pointerEvents: 'none',
                        }}
                    >
                        <img src={`${IMG}service-right-thumb.png`} alt='' width='60' />
                    </div>

                    <div className='container'>
                        <div className='section__header text-center' data-aos='fade-up' data-aos-duration='1000'>
                            <span className='fw-6 secondary-text text-xl'>
                                <strong>Meet,</strong> Our Recent Contests
                            </span>
                            <h2 className='title-animation fw-6 mt-25'>Fantasy Sports with Cryptocurrency</h2>
                            <p className='mt-25 title-description'>
                                We&apos;ve made it easier than ever to dive into the world of crypto gaming. With just a
                                few clicks, you can deposit your favorite cryptocurrency
                            </p>
                        </div>

                        <div className='row'>
                            {/* Col 1: Sports + Casino */}
                            <div className='col-lg-4'>
                                <div data-aos='fade-up' data-aos-duration='600' data-aos-delay='400'>
                                    <div className='fantasy__single tilt'>
                                        <div className='intro'>
                                            <h5 className='neutral-top fw-6 text-uppercase'>
                                                <img src={`${IMG}ic-two.png`} alt='' /> SPORTS
                                            </h5>
                                        </div>
                                        <div className='content mt-120'>
                                            <p className='mb-15'>Dive into our in-house games, live casino and slots</p>
                                            <button onClick={goLogin} className='btn--link'>
                                                Play Now <i className='ti ti-arrow-narrow-right' />
                                            </button>
                                        </div>
                                        <div className='thumb'>
                                            <img src={`${IMG}service-image01.png`} alt='' />
                                        </div>
                                    </div>
                                </div>
                                <div data-aos='fade-up' data-aos-duration='600' data-aos-delay='400' className='mt-24'>
                                    <div className='fantasy__single tilt'>
                                        <div className='intro'>
                                            <h5 className='neutral-top fw-6 text-uppercase'>
                                                <img src={`${IMG}ic-three.png`} alt='' /> Casino
                                            </h5>
                                        </div>
                                        <div className='content mt-120'>
                                            <p className='mb-15'>Dive into our in-house games, live casino and slots</p>
                                            <button onClick={goLogin} className='btn--link'>
                                                Play Now <i className='ti ti-arrow-narrow-right' />
                                            </button>
                                        </div>
                                        <div className='thumb'>
                                            <img src={`${IMG}service-image03.png`} alt='' />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Col 2: Racing (tall) */}
                            <div className='col-lg-4' style={{ display: 'flex', flexDirection: 'column' }}>
                                <div
                                    data-aos='fade-up'
                                    data-aos-duration='600'
                                    data-aos-delay='200'
                                    style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                                >
                                    <div
                                        className='fantasy__single single-two tilt fantasy__single-long'
                                        style={{ flex: 1 }}
                                    >
                                        <div className='intro'>
                                            <h5 className='neutral-top fw-6 text-uppercase'>
                                                <img src={`${IMG}ic-one.png`} alt='' /> Racing
                                            </h5>
                                        </div>
                                        <div className='content mt-40'>
                                            <p className='mb-15'>Dive into our in-house games, live casino and slots</p>
                                            <button onClick={goLogin} className='btn--link'>
                                                Play Now <i className='ti ti-arrow-narrow-right' />
                                            </button>
                                        </div>
                                        <div className='thumb'>
                                            <img src={`${IMG}service-image02.png`} alt='' />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Col 3: Lottery + Bingo */}
                            <div className='col-lg-4'>
                                <div data-aos='fade-up' data-aos-duration='600' data-aos-delay='400'>
                                    <div className='fantasy__single tilt'>
                                        <div className='intro'>
                                            <h5 className='neutral-top fw-6 text-uppercase'>
                                                <img src={`${IMG}ic-three.png`} alt='' /> LOTTERY
                                            </h5>
                                        </div>
                                        <div className='content mt-120'>
                                            <p className='mb-15'>Dive into our in-house games, live casino and slots</p>
                                            <button onClick={goLogin} className='btn--link'>
                                                Play Now <i className='ti ti-arrow-narrow-right' />
                                            </button>
                                        </div>
                                        <div className='thumb'>
                                            <img src={`${IMG}service-image04.png`} alt='' />
                                        </div>
                                    </div>
                                </div>
                                <div data-aos='fade-up' data-aos-duration='600' data-aos-delay='400' className='mt-24'>
                                    <div className='fantasy__single tilt'>
                                        <div className='intro'>
                                            <h5 className='neutral-top fw-6 text-uppercase'>
                                                <img src={`${IMG}ic-six.png`} alt='' /> BINGO
                                            </h5>
                                        </div>
                                        <div className='content mt-120'>
                                            <p className='mb-15'>Dive into our in-house games, live casino and slots</p>
                                            <button onClick={goLogin} className='btn--link'>
                                                Play Now <i className='ti ti-arrow-narrow-right' />
                                            </button>
                                        </div>
                                        <div className='thumb'>
                                            <img src={`${IMG}service-image05.png`} alt='' />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='button-style text-center mt-40'>
                            <button onClick={goLogin} className='btn--secondary'>
                                All Categories <i className='ti ti-arrow-narrow-right' />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PICK YOUR WINNING NUMBERS ────────────────────────── */}
            <div
                className='lottery-section-bg'
                style={{ backgroundImage: `url('${IMG}lottery-bg.png')`, position: 'relative', overflow: 'hidden' }}
            >
                {/* Decorative wheels — positions match WordPress elementor CSS:
                    left-wheel.png → right:0, top:100px
                    right-wheel.png → left:0, bottom:0 */}
                <div
                    className='elementor-absolute image-animation-up-down2'
                    style={{ position: 'absolute', right: 0, top: '100px', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}left-wheel.png`} alt='' width='200' />
                </div>
                <div
                    className='elementor-absolute image-animation-up-down2'
                    style={{ position: 'absolute', left: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}right-wheel.png`} alt='' width='178' />
                </div>

                <div
                    className='lottery lottery-alternate lottery-details'
                    style={{ paddingTop: '105px', paddingBottom: '120px' }}
                >
                    <div className='container'>
                        <div className='row align-items-center'>
                            <div className='col-lg-6'>
                                <div className='section__header' data-aos='fade-up' data-aos-duration='1000'>
                                    <span className='fw-6 secondary-text text-xl'>
                                        <strong>Pick,</strong> Lucky Numbers
                                    </span>
                                    <h2 className='title-animation fw-6 mt-25'>Pick Your Winning Numbers</h2>
                                </div>
                            </div>
                            <div className='col-lg-6 lottery-right-col'>
                                <p>
                                    Explore our featured games at Betwins, where every spin and every bet brings you
                                    closer to huge...
                                </p>
                                <div className='button-style mt-25'>
                                    <button onClick={goLogin} className='btn--secondary'>
                                        Explore All Games <i className='ti ti-arrow-narrow-right' />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Lottery type Swiper slider */}
                        <div className='lottery__type-wrapper mb-25 mt-40'>
                            <div className='lottery__type-slider swiper'>
                                <div className='swiper-wrapper'>
                                    {[
                                        { img: 'image-slider-one.png', name: 'Euro Millions', price: '$657.54' },
                                        { img: 'image-slider-four.png', name: 'Hot Lotto', price: '$657.54' },
                                        { img: 'image-slider-two.png', name: 'OZ Lotto Star', price: '$657.54' },
                                        { img: 'image-slider-three.png', name: 'Bingo Jackpot', price: '$657.54' },
                                        { img: 'image-slider-four.png', name: 'Hot Lotto', price: '$657.54' },
                                    ].map((lt, i) => (
                                        <div key={i} className='swiper-slide'>
                                            <div className='lottery__type lt-type-two'>
                                                <div className='thumb'>
                                                    <img src={`${IMG}${lt.img}`} alt='' />
                                                </div>
                                                <div className='content'>
                                                    <h6 className='fw-6'>{lt.name}</h6>
                                                    <p className='mt-16 text-lg'>
                                                        <i className='ti ti-wallet' /> {lt.price}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className='slider-navigation'>
                                <button
                                    type='button'
                                    aria-label='prev slide'
                                    title='prev slide'
                                    className='prev-lottery slider-btn'
                                >
                                    <i className='fa-solid fa-angle-left' />
                                </button>
                                <button
                                    type='button'
                                    aria-label='next slide'
                                    title='next slide'
                                    className='next-lottery slider-btn'
                                >
                                    <i className='fa-solid fa-angle-right' />
                                </button>
                            </div>
                        </div>

                        {/* Number picker card */}
                        <div className='row gutter-40'>
                            <div className='col-12'>
                                <div className='lottery-card' data-aos='fade-up' data-aos-duration='600'>
                                    <div className='lt-alternate-card'>
                                        <div className='lottery-intro mb-35'>
                                            <h5 className='title-animation fw-6 neutral-top'>Pick Numbers</h5>
                                            <div className='lottery-intro__action'>
                                                <button className='quick-pick' aria-label='quick pick'>
                                                    Quick Pick
                                                </button>
                                                <button className='clear-all' aria-label='clear all'>
                                                    Clear All
                                                </button>
                                                <button className='add-numbers' aria-label='add numbers'>
                                                    Add Numbers
                                                </button>
                                            </div>
                                        </div>
                                        <div className='pick-numbers'>
                                            <div className='pick-number__single'>
                                                <div className='pick-number__intro'>
                                                    <p className='text-xl fw-5 neutral-top'>Picks 5 Numbers</p>
                                                </div>
                                                <ul className='pick-number-list quick-pick-list mt-20'>
                                                    {Array.from({ length: 41 }, (_, i) => (
                                                        <li key={i}>{i}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <hr className='divider mt-10 mb-10' />
                                            <div className='pick-number__single'>
                                                <div className='pick-number__intro'>
                                                    <p className='text-xl fw-5 neutral-top'>Pick 1 Power Ball</p>
                                                </div>
                                                <ul className='pick-number-list power-pick-list mt-20'>
                                                    {Array.from({ length: 31 }, (_, i) => (
                                                        <li key={i}>{i}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        className='lt-alternate-card mt-16'
                                        data-aos='fade-up'
                                        data-aos-duration='600'
                                        data-aos-delay='200'
                                    >
                                        <div className='lottery-intro mb-35'>
                                            <h5 className='title-animation fw-6 neutral-top'>Selected Numbers</h5>
                                            <div className='lottery-intro__action'>
                                                <button className='delete-all dlt' aria-label='delete all'>
                                                    Delete All
                                                </button>
                                            </div>
                                        </div>
                                        <div className='lt-alternate-view'>
                                            <div className='lt-alternate-single'>
                                                <h6 className='fw-6'>Lucky Numbers</h6>
                                                <div className='lt-luck-wrapper mt-16'>
                                                    {[0, 1, 2, 3, 4].map(i => (
                                                        <span key={i} className='lucky-number'>
                                                            00
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className='lt-alternate-single'>
                                                <h6 className='fw-6'>Lucky Power Ball</h6>
                                                <div className='lt-luck-wrapper mt-16'>
                                                    <span className='lucky-power-number'>00</span>
                                                </div>
                                            </div>
                                        </div>
                                        <hr className='divider mt-40 mb-40' />
                                        <div className='price-meta mt-40'>
                                            <div className='content'>
                                                <h6 className='neutral-top fw-6 secondary-text'>$945.58</h6>
                                                <p className='text-sm mt-6'>Ticket Price</p>
                                            </div>
                                            <div className='cta'>
                                                <button className='btn--primary' onClick={goLogin}>
                                                    Buy Ticket
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <hr className='divider mt-40 mb-30' />

                                    <div
                                        className='lt-alternate-card mt-16'
                                        data-aos='fade-up'
                                        data-aos-duration='600'
                                        data-aos-delay='200'
                                    >
                                        <div className='payment-methods'>
                                            <p className='fw-6 text-xl'>Payment methods we accept :</p>
                                            <div className='payment-methods__inner mt-24'>
                                                {[
                                                    'amex',
                                                    'apple',
                                                    'bit',
                                                    'dines',
                                                    'discover',
                                                    'gpay',
                                                    'mastercard',
                                                    'paypal',
                                                    'verifone',
                                                    'visa',
                                                ].map(m => (
                                                    <div key={m} className='payment-method-single'>
                                                        <img src={`${IMG}${m}.png`} alt={m} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ABOUT ─────────────────────────────────────────────── */}
            <div style={{ position: 'relative', paddingTop: '120px', paddingBottom: '90px', overflow: 'hidden' }}>
                {/* Decorative */}
                <div
                    className='elementor-absolute image-animation-up-down2'
                    style={{ position: 'absolute', left: 0, top: '10%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}spring-two.png`} alt='' width='60' />
                </div>
                <div
                    className='elementor-absolute image-animation-up-down2'
                    style={{ position: 'absolute', right: '5%', bottom: '10%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}rocket-xs.png`} alt='' width='90' />
                </div>

                <div className='container'>
                    <div className='row align-items-center'>
                        <div className='col-lg-6'>
                            <div className='about-three__wrapper' style={{ marginLeft: '-45%' }}>
                                <div className='authentication__thumb text-center d-none d-lg-block'>
                                    <div className='circle-img'>
                                        <img src={`${IMG}circle.png`} alt='' />
                                    </div>
                                    <div className='thumb'>
                                        <img
                                            src={`${IMG}about-thumb.png`}
                                            alt='Image'
                                            data-aos='zoom-in'
                                            data-aos-duration='600'
                                            data-aos-delay='200'
                                        />
                                    </div>
                                    <div className='number-img'>
                                        <img src={`${IMG}numbers.png`} alt='' />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='col-lg-6'>
                            <div className='section__header' data-aos='fade-up' data-aos-duration='1000'>
                                <span className='fw-6 secondary-text text-xl'>
                                    <strong>Play,</strong> Smart. Win in Crypto.
                                </span>
                                <h2 className='title-animation fw-6 mt-25'>Trusted by Winners, Powered by Crypto</h2>
                                <p className='mt-25 title-description'>
                                    We blend cutting-edge blockchain technology with the thrill of lottery gaming to
                                    deliver an experience that&apos;s secure, transparent.
                                </p>
                            </div>
                            <div className='list-group-items'>
                                {[
                                    {
                                        title: 'Fair Draws',
                                        desc: 'All lottery draws on Betwins are powered by blockchain algorithms.',
                                    },
                                    {
                                        title: 'Instant Payouts',
                                        desc: 'No waiting, no delays — winners get their crypto rewards instantly.',
                                    },
                                    {
                                        title: 'Secure Data',
                                        desc: 'Your data and funds are protected by top-tier blockchain protocols.',
                                    },
                                    {
                                        title: 'Accessibility',
                                        desc: 'Betwins is borderless. No matter where you are, you can join, play.',
                                    },
                                ].map(item => (
                                    <div key={item.title} className='list-group__single'>
                                        <div className='thumb'>
                                            <i className='ti ti-check' />
                                        </div>
                                        <div className='content'>
                                            <h6 className='fw-6'>{item.title}</h6>
                                            <p className='text-sm mt-10'>{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className='button-style two mt-30'>
                                <button onClick={goLogin} className='btn--primary'>
                                    Play Lottery <i className='ti ti-arrow-narrow-right' />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── RECENT CONTESTS ──────────────────────────────────── */}
            <div
                className='lottery-contest lottery contests-section-bg'
                style={{ backgroundImage: `url('${IMG}lottery-result.png')`, position: 'relative', overflow: 'hidden' }}
            >
                {/* Decorative */}
                <div
                    className='elementor-absolute image-animation-rotate'
                    style={{ position: 'absolute', left: '2%', top: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}left-th.png`} alt='' width='120' />
                </div>
                <div
                    className='elementor-absolute'
                    style={{ position: 'absolute', right: '3%', bottom: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}square.png`} alt='' width='90' />
                </div>

                <div className='container'>
                    <div className='section__header text-center' data-aos='fade-up' data-aos-duration='1000'>
                        <span className='fw-6 secondary-text text-xl'>
                            <strong>Try,</strong> your chance at winning
                        </span>
                        <h2 className='title-animation fw-6 mt-25'>Recent Contests</h2>
                        <p className='mt-25 title-description'>
                            We celebrate every win, no matter how big or small. Our platform is buzzing with excitement
                            as players hit jackpots and score massive crypto payouts daily.
                        </p>
                    </div>

                    <div className='row gutter-24 justify-content-center'>
                        <div className='col-12 col-xl-9'>
                            <div className='result__tab-btns text-center'>
                                <ul className='justify-content-center p-2'>
                                    {[
                                        ['*', 'All Categories'],
                                        ['Car', 'Car'],
                                        ['Bike', 'Bike'],
                                        ['Laptop', 'Laptop'],
                                        ['Watch', 'Watch'],
                                        ['Cycle', 'Cycle'],
                                    ].map(([filter, label]) => (
                                        <li key={filter}>
                                            <button
                                                data-filter={filter === '*' ? '*' : `.${filter}`}
                                                className={filter === '*' ? 'active' : ''}
                                            >
                                                <i className='ti ti-layout-grid' />
                                                {label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className='row filter-wrapper mt-40' data-aos='fade-up' data-aos-duration='600'>
                        {contests.map((c, i) => (
                            <div key={i} className={`col-12 col-lg-6 col-xl-4 filter-item ${c.cat}`}>
                                <div className='result__single tilt'>
                                    <div className='contest__intro'>
                                        <span>{c.badge}</span>
                                        <button aria-label='save'>
                                            <i className='ti ti-heart' />
                                        </button>
                                    </div>
                                    <div className='thumb mt-20'>
                                        <img src={`${IMG}${c.img}`} alt='Image' />
                                    </div>
                                    <div className='content'>
                                        <div className='contest-number'>
                                            <p className='text-sm fw-5 mb-0'>Contest</p>
                                            <p className='text-lg fw-6 mt-8 mb-0'>{c.num}</p>
                                        </div>
                                        <h5 className='fw-6 neutral-top'>{c.title}</h5>
                                        <div className='result__info mt-16'>
                                            <p className='time'>Ticket Price:</p>
                                            <p className='held text-xl'>{c.price}</p>
                                        </div>
                                        <div className='result__info mt-16'>
                                            <p>
                                                <i className='ti ti-ticket' />
                                                {c.tickets}
                                            </p>
                                            <p className='time'>
                                                <i className='ti ti-clock-hour-4' /> {c.days}:
                                            </p>
                                        </div>
                                        <div className='cta mt-35'>
                                            <button onClick={goLogin} className='btn--primary'>
                                                View Details <i className='ti ti-arrow-narrow-right' />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className='row'>
                        <div className='col-12'>
                            <div className='mt-40 text-center' data-aos='fade-up' data-aos-duration='600'>
                                <button onClick={goLogin} className='btn--secondary'>
                                    View All Contests <i className='ti ti-arrow-narrow-right' />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── HOW IT WORKS ─────────────────────────────────────── */}
            <div style={{ position: 'relative', paddingTop: '80px', paddingBottom: '0', overflow: 'hidden' }}>
                {/* Decorative */}
                <div
                    className='elementor-absolute image-animation-up-down2'
                    style={{ position: 'absolute', left: 0, top: '10%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}spring.png`} alt='' width='60' />
                </div>
                <div
                    className='elementor-absolute image-animation-rotate'
                    style={{ position: 'absolute', right: '5%', top: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}left-th.png`} alt='' width='100' />
                </div>

                <div className='container'>
                    <div className='section__header text-center' data-aos='fade-up' data-aos-duration='1000'>
                        <span className='fw-6 secondary-text text-xl'>
                            <strong>Step,</strong> by Step Process
                        </span>
                        <h2 className='title-animation fw-6 mt-25'>How It&apos;s Works</h2>
                        <p className='mt-25 title-description'>
                            We&apos;ve made it easier than ever to dive into the world of crypto gaming. With just a few
                            clicks, you can deposit your favorite cryptocurrency
                        </p>
                    </div>
                    <div className='work work-two work-alter'>
                        <div className='container'>
                            <div className='row gutter-60'>
                                {[
                                    {
                                        icon: 'ti-user',
                                        num: '01',
                                        title: 'Sign Up Instantly',
                                        desc: 'Create your Betwins account in just a few minutes. Simply register',
                                        arrow: true,
                                    },
                                    {
                                        icon: 'ti-pig',
                                        num: '02',
                                        title: 'Deposit Securely',
                                        desc: 'Add funds to your account using popular cryptocurrencies like Bitcoin.',
                                        arrow: true,
                                    },
                                    {
                                        icon: 'ti-trophy',
                                        num: '03',
                                        title: 'Win Real Crypto',
                                        desc: 'Browse hundreds of exciting games, from casino classics to live betting.',
                                        arrow: false,
                                    },
                                ].map(step => (
                                    <div key={step.num} className='col-12 col-md-6 col-lg-4'>
                                        <div
                                            className='work__single text-center'
                                            data-aos='fade-up'
                                            data-aos-duration='600'
                                        >
                                            <div className='thumb'>
                                                <i className={`ti ${step.icon}`} />
                                            </div>
                                            <div className='content mt-30'>
                                                <p className='text-lg fw-5'>
                                                    Step_ <span className='secondary-text'>{step.num}</span>
                                                </p>
                                                <h6 className='fw-6 mt-16 work-title'>{step.title}</h6>
                                                <p className='text-sm mt-16 work-content'>{step.desc}</p>
                                            </div>
                                            {step.arrow && (
                                                <img
                                                    src={`${IMG}long-arrow.png`}
                                                    alt=''
                                                    className='ar-img d-none d-xl-block'
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* CTA Banner */}
                    <div className='hiw-cta-banner' data-aos='fade-up' data-aos-duration='800'>
                        <div className='hiw-cta-banner__icon'>
                            <svg
                                aria-hidden='true'
                                className='e-font-icon-svg e-far-user'
                                viewBox='0 0 448 512'
                                xmlns='http://www.w3.org/2000/svg'
                            >
                                <path d='M313.6 304c-28.7 0-42.5 16-89.6 16-47.1 0-60.8-16-89.6-16C60.2 304 0 364.2 0 438.4V464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48v-25.6c0-74.2-60.2-134.4-134.4-134.4zM400 464H48v-25.6c0-47.6 38.8-86.4 86.4-86.4 14.6 0 38.3 16 89.6 16 51.7 0 74.9-16 89.6-16 47.6 0 86.4 38.8 86.4 86.4V464zM224 288c79.5 0 144-64.5 144-144S303.5 0 224 0 80 64.5 80 144s64.5 144 144 144zm0-240c52.9 0 96 43.1 96 96s-43.1 96-96 96-96-43.1-96-96 43.1-96 96-96z' />
                            </svg>
                        </div>
                        <h3 className='hiw-cta-banner__title'>Ready to play? Create your account now.</h3>
                        <div className='button-style two hiw-cta-banner__btn'>
                            <button onClick={goLogin} className='btn--primary'>
                                Register Here <i className='ti ti-arrow-narrow-right' />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── TESTIMONIALS ─────────────────────────────────────── */}
            <div
                className='testi-section-bg'
                style={{
                    backgroundImage: `url('${IMG}testimonial01-bg.png')`,
                    position: 'relative',
                    paddingTop: '80px',
                    paddingBottom: '80px',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative */}
                <div
                    className='elementor-absolute image-animation-rotate'
                    style={{ position: 'absolute', left: '2%', bottom: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}left-th.png`} alt='' width='100' />
                </div>
                <div
                    className='elementor-absolute image-animation-left-right'
                    style={{ position: 'absolute', right: '2%', top: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}right-th-shape.png`} alt='' width='60' />
                </div>
                <div
                    className='elementor-absolute image-animation-up-down'
                    style={{ position: 'absolute', right: '10%', bottom: '10%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}chart.png`} alt='' width='80' />
                </div>

                <div className='container'>
                    <div className='row'>
                        <div className='col-lg-6'>
                            <div className='section__header' data-aos='fade-up' data-aos-duration='1000'>
                                <span className='fw-6 secondary-text text-xl'>
                                    <strong>What,</strong> Our Players Say
                                </span>
                                <h2 className='title-animation fw-6 mt-25'>
                                    Success Stories from Our <span>Winning </span> Players
                                </h2>
                            </div>
                            <div className='testimonial testimonial-alt'>
                                <div className='testimonial__content'>
                                    <div className='testimonial__slider swiper'>
                                        <div className='swiper-wrapper'>
                                            {[
                                                {
                                                    img: 'testi-thumb01.png',
                                                    name: 'Jhon Suria',
                                                    role: 'Frontend Developer',
                                                },
                                                {
                                                    img: 'testi-thumb02.png',
                                                    name: 'Kiss Laura',
                                                    role: 'Product Designer',
                                                },
                                                { img: 'testi-thumb03.png', name: 'Suphiya Khan', role: 'Pro Player' },
                                                { img: 'testi-thumb04.png', name: 'Jhon Joshi', role: 'Senior Player' },
                                            ].map((t, i) => (
                                                <div key={i} className='swiper-slide'>
                                                    <div className='testimonial__slider-single'>
                                                        <div className='review mb-20'>
                                                            {[1, 2, 3, 4, 5].map(n => (
                                                                <i key={n} className='fa fa-star' />
                                                            ))}
                                                        </div>
                                                        <blockquote className='text-xxl testi-description'>
                                                            <q>
                                                                Use receiving accounts a number a currencies and get
                                                                paid like a local Use receivin accounts a number paid
                                                                the most beautiful think
                                                            </q>
                                                        </blockquote>
                                                        <div className='author__info mt-35'>
                                                            <div className='thumb'>
                                                                <img src={`${IMG}${t.img}`} alt='Image' />
                                                            </div>
                                                            <div className='content'>
                                                                <p className='text-xl fw-6 testi-name mb-0'>{t.name}</p>
                                                                <p className='testi-designation mb-0'>{t.role}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className='slider-navigation mt-3'>
                                        <button
                                            type='button'
                                            aria-label='prev slide'
                                            className='prev-testimonial slider-btn'
                                        >
                                            <i className='fa-solid fa-angle-left' />
                                        </button>
                                        <button
                                            type='button'
                                            aria-label='next slide'
                                            className='next-testimonial slider-btn'
                                        >
                                            <i className='fa-solid fa-angle-right' />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className='col-lg-6 d-none d-lg-block'>
                            <div className='testimonial testimonial-alt'>
                                <div className='testimonial__thumb'>
                                    <div className='right-thumb text-end'>
                                        <div className='right__thumb__inner'>
                                            <img
                                                src={`${IMG}top-two.png`}
                                                alt='Image'
                                                data-aos='zoom-in'
                                                data-aos-duration='600'
                                            />
                                            <div className='quote'>
                                                <i className='ti ti-quote' />
                                            </div>
                                        </div>
                                    </div>
                                    <div className='left-thumb'>
                                        <img
                                            src={`${IMG}right-two.png`}
                                            alt=''
                                            data-aos='zoom-in'
                                            data-aos-duration='600'
                                            data-aos-delay='100'
                                        />
                                    </div>
                                    <div className='bottom-thumb'>
                                        <img
                                            src={`${IMG}bottom-two.png`}
                                            alt=''
                                            data-aos='zoom-in'
                                            data-aos-duration='600'
                                            data-aos-delay='200'
                                        />
                                    </div>
                                    <div className='bottom-left-thumb'>
                                        <img src={`${IMG}card-two.png`} alt='' />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── BLOG ─────────────────────────────────────────────── */}
            <div style={{ position: 'relative', paddingTop: '80px', paddingBottom: '80px', overflow: 'hidden' }}>
                {/* Decorative */}
                <div
                    className='elementor-absolute image-animation-pulse'
                    style={{ position: 'absolute', right: '3%', top: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}right-th-shape.png`} alt='' width='60' />
                </div>
                <div
                    className='elementor-absolute image-animation-left-right2'
                    style={{ position: 'absolute', left: '-5%', bottom: '0', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}long-rocket.png`} alt='' width='300' />
                </div>
                <div
                    className='elementor-absolute image-animation-rotate'
                    style={{ position: 'absolute', right: '5%', bottom: '5%', zIndex: 0, pointerEvents: 'none' }}
                >
                    <img src={`${IMG}left-th.png`} alt='' width='100' />
                </div>

                <div className='blog blog-two container'>
                    <div className='section__header text-center' data-aos='fade-up' data-aos-duration='1000'>
                        <span className='fw-6 secondary-text text-xl'>
                            <strong>Latest,</strong> Lottery News
                        </span>
                        <h2 className='title-animation fw-6 mt-25'>Innovative Ways to Play</h2>
                        <p className='mt-25 title-description'>
                            Explore our blog for the latest in lottery insights, tips, and success stories. Whether
                            you&apos;re a seasoned player or just starting out
                        </p>
                    </div>
                    <div className='row'>
                        {[
                            { img: 'poster-1.png', tag: 'Online', title: 'Betwins is the Future of Online Lotteries' },
                            { img: 'king-card-1.png', tag: 'Betting', title: "A Beginner's Guide to Crypto Betting" },
                            {
                                img: 'Screenshot_13-1.png',
                                tag: 'Lottery',
                                title: 'Record-Breaking Lottery Hit the Nation!',
                            },
                        ].map(b => (
                            <div key={b.title} className='col-lg-4 col-md-6'>
                                <div className='blog__single-wrapper' data-aos='fade-up' data-aos-duration='600'>
                                    <div className='blog__single tilt'>
                                        <div className='thumb'>
                                            <img src={`${IMG}${b.img}`} alt='Image' />
                                            <span className='tag text-lg'>{b.tag}</span>
                                        </div>
                                        <div className='content'>
                                            <div className='content__inner'>
                                                <h6 className='mt-20'>{b.title}</h6>
                                            </div>
                                            <div className='content__cta mt-30'>
                                                <button>
                                                    <i className='ti ti-message-2' /> Comments (0)
                                                </button>
                                                <span />
                                                <button onClick={goLogin} className='btn--primary'>
                                                    Read More <i className='ti ti-arrow-narrow-right' />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className='button-style text-center mt-40'>
                        <button onClick={goLogin} className='btn--secondary'>
                            View All <i className='ti ti-arrow-narrow-right' />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── FOOTER ───────────────────────────────────────────── */}
            <div
                className='footer-area footer-two bg-cover footer-active-class'
                style={{ backgroundImage: `url('${IMG}Screenshot_22.png')` }}
            >
                <div className='container'>
                    <div className='row'>
                        <div className='col-12'>
                            <div className='footer__newsletter' data-aos='fade-up' data-aos-duration='600'>
                                <div className='row align-items-center gutter-24'>
                                    <div className='col-12 col-lg-6'>
                                        <div className='footer__newsletter-content'>
                                            <h4 className='mb-3 pb-3 title-animation fw-5 neutral-top'>
                                                Join Our Newsletter
                                            </h4>
                                            <p>
                                                Subscribe to our newsletter for the latest updates, news, and exclusive
                                                insights straight to your inbox.
                                            </p>
                                        </div>
                                    </div>
                                    <div className='col-12 col-lg-6 col-xl-5 offset-xl-1'>
                                        <div className='footer__newsletter-form mt-35'>
                                            <div className='form'>
                                                <input type='email' placeholder='Enter Email' />
                                                <button type='submit' aria-label='subscribe'>
                                                    <i className='fa-solid fa-paper-plane' />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='footer-wraps position-relative z-1'>
                        <div className='footer--top padding-top-120 padding-bottom-40'>
                            <div className='row row-cols-xxl-5 row-cols-lg-3 row-cols-sm-2 row-cols-1 gy-5'>
                                <div className='col'>
                                    <div className='footer__widget'>
                                        <div className='footer__widget-intro'>
                                            <a href='/' className='logo'>
                                                <img src={`${IMG}logo.png`} alt='Image' />
                                            </a>
                                        </div>
                                        <div className='footer__widget-content mt-25'>
                                            <p>
                                                Betwins is an innovative Online Crypto Gaming platform designed for
                                                players.
                                            </p>
                                        </div>
                                        <div className='social mt-35'>
                                            <a href='#' aria-label='facebook'>
                                                <i className='fa-brands fa-facebook-f' />
                                            </a>
                                            <a href='#' aria-label='instagram'>
                                                <i className='fa-brands fa-instagram' />
                                            </a>
                                            <a href='#' aria-label='twitter'>
                                                <i className='fa-brands fa-twitter' />
                                            </a>
                                            <a href='#' aria-label='linkedin'>
                                                <i className='fa-brands fa-linkedin' />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <div className='col'>
                                    <h4 className='widget-headline'>Quick Links</h4>
                                    <ul className='menu'>
                                        {['Home', 'About Us', 'Game', 'Lottery', 'Blog'].map(l => (
                                            <li key={l}>
                                                <a href='#'>{l}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className='col'>
                                    <h4 className='widget-headline'>Categories</h4>
                                    <ul className='menu'>
                                        {['Business', 'Graphics', 'Gaming', 'Lottery', 'Betting'].map(l => (
                                            <li key={l}>
                                                <a href='#'>{l}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className='col'>
                                    <h4 className='widget-headline'>Help &amp; Support</h4>
                                    <ul className='menu'>
                                        {['FAQ', 'Contact Us', 'About Us', 'Blog', 'Sign Up'].map(l => (
                                            <li key={l}>
                                                <a href='#'>{l}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className='col'>
                                    <div className='footer__widget'>
                                        <div className='footer__widget-intro'>
                                            <h6 className='fw-6 neutral-top'>Get In Touch</h6>
                                        </div>
                                        <div className='footer__widget-content mt-25'>
                                            <div className='footer__widget-group'>
                                                <div className='icon'>
                                                    <i className='ti ti-phone-call' />
                                                </div>
                                                <div className='content'>
                                                    <p>(505) 555-0125</p>
                                                    <p className='mt-4'>(225) 555-0118</p>
                                                </div>
                                            </div>
                                            <div className='footer__widget-group mt-16'>
                                                <div className='icon'>
                                                    <i className='ti ti-mail-opened' />
                                                </div>
                                                <div className='content'>
                                                    <p>example@betwins.com</p>
                                                    <p className='mt-4'>contact@betwins.com</p>
                                                </div>
                                            </div>
                                            <div className='footer__widget-group mt-16'>
                                                <div className='icon'>
                                                    <i className='ti ti-map-pin' />
                                                </div>
                                                <div className='content'>
                                                    <p>1901 Thornridge Cir. Shiloh, Hawaii 81063</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='copyright-wrap pt-2 pb-2'>
                        <div className='row'>
                            <div className='col-lg-6 align-self-center'>
                                <div className='copyright-text text-white pt-3 pb-3'>
                                    Copyright © 2025 Betwins All Rights Reserved.
                                </div>
                            </div>
                            <div className='col-lg-6 mt-lg-0 mt-2 text-lg-end align-self-center'>
                                <ul className='menu d-flex justify-content-end gap-3 list-unstyled'>
                                    {['Help & Support', 'Terms & Conditions', 'Privacy Policy'].map(l => (
                                        <li key={l}>
                                            <a href='#'>{l}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default DPAHomepage;
