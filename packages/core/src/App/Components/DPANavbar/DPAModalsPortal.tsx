import React from 'react';
import { observer, useStore } from '@deriv/stores';

import CurrencySelectionModal from 'App/Containers/CurrencySelectionModal';
import NewVersionNotification from 'App/Containers/new-version-notification.jsx';
import RealAccountSignup from 'App/Containers/RealAccountSignup';
import SetAccountCurrencyModal from 'App/Containers/SetAccountCurrencyModal';

/**
 * Renders modals that were previously inside the Deriv header.
 * Needed because we hide `.header { display: none }` to remove the gap,
 * but the modals must still function.
 */
const DPAModalsPortal = observer(() => {
    const { ui, traders_hub, notifications } = useStore();
    const { is_real_acc_signup_on } = ui;
    const { modal_data } = traders_hub;
    const { addNotificationMessage, client_notifications, removeNotificationMessage } = notifications;

    const addUpdateNotification = () => addNotificationMessage(client_notifications?.new_version_available);
    const removeUpdateNotification = React.useCallback(
        () => removeNotificationMessage({ key: 'new_version_available' }),
        [removeNotificationMessage]
    );

    React.useEffect(() => {
        document.addEventListener('IgnorePWAUpdate', removeUpdateNotification);
        return () => document.removeEventListener('IgnorePWAUpdate', removeUpdateNotification);
    }, [removeUpdateNotification]);

    return (
        <>
            {is_real_acc_signup_on && <RealAccountSignup />}
            <SetAccountCurrencyModal />
            <CurrencySelectionModal is_visible={modal_data.active_modal === 'currency_selection'} />
            <NewVersionNotification onUpdate={addUpdateNotification} />
        </>
    );
});

export default DPAModalsPortal;
