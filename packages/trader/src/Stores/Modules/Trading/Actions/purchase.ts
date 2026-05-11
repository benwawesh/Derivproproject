import { Buy, BuyContractResponse, BuyContractRequest } from '@deriv/api-types';
import { WS } from '@deriv/shared';

type TResponse = BuyContractResponse & {
    echo_req: Buy;
    error?: {
        code: string;
        message: string;
        details?: BuyContractResponse['buy'] & { field: string };
    };
};

export const processPurchase = async (
    proposal_id: string,
    price: string | number,
    passthrough?: BuyContractRequest['passthrough']
): Promise<TResponse> => {
    const w = window as any;
    const is_dpa_funded = w.__dpa_funded_active === true;
    const is_dpa_marketing = !is_dpa_funded && w.__dpa_marketing_active === true && !!w.__dpa_marketing_account;
    console.warn(
        '[DPA purchase.ts] processPurchase called | funded:',
        is_dpa_funded,
        '| marketing:',
        is_dpa_marketing,
        '| __dpa_marketing_active:',
        w.__dpa_marketing_active,
        '| __dpa_funded_active:',
        w.__dpa_funded_active
    );
    if (is_dpa_funded || is_dpa_marketing) {
        const execute = (w as any).__dpa_execute_dtrader_buy;
        if (typeof execute === 'function') {
            const result = execute(proposal_id, price);
            if (result) return Promise.resolve(result) as any;
        }
        // Intercept not ready (params not captured yet) — return a silent error so
        // D-Trader calls enablePurchase() and the user can retry immediately.
        // 'InvalidToken' code suppresses the error toast in trade-store.
        return Promise.resolve({
            error: { code: 'InvalidToken', message: 'DPA: trade interceptor not ready, please try again.' },
            msg_type: 'buy',
            echo_req: { buy: proposal_id, price: Number(price) },
        }) as any;
    }
    return WS.buy({
        proposal_id,
        price,
        ...(passthrough && { passthrough }),
    });
};
