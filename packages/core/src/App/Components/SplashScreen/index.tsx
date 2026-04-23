import React, { useEffect, useState } from 'react';
import './splash-screen.scss';

const LOADING_MESSAGES = [
    'Connecting to markets...',
    'Loading your account...',
    'Fetching market data...',
    'Preparing trading tools...',
    'Almost ready...',
];

type TSplashScreenProps = {
    onComplete: () => void;
};

const SplashScreen = ({ onComplete }: TSplashScreenProps) => {
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState(LOADING_MESSAGES[0]);
    const [fade_out, setFadeOut] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                const next = prev + Math.random() * 12 + 3;
                const clamped = Math.min(next, 100);

                const msg_index = Math.floor((clamped / 100) * LOADING_MESSAGES.length);
                setMessage(LOADING_MESSAGES[Math.min(msg_index, LOADING_MESSAGES.length - 1)]);

                if (clamped >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setFadeOut(true);
                        setTimeout(onComplete, 400);
                    }, 300);
                }
                return clamped;
            });
        }, 250);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <div className={`dpa-splash${fade_out ? ' dpa-splash--fadeout' : ''}`}>
            <div className='dpa-splash__content'>
                <div className='dpa-splash__logo'>
                    <div className='dpa-splash__logo-icon'>D</div>
                    <div className='dpa-splash__logo-text'>
                        <span className='dpa-splash__logo-name'>DerivPro</span>
                        <span className='dpa-splash__logo-academy'>Academy</span>
                    </div>
                </div>

                <div className='dpa-splash__loader'>
                    <div className='dpa-splash__loader-track'>
                        <div className='dpa-splash__loader-fill' style={{ width: `${progress}%` }} />
                    </div>
                    <div className='dpa-splash__loader-info'>
                        <span className='dpa-splash__loader-message'>{message}</span>
                        <span className='dpa-splash__loader-percent'>{Math.floor(progress)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
