export const state = {
  recipes: [],
  fetchedAt: null,
  recipeLookup: new Map(),
  showDeveloperDetails: false,
  sourceFilters: {
    disabled: new Set(),
    options: []
  },
  sourceCategoryFilters: {
    disabled: new Set(),
    options: [],
    searchTerm: "",
    showAll: false
  }
};

export const VIEW_MODE_STORAGE_KEY = "ss13-barmen-ui:view-mode";
export const SOURCE_FILTER_STORAGE_KEY = "ss13-barmen-ui:disabled-sources";
export const SOURCE_CATEGORY_FILTER_STORAGE_KEY = "ss13-barmen-ui:disabled-source-categories";
export const SOURCE_CATEGORY_VISIBLE_LIMIT = 18;
export const DISPENSER_TIERS = new Set(["base", "upgrade1", "upgrade2", "upgrade3", "upgrade4", "emag"]);
export const SOURCE_CATEGORY_DEFINITIONS = {
  dispenser: { key: "dispenser", label: "Dispenser" },
  supply: { key: "supply", label: "Supply Pack" },
  vendor: { key: "vendor", label: "Vendor (Bottle)" },
  other: { key: "other", label: "Other Sources" }
};
export const SOURCE_CATEGORY_ORDER = ["dispenser", "supply", "vendor", "other"];
