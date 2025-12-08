import type { SourceCategoryDefinition, SourceCategoryKey } from '@/types';

export const VIEW_MODE_STORAGE_KEY = 'ss13-barmen-ui:view-mode';
export const SOURCE_FILTER_STORAGE_KEY = 'ss13-barmen-ui:disabled-sources';
export const SOURCE_CATEGORY_FILTER_STORAGE_KEY = 'ss13-barmen-ui:disabled-source-categories';
export const SOURCE_CATEGORY_VISIBLE_LIMIT = 18;
export const RENDER_BATCH_SIZE = 30;

export const DISPENSER_TIERS = new Set(['base', 'upgrade1', 'upgrade2', 'upgrade3', 'upgrade4', 'emag']);

export const SOURCE_CATEGORY_DEFINITIONS: Record<SourceCategoryKey, SourceCategoryDefinition> = {
  dispenser: { key: 'dispenser', label: 'Dispenser' },
  supply: { key: 'supply', label: 'Supply Pack' },
  vendor: { key: 'vendor', label: 'Vendor (Bottle)' },
  other: { key: 'other', label: 'Other Sources' },
};

export const SOURCE_CATEGORY_ORDER: SourceCategoryKey[] = ['dispenser', 'supply', 'vendor', 'other'];
