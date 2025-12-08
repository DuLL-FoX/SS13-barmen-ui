import type { IngredientSource, SourceCategoryDefinition, SourceCategoryKey } from '@/types';
import { DISPENSER_TIERS, SOURCE_CATEGORY_DEFINITIONS } from '@/constants';

export function normalizeSourceKey(value: string | null | undefined): string {
  if (!value) {
    return '__none__';
  }
  const trimmed = value.toString().trim();
  if (!trimmed.length) {
    return '__none__';
  }
  return trimmed.toLowerCase();
}

export function sourceDisplayLabel(value: string | null | undefined): string {
  if (!value || !value.toString().trim().length) {
    return 'Unspecified';
  }
  return value.toString().trim();
}

export function deriveSourceCategory(source: IngredientSource | null | undefined): SourceCategoryDefinition {
  if (!source) {
    return SOURCE_CATEGORY_DEFINITIONS.other;
  }

  const tier = (source.tier ?? '').toLowerCase();
  const machineName = (source.machineName ?? '').toLowerCase();
  const machinePath = (source.machinePath ?? '').toLowerCase();
  const tierLabel = (source.tierLabel ?? '').toLowerCase();

  if (tier === 'supply' || source.packCost != null || tierLabel.includes('supply')) {
    return SOURCE_CATEGORY_DEFINITIONS.supply;
  }

  if (
    tier === 'vendor' ||
    machineName.includes('vendor') ||
    machinePath.includes('/vending/') ||
    machineName.includes('boozeomat')
  ) {
    return SOURCE_CATEGORY_DEFINITIONS.vendor;
  }

  if (DISPENSER_TIERS.has(tier)) {
    return SOURCE_CATEGORY_DEFINITIONS.dispenser;
  }

  if (
    machineName.includes('dispenser') ||
    machineName.includes('synth') ||
    machineName.includes('chem') ||
    machinePath.includes('chem_dispenser') ||
    machinePath.includes('reagent_dispenser')
  ) {
    return SOURCE_CATEGORY_DEFINITIONS.dispenser;
  }

  return SOURCE_CATEGORY_DEFINITIONS.other;
}

export function buildSourceCategoryKey(source: IngredientSource | null | undefined): SourceCategoryKey | null {
  const category = deriveSourceCategory(source);
  return category?.key ?? null;
}

export function sanitizeMessage(message: string | null | undefined): string {
  if (!message) {
    return 'No mixing notes recorded.';
  }
  return message.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function formatQuantity(value: number | string | null | undefined): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return `${value}x`;
    }
    return `${value}`;
  }
  if (!value) {
    return '1x';
  }
  return value.toString();
}

export function hashForHue(value: string | null | undefined): number {
  const text = value ? String(value) : '';
  if (!text.length) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function extractInitial(label: string | null | undefined): string {
  if (!label) {
    return '?';
  }
  const match = label.trim().match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

export function badgeVariantForStrength(power: number | null | undefined): 'bold' | 'accent' | 'soft' {
  if (power == null) return 'soft';
  if (power >= 70) {
    return 'bold';
  }
  if (power >= 40) {
    return 'accent';
  }
  return 'soft';
}

export function sourceBadgeVariant(tier: string | null | undefined): 'bold' | 'soft' | 'outline' | 'neutral' {
  if (!tier) {
    return 'neutral';
  }
  if (tier === 'emag') {
    return 'bold';
  }
  if (tier.startsWith('upgrade')) {
    return 'soft';
  }
  if (tier === 'vendor') {
    return 'outline';
  }
  return 'neutral';
}
