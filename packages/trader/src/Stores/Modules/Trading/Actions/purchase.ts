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
        console.warn('[DPA purchase.ts] BLOCKING WS.buy — DPA mode active');
        // Return a never-resolving promise to fully block the buy.
        // The trade-store intercept above this call already handles execution + balance update.
        return new Promise(() => {}) as any;
    }
    return WS.buy({
        proposal_id,
        price,
        ...(passthrough && { passthrough }),
    });
};
