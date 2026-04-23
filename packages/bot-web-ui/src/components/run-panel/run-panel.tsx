import React from 'react';
import classNames from 'classnames';
import { Button, Drawer, Modal, Money, Tabs, Text, ThemedScrollbars, ToggleSwitch } from '@deriv/components';
import { observer, useStore } from '@deriv/stores';
import { Localize, localize } from '@deriv/translations';
import Journal from 'Components/journal';
import SelfExclusion from 'Components/self-exclusion';
import Summary from 'Components/summary';
import TradeAnimation from 'Components/trade-animation';
import Transactions from 'Components/transactions';
import { DBOT_TABS } from 'Constants/bot-contents';
import { popover_zindex } from 'Constants/z-indexes';
import { useDBotStore } from 'Stores/useDBotStore';

type TStatisticsTile = {
    content: React.ElementType | string;
    contentClassName: string;
    title: string;
};

type TStatisticsSummary = {
    currency: string;
    is_mobile: boolean;
    lost_contracts: number;
    number_of_runs: number;
    total_stake: number;
    total_payout: number;
    toggleStatisticsInfoModal: () => void;
    total_profit: number;
    won_contracts: number;
};
type TDrawerHeader = {
    is_clear_stat_disabled: boolean;
    is_mobile: boolean;
    is_drawer_open: boolean;
    onClearStatClick: () => void;
};

type TDrawerContent = {
    active_index: number;
    is_drawer_open: boolean;
    active_tour: string;
    setActiveTabIndex: () => void;
};

type TDrawerFooter = {
    is_clear_stat_disabled: boolean;
    onClearStatClick: () => void;
};

type TStatisticsInfoModal = {
    is_mobile: boolean;
    is_statistics_info_modal_open: boolean;
    toggleStatisticsInfoModal: () => void;
};

const StatisticsTile = ({ content, contentClassName, title }: TStatisticsTile) => (
    <div className='run-panel__tile'>
        <div className='run-panel__tile-title'>{title}</div>
        <div className={classNames('run-panel__tile-content', contentClassName)}>{content}</div>
    </div>
);

export const StatisticsSummary = ({
    currency,
    is_mobile,
    lost_contracts,
    number_of_runs,
    total_stake,
    total_payout,
    toggleStatisticsInfoModal,
    total_profit,
    won_contracts,
}: TStatisticsSummary) => (
    <div
        className={classNames('run-panel__stat', {
            'run-panel__stat--mobile': is_mobile,
        })}
    >
        <div className='run-panel__stat--info' onClick={toggleStatisticsInfoModal}>
            <div className='run-panel__stat--info-item'>
                <Localize i18n_default_text="What's this?" />
            </div>
        </div>
        <div className='run-panel__stat--tiles'>
            <StatisticsTile
                title={localize('Total stake')}
                alignment='top'
                content={<Money amount={total_stake} currency={currency} show_currency />}
            />
            <StatisticsTile
                title={localize('Total payout')}
                alignment='top'
                content={<Money amount={total_payout} currency={currency} show_currency />}
            />
            <StatisticsTile title={localize('No. of runs')} alignment='top' content={number_of_runs} />
            <StatisticsTile title={localize('Contracts lost')} alignment='bottom' content={lost_contracts} />
            <StatisticsTile title={localize('Contracts won')} alignment='bottom' content={won_contracts} />
            <StatisticsTile
                title={localize('Total profit/loss')}
                content={<Money amount={total_profit} currency={currency} has_sign show_currency />}
                alignment='bottom'
                contentClassName={classNames('run-panel__stat-amount', {
                    'run-panel__stat-amount--positive': total_profit > 0,
                    'run-panel__stat-amount--negative': total_profit < 0,
                })}
            />
        </div>
    </div>
);

const DrawerHeader = ({ is_clear_stat_disabled, is_mobile, is_drawer_open, onClearStatClick }: TDrawerHeader) =>
    is_mobile &&
    is_drawer_open && (
        <Button
            id='db-run-panel__clear-button'
            className='run-panel__clear-button'
            is_disabled={is_clear_stat_disabled}
            text={localize('Reset')}
            onClick={onClearStatClick}
            secondary
        />
    );

const DrawerContent = ({ active_index, is_drawer_open, active_tour, setActiveTabIndex, ...props }: TDrawerContent) => {
    return (
        <>
            <Tabs active_index={active_index} onTabItemClick={setActiveTabIndex} top>
                <div id='db-run-panel-tab__summary' label={localize('Summary')}>
                    <Summary is_drawer_open={is_drawer_open} />
                </div>
                <div id='db-run-panel-tab__transactions' label={localize('Transactions')}>
                    <Transactions is_drawer_open={is_drawer_open} />
                </div>
                <div id='db-run-panel-tab__journal' label={localize('Journal')}>
                    <Journal />
                </div>
            </Tabs>
            {((is_drawer_open && active_index !== 2) || active_tour) && <StatisticsSummary {...props} />}
        </>
    );
};

const DrawerFooter = ({ is_clear_stat_disabled, onClearStatClick }: TDrawerFooter) => (
    <div className='run-panel__footer'>
        <Button
            id='db-run-panel__clear-button'
            className='run-panel__footer-button'
            is_disabled={is_clear_stat_disabled}
            text={localize('Reset')}
            onClick={onClearStatClick}
            has_effect
            secondary
        />
    </div>
);

const MobileDrawerFooter = () => {
    return (
        <div className='controls__section'>
            <div className='controls__buttons'>
                <TradeAnimation className='controls__animation' should_show_overlay />
            </div>
        </div>
    );
};

const StatisticsInfoModal = ({
    is_mobile,
    is_statistics_info_modal_open,
    toggleStatisticsInfoModal,
}: TStatisticsInfoModal) => {
    return (
        <Modal
            className={classNames('statistics__modal', { 'statistics__modal--mobile': is_mobile })}
            title={localize("What's this?")}
            is_open={is_statistics_info_modal_open}
            toggleModal={toggleStatisticsInfoModal}
            width={'440px'}
        >
            <Modal.Body>
                <div className={classNames('statistics__modal-body', { 'statistics__modal-body--mobile': is_mobile })}>
                    <ThemedScrollbars className='statistics__modal-scrollbar'>
                        <Text as='p' weight='bold' className='statistics__modal-body--content no-margin'>
                            {localize('Total stake')}
                        </Text>
                        <Text as='p'>{localize('Total stake since you last cleared your stats.')}</Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            {localize('Total payout')}
                        </Text>
                        <Text as='p'>{localize('Total payout since you last cleared your stats.')}</Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            {localize('No. of runs')}
                        </Text>
                        <Text as='p'>
                            {localize(
                                'The number of times your bot has run since you last cleared your stats. Each run includes the execution of all the root blocks.'
                            )}
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            {localize('Contracts lost')}
                        </Text>
                        <Text as='p'>
                            {localize('The number of contracts you have lost since you last cleared your stats.')}
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            {localize('Contracts won')}
                        </Text>
                        <Text as='p'>
                            {localize('The number of contracts you have won since you last cleared your stats.')}
                        </Text>
                        <Text as='p' weight='bold' className='statistics__modal-body--content'>
                            {localize('Total profit/loss')}
                        </Text>
                        <Text as='p'>
                            {localize(
                                'Your total profit/loss since you last cleared your stats. It is the difference between your total payout and your total stake.'
                            )}
                        </Text>
                    </ThemedScrollbars>
                </div>
            </Modal.Body>
        </Modal>
    );
};

const FundedModeBanner = observer(() => {
    const { funded_account } = useDBotStore();
    const {
        is_funded_mode,
        balance,
        profit_loss,
        profit_loss_percent,
        is_account_blown,
        profit_target_reached,
        daily_loss_limit_reached,
    } = funded_account;

    // Only render when funded account is selected — controlled automatically by account switcher
    if (!is_funded_mode) return null;

    const status_color =
        is_account_blown || daily_loss_limit_reached ? '#ff444f' : profit_target_reached ? '#4bb4b3' : '#ffffff';

    return (
        <div className='funded-banner funded-banner--active'>
            <div className='funded-banner__left'>
                <span className='funded-banner__label'>{localize('Funded Account')}</span>
                <span className='funded-banner__balance' style={{ color: status_color }}>
                    ${balance.toFixed(2)}
                    <span className='funded-banner__pl' style={{ color: profit_loss >= 0 ? '#4bb4b3' : '#ff444f' }}>
                        {profit_loss >= 0 ? ' +' : ' '}
                        {profit_loss.toFixed(2)} ({profit_loss_percent.toFixed(1)}%)
                    </span>
                </span>
            </div>
            {(is_account_blown || daily_loss_limit_reached || profit_target_reached) && (
                <div className='funded-banner__right'>
                    <span className='funded-banner__alert'>
                        {is_account_blown && localize('Account blown')}
                        {daily_loss_limit_reached && !is_account_blown && localize('Daily limit reached')}
                        {profit_target_reached &&
                            !is_account_blown &&
                            !daily_loss_limit_reached &&
                            localize('Target reached!')}
                    </span>
                </div>
            )}
        </div>
    );
});

const RunPanel = observer(() => {
    const { run_panel, dashboard, transactions } = useDBotStore();
    const {
        client,
        ui: { is_desktop },
    } = useStore();
    const { currency } = client;
    const {
        active_index,
        is_drawer_open,
        is_statistics_info_modal_open,
        is_clear_stat_disabled,
        onClearStatClick,
        onMount,
        onRunButtonClick,
        onUnmount,
        setActiveTabIndex,
        toggleDrawer,
        toggleStatisticsInfoModal,
    } = run_panel;
    const { statistics } = transactions;
    const { active_tour, active_tab } = dashboard;
    const { total_payout, total_profit, total_stake, won_contracts, lost_contracts, number_of_runs } = statistics;
    const { BOT_BUILDER, CHART } = DBOT_TABS;

    React.useEffect(() => {
        onMount();
        return () => onUnmount();
    }, [onMount, onUnmount]);

    React.useEffect(() => {
        if (!is_desktop) {
            toggleDrawer(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const content = (
        <DrawerContent
            active_index={active_index}
            currency={currency}
            is_drawer_open={is_drawer_open}
            is_mobile={!is_desktop}
            lost_contracts={lost_contracts}
            number_of_runs={number_of_runs}
            setActiveTabIndex={setActiveTabIndex}
            toggleStatisticsInfoModal={toggleStatisticsInfoModal}
            total_payout={total_payout}
            total_profit={total_profit}
            total_stake={total_stake}
            won_contracts={won_contracts}
            active_tour={active_tour}
        />
    );

    const footer = <DrawerFooter is_clear_stat_disabled={is_clear_stat_disabled} onClearStatClick={onClearStatClick} />;

    const header = (
        <DrawerHeader
            is_clear_stat_disabled={is_clear_stat_disabled}
            is_mobile={!is_desktop}
            is_drawer_open={is_drawer_open}
            onClearStatClick={onClearStatClick}
        />
    );

    const show_run_panel = [BOT_BUILDER, CHART].includes(active_tab) || active_tour;
    if ((!show_run_panel && is_desktop) || active_tour === 'bot_builder') return null;

    return (
        <>
            <FundedModeBanner />
            <div className={!is_desktop && is_drawer_open ? 'run-panel__container--mobile' : 'run-panel'}>
                <Drawer
                    anchor='right'
                    className={classNames('run-panel', {
                        'run-panel__container': is_desktop,
                        'run-panel__container--tour-active': is_desktop && active_tour,
                    })}
                    contentClassName='run-panel__content'
                    header={header}
                    footer={is_desktop && footer}
                    is_open={is_drawer_open}
                    toggleDrawer={toggleDrawer}
                    width={366}
                    zIndex={popover_zindex.RUN_PANEL}
                >
                    {content}
                </Drawer>
                {!is_desktop && <MobileDrawerFooter />}
            </div>
            <SelfExclusion onRunButtonClick={onRunButtonClick} />
            <StatisticsInfoModal
                is_mobile={!is_desktop}
                is_statistics_info_modal_open={is_statistics_info_modal_open}
                toggleStatisticsInfoModal={toggleStatisticsInfoModal}
            />
        </>
    );
});

export default RunPanel;
