const isTmbEnabled = async () => {
    // On localhost, always use the old OAuth flow (redirectToLogin with app_id 36300)
    // The OIDC flow (app_id 61554) is blocked with 403 on localhost
    if (window.location.hostname === 'localhost') {
        return true;
    }

    const search = window.location.search;
    let platform;
    if (search) {
        const url_params = new URLSearchParams(search);
        platform = url_params.get('platform');
    }
    // add deriv and impersonation check
    const triggerImplicitFlow = platform === 'derivgo' || sessionStorage.getItem('is_disable_tmb') === 'true';

    if (triggerImplicitFlow) {
        sessionStorage.setItem('is_disable_tmb', 'true');
    }

    const storedValue = localStorage.getItem('is_tmb_enabled');

    return storedValue !== null ? storedValue === 'true' : !triggerImplicitFlow && true;
};

export default isTmbEnabled;
