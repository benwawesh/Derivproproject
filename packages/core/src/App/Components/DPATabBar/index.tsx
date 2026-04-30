import React, { useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { routes } from '@deriv/shared';
import './dpa-tabbar.scss';

const BOT_TABS = [
    { label: 'Dashboard', path: `${routes.bot}#dashboard` },
    { label: 'Bot Builder', path: `${routes.bot}#bot_builder` },
    { label: 'Charts', path: `${routes.bot}#chart` },
    { label: 'Tutorials', path: `${routes.bot}#tutorial` },
];

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

const DPATabBar = () => {
    const history = useHistory();
    const location = useLocation();
    const bar_ref = useRef<HTMLDivElement>(null);
    const [is_dragging, setIsDragging] = useState(false);
    const drag_start_x = useRef(0);
    const drag_scroll = useRef(0);

    const isActive = (path: string) => {
        if (path.includes('#')) {
            const [pathname, hash] = path.split('#');
            return location.pathname === pathname && location.hash === `#${hash}`;
        }
        return location.pathname === path;
    };

    const go = (path: string) => history.push(path as any);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        drag_start_x.current = e.pageX - (bar_ref.current?.offsetLeft ?? 0);
        drag_scroll.current = bar_ref.current?.scrollLeft ?? 0;
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!is_dragging || !bar_ref.current) return;
        e.preventDefault();
        const x = e.pageX - bar_ref.current.offsetLeft;
        bar_ref.current.scrollLeft = drag_scroll.current - (x - drag_start_x.current);
    };
    const onMouseUp = () => setIsDragging(false);

    return (
        <div
            className={`dpa-tabbar${is_dragging ? ' dpa-tabbar--dragging' : ''}`}
            ref={bar_ref}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
        >
            {BOT_TABS.map(item => (
                <button
                    key={item.path}
                    className={`dpa-tabbar__tab${isActive(item.path) ? ' dpa-tabbar__tab--active' : ''}`}
                    onClick={() => go(item.path)}
                >
                    {item.label}
                </button>
            ))}
            <span className='dpa-tabbar__separator' />
            {PAGE_LINKS.map(item => (
                <button
                    key={item.path}
                    className={`dpa-tabbar__tab${isActive(item.path) ? ' dpa-tabbar__tab--active' : ''}`}
                    onClick={() => go(item.path)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
};

export default DPATabBar;
