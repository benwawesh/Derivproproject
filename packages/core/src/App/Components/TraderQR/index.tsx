import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useHistory } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import './trader-qr.scss';

const IS_PROD = /derivprofundedacademy\.com/.test(window.location.hostname);
const BASE = IS_PROD ? 'https://api.derivprofundedacademy.com/api' : 'http://localhost:8011/api';
// On dev, QR code must point to the LAN IP so the phone can reach the backend
const QR_API_BASE = IS_PROD ? 'https://api.derivprofundedacademy.com/api' : 'http://192.168.100.24:8011/api';

type TTraderQRProps = {
    qr_token: string;
    display_name: string;
    masked_id: string;
    avatar?: string | null;
    account_type: string;
    on_close: () => void;
};

const ACCOUNT_LABEL: Record<string, string> = {
    real: 'Real Account',
    funded: 'Funded Account',
    marketing: 'Marketing Account',
};

const TraderQRModal = ({ qr_token, display_name, masked_id, avatar, account_type, on_close }: TTraderQRProps) => {
    // QR points to Django qr-open endpoint on LAN IP so phone can reach it.
    // Backend marks last_scanned_at then 302-redirects phone to the report page.
    const report_url = `${QR_API_BASE}/trader-profiles/${qr_token}/qr-open/`;
    const overlay_ref = useRef<HTMLDivElement>(null);
    const history = useHistory();
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') on_close();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [on_close]);

    // Poll for scan event — when phone scans the QR and loads the report page,
    // the backend records a timestamp. We detect it here and redirect the desktop.
    useEffect(() => {
        const opened_at = new Date().toISOString();
        let stopped = false;

        const poll = async () => {
            try {
                const r = await fetch(`${BASE}/trader-profiles/${qr_token}/scan/`);
                const data = await r.json();
                if (data.last_scanned_at && data.last_scanned_at > opened_at) {
                    // Scan happened after the modal opened — navigate desktop to report page
                    on_close();
                    history.push(`/trader/${qr_token}`);
                    return;
                }
            } catch {
                /* ignore */
            }
            if (!stopped) setTimeout(poll, 2000);
        };

        // Start polling after a short delay to avoid false positives from stale timestamps
        const timer = setTimeout(() => {
            setScanning(true);
            poll();
        }, 500);
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [qr_token, history, on_close]);

    const handle_overlay_click = (e: React.MouseEvent) => {
        if (e.target === overlay_ref.current) on_close();
    };

    const handle_copy = () => {
        navigator.clipboard.writeText(report_url).catch(() => {});
    };

    const modal = (
        <div className='tqr-overlay' ref={overlay_ref} onClick={handle_overlay_click}>
            <div className='tqr-modal'>
                <button className='tqr-close' onClick={on_close}>
                    <i className='ti ti-x' />
                </button>

                {/* Trader identity */}
                <div className='tqr-identity'>
                    {avatar ? (
                        <img src={avatar} alt={display_name} className='tqr-avatar' />
                    ) : (
                        <div className='tqr-avatar tqr-avatar--initials'>{display_name.charAt(0).toUpperCase()}</div>
                    )}
                    <div className='tqr-info'>
                        <h4 className='tqr-name'>{display_name}</h4>
                        <span className='tqr-id'>{masked_id}</span>
                        <span className={`tqr-badge tqr-badge--${account_type}`}>
                            {ACCOUNT_LABEL[account_type] ?? account_type}
                        </span>
                    </div>
                </div>

                {/* QR code */}
                <div className='tqr-code-wrap'>
                    <QRCodeSVG
                        value={report_url}
                        size={220}
                        bgColor='#ffffff'
                        fgColor='#1d1e24'
                        level='M'
                        includeMargin
                    />
                </div>

                <p className='tqr-hint'>
                    {scanning ? (
                        <>
                            <span className='tqr-pulse' /> Waiting for scan… page will open automatically
                        </>
                    ) : (
                        <>
                            <i className='ti ti-scan' /> Scan to view full trade report
                        </>
                    )}
                </p>

                {/* Copy link */}
                <button className='tqr-copy-btn' onClick={handle_copy}>
                    <i className='ti ti-link' /> Copy Report Link
                </button>
            </div>
        </div>
    );

    // Render via portal to document.body so position:fixed works correctly
    // regardless of CSS transforms on parent scroll containers
    return ReactDOM.createPortal(modal, document.body);
};

export default TraderQRModal;
