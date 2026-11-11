/**
 * Column counts of multi-column AntD `Descriptions` ("label: value" grids), so every detail
 * card wraps the same way: one column on phones, two on tablets, three from `lg`.
 */
export const DESCRIPTION_COLUMNS = { xs: 1, sm: 2, lg: 3 } as const;

/** Half-width cards and dialogs: never more than two columns. */
export const DESCRIPTION_COLUMNS_NARROW = { xs: 1, sm: 2 } as const;

/** Single-column breakdowns (money summaries, drawers): one label/value line each. */
export const DESCRIPTION_COLUMNS_SINGLE = 1;
