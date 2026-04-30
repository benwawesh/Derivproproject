import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Tabs } from '@deriv/components';
import { routes } from '@deriv/shared';
import './dpa-global-tabbar.scss';

const ALL_TABS = [
    { label: 'Dashboard', icon: 'IcDashboardComponentTab', path: `${routes.bot}#dashboard` },
    { label: 'Bot Builder', icon: 'IcBotBuilderTabIcon', path: `${routes.bot}#bot_builder` },
    { label: 'Charts', icon: 'IcChartsTabDbot', path: `${routes.bot}#chart` },
    { label: 'Tutorials', icon: 'IcTutorialsTabs', path: `${routes.bot}#tutorial` },
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

const getActiveIndex = (pathname: string, hash: string): number => {
    return ALL_TABS.findIndex(tab => {
        if (tab.path.includes('#')) {
            const [p, h] = tab.path.split('#');
            return pathname === p && hash === `#${h}`;
        }
        return pathname === tab.path;
    });
};

const DPAGlobalTabBar = () => {
    const history = useHistory();
    const location = useLocation();

    const active_index = React.useMemo(
        () => getActiveIndex(location.pathname, location.hash),
        [location.pathname, location.hash]
    );

    const handleTabClick = (index: number) => {
        const tab = ALL_TABS[index];
        if (tab) history.push(tab.path as any);
    };

    return (
        <Tabs
            active_index={active_index}
            className='dpa-global-tabbar'
            top
            has_bottom_line
            is_scrollable
            onTabItemClick={handleTabClick}
        >
            {ALL_TABS.map(tab => (
                <div key={tab.path} label={tab.label} icon={(tab as any).icon} />
            ))}
        </Tabs>
    );
};

export default DPAGlobalTabBar;
