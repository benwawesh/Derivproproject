import { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation, withRouter } from 'react-router-dom';

import { Button } from '@deriv/components';
import { useGrowthbookGetFeatureValue } from '@deriv/hooks';
import { routes } from '@deriv/shared';
import { Localize } from '@deriv/translations';
import { Callback } from '@deriv-com/auth-client';

import AccessDeniedScreen from './AccessDeniedScreen';

const saveTokensAndRedirect = (tokens: Record<string, string>, redirect_to: string) => {
    localStorage.setItem('config.tokens', JSON.stringify(tokens));
    if (tokens.token1) localStorage.setItem('config.account1', tokens.token1);
    if (tokens.acct1) {
        localStorage.setItem('active_loginid', tokens.acct1);
        if (/^(CR|MF|VRTC)\d/.test(tokens.acct1)) sessionStorage.setItem('active_loginid', tokens.acct1);
        if (/^(CRW|MFW|VRW)\d/.test(tokens.acct1)) sessionStorage.setItem('active_wallet_loginid', tokens.acct1);
    }
    localStorage.removeItem('config.app_id');
    window.location.replace(redirect_to);
};

const CallbackPage = () => {
    const history = useHistory();
    const location = useLocation();
    const [dpa_error, setDpaError] = useState(false);

    const search_params = new URLSearchParams(location.search);
    const code = search_params.get('code');
    const acct1 = search_params.get('acct1');

    // Capture at mount time so re-renders don't change the mode
    const is_legacy_oauth = useRef(!!acct1);
    const is_dpa_pkce = useRef(!!(code && sessionStorage.getItem('dpa_pkce_verifier')));

    const has_access_denied_error = location.search.includes('access_denied');

    const [isDuplicateLoginEnabled] = useGrowthbookGetFeatureValue({
        featureFlag: 'duplicate-login',
    });

    // Option A fallback: old OAuth sent tokens directly in URL params
    useEffect(() => {
        if (!is_legacy_oauth.current) return;
        const tokens: Record<string, string> = {};
        search_params.forEach((value, key) => {
            tokens[key] = value;
        });
        const redirect_to = sessionStorage.getItem('redirect_url') || routes.traders_hub;
        sessionStorage.removeItem('redirect_url');
        saveTokensAndRedirect(tokens, redirect_to);
    }, []);

    // Option B: custom PKCE exchange with auth.deriv.com
    useEffect(() => {
        if (!is_dpa_pkce.current) return;

        const verifier = sessionStorage.getItem('dpa_pkce_verifier') ?? '';
        const redirect_to = sessionStorage.getItem('dpa_pkce_redirect') || routes.traders_hub;
        sessionStorage.removeItem('dpa_pkce_verifier');
        sessionStorage.removeItem('dpa_pkce_state');
        sessionStorage.removeItem('dpa_pkce_redirect');

        (async () => {
            try {
                // Exchange auth code for Bearer token at auth.deriv.com
                const token_res = await fetch('https://auth.deriv.com/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        client_id: '32MDp7xsUb63kYmgE8GTu',
                        code: code ?? '',
                        code_verifier: verifier,
                        redirect_uri: `${window.location.origin}/callback`,
                    }),
                });
                const { access_token } = await token_res.json();
                if (!access_token) throw new Error('No access_token in response');

                // Exchange Bearer token for legacy session tokens
                const legacy_res = await fetch('https://oauth.deriv.com/oauth2/legacy/tokens', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${access_token}` },
                });
                const tokens = await legacy_res.json();
                if (!tokens.acct1) throw new Error('No legacy tokens in response');

                saveTokensAndRedirect(tokens, redirect_to);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('DPA OIDC callback error:', err);
                setDpaError(true);
            }
        })();
    }, []);

    // Show loading / error for our custom DPA flows
    if (is_legacy_oauth.current || is_dpa_pkce.current) {
        if (dpa_error) {
            return (
                <Button
                    onClick={() => {
                        history.push('/');
                        window.location.reload();
                    }}
                    secondary
                    is_circular
                >
                    <Localize i18n_default_text='Try again' />
                </Button>
            );
        }
        return null;
    }

    if (isDuplicateLoginEnabled && has_access_denied_error) {
        return <AccessDeniedScreen />;
    }

    return (
        <Callback
            onSignInSuccess={(tokens: Record<string, string>) => {
                localStorage.setItem('config.tokens', JSON.stringify(tokens));
                localStorage.setItem('config.account1', tokens.token1);
                localStorage.setItem('active_loginid', tokens.acct1);
                localStorage.removeItem('config.app_id');
                if (!sessionStorage.getItem('active_loginid') && /^(CR|MF|VRTC)\d/.test(tokens.acct1)) {
                    sessionStorage.setItem('active_loginid', tokens.acct1);
                }
                if (!sessionStorage.getItem('active_wallet_loginid') && /^(CRW|MFW|VRW)\d/.test(tokens.acct1)) {
                    sessionStorage.setItem('active_wallet_loginid', tokens.acct1);
                }
                const redirectTo = sessionStorage.getItem('tradershub_redirect_to');
                const postLoginRedirectUri = localStorage.getItem('config.post_login_redirect_uri') || '';
                const params = new URLSearchParams(postLoginRedirectUri);
                const containsAccount = params.get('account');

                if (redirectTo || (postLoginRedirectUri && !!containsAccount)) {
                    const params = new URLSearchParams(redirectTo || postLoginRedirectUri);
                    const queryAccount = params.get('account');
                    let matchingLoginId: string | undefined,
                        matchingToken: string | undefined,
                        matchingWalletLoginId: string | undefined;
                    if (queryAccount?.toLowerCase() !== 'demo') {
                        Object.keys(tokens).find(key => {
                            if (
                                key.startsWith('cur') &&
                                tokens[key].toLocaleLowerCase() === queryAccount?.toLocaleLowerCase()
                            ) {
                                const sequence = key.replace('cur', '');
                                const isNotCRWallet =
                                    tokens[`acct${sequence}`]?.startsWith('CR') &&
                                    !tokens[`acct${sequence}`]?.startsWith('CRW');
                                const isCRWallet = tokens[`acct${sequence}`]?.startsWith('CRW');
                                const isNotMFWallet =
                                    tokens[`acct${sequence}`]?.startsWith('MF') &&
                                    !tokens[`acct${sequence}`]?.startsWith('MFW');
                                const isMFWallet = tokens[`acct${sequence}`]?.startsWith('MFW');
                                if (isNotCRWallet || isNotMFWallet) {
                                    if (!matchingLoginId && !matchingToken) {
                                        matchingLoginId = tokens[`acct${sequence}`];
                                        matchingToken = tokens[`token${sequence}`];
                                    }
                                }
                                if (isCRWallet || isMFWallet) {
                                    matchingWalletLoginId = tokens[`acct${sequence}`];
                                }
                            }
                        });
                    } else {
                        Object.keys(tokens).find(key => {
                            if (key.startsWith('cur') && tokens[key] === 'USD') {
                                const sequence = key.replace('cur', '');
                                const isDemo = tokens[`acct${sequence}`]?.startsWith('VRTC');
                                const isWalletDemo = tokens[`acct${sequence}`]?.startsWith('VRW');
                                if (isDemo) {
                                    matchingLoginId = tokens[`acct${sequence}`];
                                    matchingToken = tokens[`token${sequence}`];
                                }
                                if (isWalletDemo) {
                                    matchingWalletLoginId = tokens[`acct${sequence}`];
                                }
                            }
                        });
                    }
                    if (matchingLoginId && matchingToken) {
                        sessionStorage.setItem('active_loginid', matchingLoginId);
                        localStorage.setItem('config.account1', matchingToken);
                        localStorage.setItem('active_loginid', matchingLoginId);
                    } else if (!matchingWalletLoginId && !matchingToken && !tokens.acct1.startsWith('CRW')) {
                        if (tokens.acct1.startsWith('VR')) {
                            const url = new URL(window.location.href);
                            url.searchParams.set('account', 'demo');
                            window.history.replaceState({}, '', url.toString());
                        } else {
                            const url = new URL(window.location.href);
                            url.searchParams.set('account', tokens.cur1.toString());
                            window.history.replaceState({}, '', url.toString());
                        }
                        sessionStorage.setItem('active_loginid', tokens.acct1);
                        localStorage.setItem('config.account1', tokens.token1);
                        localStorage.setItem('active_loginid', tokens.acct1);
                    }
                    if (matchingWalletLoginId && matchingToken) {
                        sessionStorage.setItem('active_wallet_loginid', matchingWalletLoginId);
                    }

                    sessionStorage.removeItem('tradershub_redirect_to');
                    window.history.replaceState({}, '', redirectTo || postLoginRedirectUri);
                    window.location.href = redirectTo || postLoginRedirectUri;
                } else {
                    const postLoginRedirectUri = localStorage.getItem('config.post_login_redirect_uri');
                    if (postLoginRedirectUri) {
                        window.history.replaceState({}, '', postLoginRedirectUri);
                        window.location.href = postLoginRedirectUri;
                    } else {
                        window.history.replaceState({}, '', routes.traders_hub);
                        window.location.href = routes.traders_hub;
                    }
                }
            }}
            renderReturnButton={() => {
                return (
                    <Button
                        onClick={() => {
                            history.push('/');
                            window.location.reload();
                        }}
                        secondary
                        is_circular
                    >
                        <Localize i18n_default_text='Try again' />
                    </Button>
                );
            }}
        />
    );
};

export default withRouter(CallbackPage);
