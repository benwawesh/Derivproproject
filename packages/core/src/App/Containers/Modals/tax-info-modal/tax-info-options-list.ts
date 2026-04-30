import { localize } from '@deriv/translations';

/**
 * Options for justification dropdowns.
 * key: sent to API as-is (English)
 * value: displayed to user (translated at runtime via getters)
 */
export type TJustificationOption = {
    key: string;
    value: string;
    is_other?: boolean;
};

/**
 * Returns No TIN justification options with translated labels.
 * Call from components so labels update when language changes.
 * Uses literal strings in localize() so i18n extraction can find them.
 */
export const getNoTinJustificationOptions = (): TJustificationOption[] => [
    {
        key: 'I am not legally required to obtain a TIN from the specified country.',
        value: localize('I am not legally required to obtain a TIN from the specified country.'),
    },
    {
        key: 'I am not required to disclose a TIN under the laws of the specified country.',
        value: localize('I am not required to disclose a TIN under the laws of the specified country.'),
    },
    {
        key: 'The specified country does not issue TINs to its residents.',
        value: localize('The specified country does not issue TINs to its residents.'),
    },
    {
        key: 'other',
        value: localize('I am otherwise unable to obtain a TIN or equivalent, and will provide further explanation.'),
        is_other: true,
    },
];

/**
 * Returns tax residence justification options with translated labels.
 * Call from components so labels update when language changes.
 * Uses literal strings in localize() so i18n extraction can find them.
 */
export const getTaxResidenceJustificationOptions = (): TJustificationOption[] => [
    {
        key: 'I am temporarily living abroad (assignment/secondment/extended stay) and expect to return',
        value: localize('I am temporarily living abroad (assignment/secondment/extended stay) and expect to return'),
    },
    {
        key: 'I recently moved and my tax residence is in transition',
        value: localize('I recently moved and my tax residence is in transition'),
    },
    {
        key: 'I am tax resident in more than one country',
        value: localize('I am tax resident in more than one country'),
    },
    {
        key: 'I live in one country but work primarily in another (cross-border/rotational work)',
        value: localize('I live in one country but work primarily in another (cross-border/rotational work)'),
    },
    {
        key: 'I am a student/trainee abroad and remain tax resident elsewhere',
        value: localize('I am a student/trainee abroad and remain tax resident elsewhere'),
    },
    {
        key: 'I am posted overseas by my employer/government and remain tax resident in my home country',
        value: localize('I am posted overseas by my employer/government and remain tax resident in my home country'),
    },
    {
        key: 'I am subject to taxation based on citizenship or similar rules (e.g., US citizen)',
        value: localize('I am subject to taxation based on citizenship or similar rules (e.g., US citizen)'),
    },
    {
        key: 'other',
        value: localize('Other'),
        is_other: true,
    },
];

/** Static options for key lookup (e.g. resolveJustificationKey). Keys only; value is English default. */
export const NO_TIN_JUSTIFICATION_OPTIONS: TJustificationOption[] = [
    { key: 'I am not legally required to obtain a TIN from the specified country.', value: '' },
    { key: 'I am not required to disclose a TIN under the laws of the specified country.', value: '' },
    { key: 'The specified country does not issue TINs to its residents.', value: '' },
    { key: 'other', value: '', is_other: true },
];

/** Static options for key lookup (e.g. resolveJustificationKey). Keys only; value is English default. */
export const TAX_RESIDENCE_JUSTIFICATION_OPTIONS: TJustificationOption[] = [
    { key: 'I am temporarily living abroad (assignment/secondment/extended stay) and expect to return', value: '' },
    { key: 'I recently moved and my tax residence is in transition', value: '' },
    { key: 'I am tax resident in more than one country', value: '' },
    { key: 'I live in one country but work primarily in another (cross-border/rotational work)', value: '' },
    { key: 'I am a student/trainee abroad and remain tax resident elsewhere', value: '' },
    { key: 'I am posted overseas by my employer/government and remain tax resident in my home country', value: '' },
    { key: 'I am subject to taxation based on citizenship or similar rules (e.g., US citizen)', value: '' },
    { key: 'other', value: '', is_other: true },
];
