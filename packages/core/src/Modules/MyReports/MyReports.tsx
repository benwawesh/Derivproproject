import React, { useState, useMemo } from 'react';
import { observer, useStore } from '@deriv/stores';
import MyReportsDashboard from './MyReportsDashboard';
import './MyReports.scss';

type AccountType = 'funded' | 'real';

const MyReports = observer(() => {
    const { client } = useStore();
    const { loginid, accounts } = client as any;
    const [accountType, setAccountType] = useState<AccountType>('funded');

    // Always use the real (CR/MF) account ID — never demo (VRTC) or funded overlay
    // This ensures trades are always stored/retrieved under a single stable ID
    const realLoginid = useMemo(() => {
        const all = Object.keys(accounts || {});
        const real = all.find((id: string) => !id.startsWith('VRT') && !id.startsWith('vrt'));
        return real || loginid;
    }, [accounts, loginid]);

    return (
        <div className='my-reports__container'>
            <div className='my-reports__header'>
                <h1 className='my-reports__title'>My Reports</h1>
                <div className='my-reports__account-selector'>
                    <button
                        className={`my-reports__tab${accountType === 'funded' ? ' my-reports__tab--active' : ''}`}
                        onClick={() => setAccountType('funded')}
                    >
                        Funded Account Analytics
                    </button>
                    <button
                        className={`my-reports__tab${accountType === 'real' ? ' my-reports__tab--active' : ''}`}
                        onClick={() => setAccountType('real')}
                    >
                        Real Account Analytics
                    </button>
                </div>
            </div>
            <MyReportsDashboard accountType={accountType} loginid={realLoginid} />
        </div>
    );
});

export default MyReports;
