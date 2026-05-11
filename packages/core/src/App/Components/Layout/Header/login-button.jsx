import Cookies from 'js-cookie';
import PropTypes from 'prop-types';

import { Button } from '@deriv/components';
import { useTMB } from '@deriv/hooks';
import { getDomainUrl, isStaging, redirectToLogin } from '@deriv/shared';
import { getLanguage, localize } from '@deriv/translations';
import { requestOidcAuthentication } from '@deriv-com/auth-client';

const LoginButton = ({ className }) => {
    const is_deriv_com = /deriv\.(com)/.test(window.location.hostname) || /localhost/.test(window.location.hostname);
    const is_derivprofundedacademy = /derivprofundedacademy\.com/.test(window.location.hostname);
    const has_wallet_cookie = Cookies.get('wallet_account');
    const { isTmbEnabled } = useTMB();

    return (
        <Button
            id='dt_login_button'
            className={className}
            has_effect
            text={localize('Log in')}
            onClick={async () => {
                if (has_wallet_cookie) {
                    if (isStaging()) {
                        location.href = `https://staging-hub.${getDomainUrl()}/tradershub/login`;
                    } else {
                        location.href = `https://hub.${getDomainUrl()}/tradershub/login`;
                    }
                }
                if (is_derivprofundedacademy) {
                    try {
                        const verifier_bytes = new Uint8Array(32);
                        crypto.getRandomValues(verifier_bytes);
                        const verifier = btoa(String.fromCharCode(...verifier_bytes))
                            .replace(/\+/g, '-')
                            .replace(/\//g, '_')
                            .replace(/=/g, '');
                        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
                        const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
                            .replace(/\+/g, '-')
                            .replace(/\//g, '_')
                            .replace(/=/g, '');
                        const state_bytes = new Uint8Array(16);
                        crypto.getRandomValues(state_bytes);
                        const state = btoa(String.fromCharCode(...state_bytes))
                            .replace(/\+/g, '-')
                            .replace(/\//g, '_')
                            .replace(/=/g, '');
                        sessionStorage.setItem('dpa_pkce_verifier', verifier);
                        sessionStorage.setItem('dpa_pkce_state', state);
                        sessionStorage.setItem('dpa_pkce_redirect', window.location.href);
                        window.location.href = `https://auth.deriv.com/oauth2/auth?${new URLSearchParams({
                            response_type: 'code',
                            client_id: '32MDp7xsUb63kYmgE8GTu',
                            redirect_uri: `${window.location.origin}/callback`,
                            scope: 'trade account_manage',
                            code_challenge: challenge,
                            code_challenge_method: 'S256',
                            state,
                        })}`;
                    } catch (err) {
                        // eslint-disable-next-line no-console
                        console.error(err);
                        sessionStorage.setItem('redirect_url', window.location.href);
                        window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=133890&l=${getLanguage()}&brand=deriv`;
                    }
                    return;
                }
                const is_tmb_enabled = await isTmbEnabled();
                if (is_deriv_com && !is_tmb_enabled) {
                    try {
                        await requestOidcAuthentication({
                            redirectCallbackUri: `${window.location.origin}/callback`,
                            postLoginRedirectUri: window.location.href,
                        }).catch(err => {
                            // eslint-disable-next-line no-console
                            console.error(err);
                        });
                    } catch (err) {
                        // eslint-disable-next-line no-console
                        console.error(err);
                    }
                }
                window.LiveChatWidget?.call('hide');
                redirectToLogin(false, getLanguage());
            }}
            tertiary
        />
    );
};

LoginButton.propTypes = {
    className: PropTypes.string,
};

export { LoginButton };
