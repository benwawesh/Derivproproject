import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '@deriv/shared';

// Injected into AppContent — watches for navigation to /bot and auto-loads XML
const BotXmlLoader = () => {
    const location = useLocation();
    const toast_ref = useRef<HTMLDivElement | null>(null);

    const showToast = (msg: string, color = '#333') => {
        if (toast_ref.current) toast_ref.current.remove();
        const el = document.createElement('div');
        el.textContent = msg;
        Object.assign(el.style, {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: color,
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: '99999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        });
        document.body.appendChild(el);
        toast_ref.current = el;
        if (color !== '#333') setTimeout(() => el.remove(), 4000);
    };

    useEffect(() => {
        if (location.pathname !== routes.bot) return;

        const xml_url = localStorage.getItem('dpa_load_xml');
        if (!xml_url) return;
        localStorage.removeItem('dpa_load_xml');

        showToast('⏳ Loading bot into workspace...');

        let attempts = 0;

        // Navigate directly to bot_builder hash, then also click inner tab if found
        window.location.hash = 'bot_builder';
        const tabInterval = setInterval(() => {
            const tab = Array.from(document.querySelectorAll('[class*="tab"],[class*="Tab"],button'))
                .filter(el => el.textContent?.trim() === 'Bot Builder')
                .find(el => !el.closest('nav') && !el.closest('header')) as HTMLElement | undefined;
            if (tab) {
                tab.click();
                clearInterval(tabInterval);
            }
        }, 300);
        setTimeout(() => clearInterval(tabInterval), 8000);

        const tryInject = async () => {
            attempts++;
            const Blockly = (window as any).Blockly;
            const ws = Blockly?.derivWorkspace;

            // Wait for blocks AND for the workspace SVG to have real viewport dimensions
            const metrics = ws?.getMetrics?.();
            const rendererReady =
                ws?.getRenderer?.()?.getConstants?.() !== null && ws?.getRenderer?.()?.getConstants?.() !== undefined;
            const blocksReady =
                ws &&
                Blockly?.Blocks?.['trade_definition_market'] !== undefined &&
                metrics?.viewWidth > 100 &&
                metrics?.viewHeight > 100 &&
                rendererReady;

            if (!blocksReady) {
                if (attempts < 120) {
                    setTimeout(tryInject, 500);
                } else {
                    showToast('Bot workspace took too long to load. Please refresh and try again.', '#c62828');
                }
                return;
            }

            try {
                const res = await fetch(xml_url);
                if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${res.statusText} — URL: ${xml_url}`);
                const xml_text = await res.text();

                const convertedDom: Element = Blockly.utils?.xml?.textToDom
                    ? Blockly.utils.xml.textToDom(xml_text)
                    : new DOMParser().parseFromString(xml_text, 'text/xml').documentElement;

                // Register stubs for any block types unknown to this DBot version
                Array.from(convertedDom.querySelectorAll('block')).forEach((block: Element) => {
                    const type = block.getAttribute('type');
                    if (type && !Blockly.Blocks[type]) {
                        Blockly.Blocks[type] = {
                            init() {},
                            getConstants() {
                                return {};
                            },
                        };
                    }
                });

                // Load + arrange (matches native DBot behaviour)
                Blockly.Xml.clearWorkspaceAndLoadFromXml(convertedDom, ws);
                ws.cleanUp(0, 56);
                ws.clearUndo();

                window.dispatchEvent(new Event('resize'));

                // If something after the resize moves blocks behind the flyout panel,
                // force them back into view. Checks at 300ms and 700ms to catch late re-renders.
                const ensureVisible = () => {
                    try {
                        const canvas = (ws as any).getCanvas?.();
                        const m = ws.getMetrics?.();
                        if (!canvas || !m) return;
                        const xform = canvas.getAttribute('transform') ?? '';
                        const match = xform.match(/translate\(\s*([^,\s]+)/);
                        const currentX = match ? parseFloat(match[1]) : 0;
                        const flyoutWidth = m.flyoutWidth || m.absoluteLeft || 240;
                        if (currentX < flyoutWidth - 5) {
                            const topBlock = ws.getTopBlocks?.(true)?.[0];
                            const blockY = topBlock?.getRelativeToSurfaceXY?.()?.y ?? 56;
                            const targetY = Math.max(0, blockY * (ws.scale || 0.7) - 10);
                            ws.scrollX = flyoutWidth;
                            ws.scrollY = targetY;
                            ws.translate(flyoutWidth, targetY);
                        }
                    } catch (_) {}
                };

                setTimeout(ensureVisible, 300);
                setTimeout(ensureVisible, 700);

                showToast('✓ Bot loaded! Click Run to start trading.', '#2e7d32');
                console.log('[DPA] Bot XML loaded successfully');
            } catch (e: any) {
                showToast(`Error: ${e.message}`, '#c62828');
                console.error('[DPA] Failed to load bot XML:', e);
            }
        };

        setTimeout(tryInject, 1000);
    }, [location.pathname]);

    return null;
};

export default BotXmlLoader;
