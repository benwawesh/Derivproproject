import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MarketAnalysisTool } from './MarketAnalysisTool';
import './FloatingAnalysisManager.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FWindow {
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    zIndex: number;
}

let windowCounter = 0;
let topZ = 3000;

function makeWindow(): FWindow {
    windowCounter++;
    topZ++;
    const offset = ((windowCounter - 1) % 6) * 28;
    return {
        id: `faw-${windowCounter}`,
        title: windowCounter === 1 ? 'Analysis Tool' : `Analysis Tool ${windowCounter}`,
        x: Math.min(80 + offset, window.innerWidth - 500),
        y: Math.min(80 + offset, window.innerHeight - 400),
        width: Math.min(window.innerWidth - 120, 980),
        height: Math.min(window.innerHeight - 140, 660),
        minimized: false,
        zIndex: topZ,
    };
}

// ─── Single floating window ───────────────────────────────────────────────────

const FloatingWindow: React.FC<{
    win: FWindow;
    onClose: () => void;
    onFocus: () => void;
    onMinimize: () => void;
    onUpdate: (updates: Partial<FWindow>) => void;
}> = ({ win, onClose, onFocus, onMinimize, onUpdate }) => {
    const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);

    const handleTitleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest('.fam-window__btn')) return;
            e.preventDefault();
            onFocus();
            dragRef.current = { sx: e.clientX, sy: e.clientY, ox: win.x, oy: win.y };

            const move = (me: MouseEvent) => {
                if (!dragRef.current) return;
                const nx = Math.max(0, dragRef.current.ox + me.clientX - dragRef.current.sx);
                const ny = Math.max(0, dragRef.current.oy + me.clientY - dragRef.current.sy);
                onUpdate({ x: nx, y: ny });
            };
            const up = () => {
                dragRef.current = null;
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        },
        [win.x, win.y, onFocus, onUpdate]
    );

    const handleResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: win.width, oh: win.height };

            const move = (me: MouseEvent) => {
                if (!resizeRef.current) return;
                const nw = Math.max(420, resizeRef.current.ow + me.clientX - resizeRef.current.sx);
                const nh = Math.max(320, resizeRef.current.oh + me.clientY - resizeRef.current.sy);
                onUpdate({ width: nw, height: nh });
            };
            const up = () => {
                resizeRef.current = null;
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        },
        [win.width, win.height, onUpdate]
    );

    if (win.minimized) return null;

    return (
        <div
            className='fam-window'
            style={{ left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
            onMouseDown={onFocus}
        >
            <div className='fam-window__titlebar' onMouseDown={handleTitleMouseDown}>
                <div className='fam-window__title-group'>
                    <span className='fam-window__icon'>📊</span>
                    <span className='fam-window__title'>{win.title}</span>
                </div>
                <div className='fam-window__controls'>
                    <button className='fam-window__btn fam-window__btn--min' onClick={onMinimize} title='Minimise'>
                        &#8722;
                    </button>
                    <button className='fam-window__btn fam-window__btn--close' onClick={onClose} title='Close'>
                        &#215;
                    </button>
                </div>
            </div>
            <div className='fam-window__body'>
                <MarketAnalysisTool />
            </div>
            <div className='fam-window__resize-handle' onMouseDown={handleResizeMouseDown} />
        </div>
    );
};

// ─── Manager ─────────────────────────────────────────────────────────────────

const FloatingAnalysisManager: React.FC = () => {
    const [windows, setWindows] = useState<FWindow[]>([]);

    const openWindow = useCallback(() => {
        setWindows(prev => [...prev, makeWindow()]);
    }, []);

    const closeWindow = useCallback((id: string) => {
        setWindows(prev => prev.filter(w => w.id !== id));
    }, []);

    const focusWindow = useCallback((id: string) => {
        topZ++;
        const z = topZ;
        setWindows(prev => prev.map(w => (w.id === id ? { ...w, zIndex: z, minimized: false } : w)));
    }, []);

    const minimizeWindow = useCallback((id: string) => {
        setWindows(prev => prev.map(w => (w.id === id ? { ...w, minimized: !w.minimized } : w)));
    }, []);

    const updateWindow = useCallback((id: string, updates: Partial<FWindow>) => {
        setWindows(prev => prev.map(w => (w.id === id ? { ...w, ...updates } : w)));
    }, []);

    // Custom event so other parts of the app can open a new floating window
    useEffect(() => {
        const handler = () => openWindow();
        window.addEventListener('dpa:open-analysis', handler);
        return () => window.removeEventListener('dpa:open-analysis', handler);
    }, [openWindow]);

    const hasWindows = windows.length > 0;

    return (
        <>
            {windows.map(win => (
                <FloatingWindow
                    key={win.id}
                    win={win}
                    onClose={() => closeWindow(win.id)}
                    onFocus={() => focusWindow(win.id)}
                    onMinimize={() => minimizeWindow(win.id)}
                    onUpdate={updates => updateWindow(win.id, updates)}
                />
            ))}

            {hasWindows ? (
                /* ── Taskbar (visible when ≥1 window is open) ── */
                <div className='fam-taskbar'>
                    <button className='fam-taskbar__new-btn' onClick={openWindow} title='Open new Analysis window'>
                        📊&nbsp;+
                    </button>
                    <div className='fam-taskbar__sep' />
                    {windows.map(win => (
                        <button
                            key={win.id}
                            className={`fam-taskbar__tab${!win.minimized ? ' fam-taskbar__tab--open' : ''}`}
                            onClick={() => (win.minimized ? focusWindow(win.id) : minimizeWindow(win.id))}
                        >
                            <span className='fam-taskbar__tab-label'>📊 {win.title}</span>
                            <span
                                className='fam-taskbar__tab-close'
                                role='button'
                                tabIndex={-1}
                                onClick={e => {
                                    e.stopPropagation();
                                    closeWindow(win.id);
                                }}
                                title='Close'
                            >
                                &#215;
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                /* ── FAB (shown when no windows are open) ── */
                <button className='fam-fab' onClick={openWindow} title='Open Analysis Tool'>
                    📊
                </button>
            )}
        </>
    );
};

export default FloatingAnalysisManager;
