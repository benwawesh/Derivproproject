const TESTIMONIALS = [
    {
        name: 'Emmanuel K.',
        time: '2 hours ago',
        rating: 5,
        title: 'Best prop firm for African traders',
        text: 'Finally a prop firm that understands us. No geographic restrictions, bots are allowed, and the synthetic indices are available 24/7. Passed Phase 1 in 3 weeks.',
        verified: true,
        avatar: 'E',
        color: '#e67e22',
    },
    {
        name: 'Chidi Okonkwo',
        time: '5 hours ago',
        rating: 5,
        title: 'Got my $5,000 funded account!',
        text: 'I cannot believe how smooth the process was. My bot ran the whole challenge while I slept. DerivProAcademy is the real deal — completely free to enter and the profit split is generous.',
        verified: true,
        avatar: 'C',
        color: '#27ae60',
    },
    {
        name: 'Fatima A.',
        time: '1 day ago',
        rating: 5,
        title: 'Won $1,000 in the monthly competition',
        text: 'I ranked 8th on the leaderboard last month and won $1,000 funded account. The competition resets every month so everyone gets a fair chance. Highly recommend!',
        verified: true,
        avatar: 'F',
        color: '#8e44ad',
    },
    {
        name: 'Kwame Mensah',
        time: '2 days ago',
        rating: 5,
        title: 'The bot builder is a game changer',
        text: 'Built my first Rise/Fall bot in 20 minutes with no coding. It has been running for a month consistently. The academy resources helped me understand risk management too.',
        verified: false,
        avatar: 'K',
        color: '#2980b9',
    },
    {
        name: 'Amara Diallo',
        time: '3 days ago',
        rating: 5,
        title: 'Customer support is excellent',
        text: 'Had an issue with my Phase 2 verification and support sorted it within 2 hours. Very professional and friendly. This platform actually cares about its traders.',
        verified: true,
        avatar: 'A',
        color: '#c0392b',
    },
    {
        name: 'Tunde Adeyemi',
        time: '5 days ago',
        rating: 5,
        title: '80% profit split — unbeatable',
        text: 'I compared 10 prop firms before choosing DPA. No entry fee, bots allowed, synthetics 24/7, and 80% profit split. There is simply no better option for Deriv traders.',
        verified: true,
        avatar: 'T',
        color: '#16a085',
    },
];

const StarIcon = () => (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='#ffd700'>
        <path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' />
    </svg>
);

const TrustpilotIcon = () => (
    <svg width='20' height='20' viewBox='0 0 24 24' fill='#00b67a'>
        <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
    </svg>
);

export default function Testimonials() {
    return (
        <section className='dpa-testimonials'>
            <div className='dpa-testimonials__inner'>
                {/* Header */}
                <div className='dpa-home__section-header'>
                    <h2>What Our Traders Say</h2>
                    <p>Real reviews from DerivProAcademy traders across Africa and beyond</p>
                </div>

                {/* Trust score bar */}
                <div className='dpa-testimonials__trust'>
                    <div className='dpa-testimonials__trust-score'>
                        <span className='dpa-testimonials__excellent'>Excellent</span>
                        <div className='dpa-testimonials__stars'>
                            {[...Array(5)].map((_, i) => (
                                <StarIcon key={i} />
                            ))}
                        </div>
                    </div>
                    <div className='dpa-testimonials__trust-meta'>
                        <div className='dpa-testimonials__trust-icon'>
                            <TrustpilotIcon />
                        </div>
                        <span>
                            Rated <strong>4.8 / 5</strong> based on <strong>2,340 reviews</strong>
                        </span>
                    </div>
                </div>

                {/* Cards grid */}
                <div className='dpa-testimonials__grid'>
                    {TESTIMONIALS.map((t, i) => (
                        <div key={i} className='dpa-testimonials__card'>
                            <div className='dpa-testimonials__card-top'>
                                <div className='dpa-testimonials__stars'>
                                    {[...Array(t.rating)].map((_, j) => (
                                        <StarIcon key={j} />
                                    ))}
                                </div>
                                {t.verified && <span className='dpa-testimonials__verified'>Verified</span>}
                            </div>
                            <h4 className='dpa-testimonials__title'>{t.title}</h4>
                            <p className='dpa-testimonials__text'>{t.text}</p>
                            <div className='dpa-testimonials__author'>
                                <div className='dpa-testimonials__avatar' style={{ background: t.color }}>
                                    {t.avatar}
                                </div>
                                <div>
                                    <div className='dpa-testimonials__name'>{t.name}</div>
                                    <div className='dpa-testimonials__time'>{t.time}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
