import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useHistory } from 'react-router-dom';
import { routes } from '@deriv/shared';
import './dpa-bot-tab-injector.scss';

const PAGE_LINKS = [
    { label: 'Home', path: '/' },
    { label: 'Challenge 🔥', path: '/challenge' },
    { label: 'Leaderboard', path: '/leaderboard' },
    { label: 'Free Bots', path: '/free-bots' },
    { label: 'Super Bots ⭐', path: '/superbot' },
    { label: 'Copy Trading', path: '/copy-trading' },
    { label: 'Analysis Tool', path: '/analysis' },
    { label: 'Strategies', path: '/strategies' },
    { label: 'Risk Calculator', path: '/risk-calculator' },
    { label: 'My Reports', path: routes.my_reports },
    { label: 'D-Trader', path: routes.trade },
];

const DPABotTabInjector = () => {
    const history = useHistory();
    const [container, setContainer] = useState<Element | null>(null);

    useEffect(() => {
        const find = () => {
            // The Tabs component with className='main__tabs' renders the list as dc-tabs__list--main__tabs
            const el = document.querySelector('.dc-tabs__list--main__tabs');
            if (el) {
                setContainer(el);
            }
        };

        find();

        // Watch for the bot to mount (user navigates to /bot)
        const observer = new MutationObserver(find);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    if (!container) return null;

    return ReactDOM.createPortal(
        <>
            <span className='dpa-tab-separator' />
            {PAGE_LINKS.map(link => (
                <li
                    key={link.path}
                    className='dc-tabs__item dpa-injected-tab'
                    onClick={() => history.push(link.path as any)}
                >
                    {link.label}
                </li>
            ))}
        </>,
        container
    );
};

export default DPABotTabInjector;
