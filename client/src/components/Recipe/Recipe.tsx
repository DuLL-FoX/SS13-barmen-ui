import { useState } from 'react';
import type {
  Recipe as RecipeType,
  RecipeItem,
  IngredientSource,
  RecipeRelation,
  SpecialProperty,
} from '@/types';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useApp } from '@/context/useApp';
import {
  sanitizeMessage,
  formatQuantity,
  hashForHue,
  extractInitial,
  badgeVariantForStrength,
  sourceBadgeVariant,
  buildSourceCategoryKey,
} from '@/utils';
import './Recipe.css';

function formatTemperature(kelvin: number, isCold: boolean = false): string {
  const celsius = Math.round(kelvin - 273.15);
  const label = isCold ? 'Below' : 'Above';
  return `${label} ${celsius}°C`;
}

function getPropertyIcon(type: string): IconName {
  switch (type) {
    case 'addiction': return 'pill';
    case 'overdose': return 'skull';
    case 'quality': return 'sparkle';
    case 'healing': return 'heart';
    case 'effect': return 'bolt';
    default: return 'bolt';
  }
}

interface RecipeCardProps {
  recipe: RecipeType;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const { showDeveloperDetails, sourceCategoryFilters, recipeLookup } = useApp();
  const [showRelations, setShowRelations] = useState(false);

  const isSourceCategoryDisabled = (source: IngredientSource | undefined) => {
    const key = buildSourceCategoryKey(source);
    if (!key) return false;
    return sourceCategoryFilters.disabled.has(key);
  };

  const hasIcon = recipe.icon?.src;
  const seed = recipe.path || recipe.id || recipe.name || '';
  const hash = hashForHue(seed);
  const primaryHue = hash % 360;
  const secondaryHue = (primaryHue + 40) % 360;

  const hasRelations = recipe.requiredRecipes.length > 0 || recipe.dependentRecipes.length > 0;
  const hasSpecialProps = recipe.specialProperties && recipe.specialProperties.length > 0;
  const hasTempRequirement = !!recipe.requiredTemp;

  return (
    <article className="recipe-card" data-view={showDeveloperDetails ? 'developer' : 'standard'}>
      <header className="recipe-card__header">
        <div className="recipe-card__icon-wrap">
          {hasIcon ? (
            <img
              className="recipe-card__icon"
              src={recipe.icon!.src}
              alt={recipe.icon?.label ?? recipe.name}
              loading="lazy"
              style={{
                width: `${Math.min(48, (recipe.icon?.width ?? 32) * 1.5)}px`,
                height: `${Math.min(48, (recipe.icon?.height ?? 32) * 1.5)}px`,
              }}
            />
          ) : (
            <span
              className="recipe-card__icon-placeholder"
              style={{
                ['--hue-1' as string]: primaryHue,
                ['--hue-2' as string]: secondaryHue,
              }}
            >
              {extractInitial(recipe.name || seed)}
            </span>
          )}
        </div>

        <div className="recipe-card__title-group">
          <h3 className="recipe-card__title">{recipe.name}</h3>
          <div className="recipe-card__meta">
            <Badge
              label={recipe.isAlcoholic ? 'Alcoholic' : 'Soft'}
              variant={recipe.isAlcoholic ? 'accent' : 'neutral'}
            />
            {recipe.strength != null && recipe.strength > 0 && (
              <Badge
                label={`${recipe.strength}%`}
                variant={badgeVariantForStrength(recipe.strength)}
              />
            )}
            {recipe.source && (
              <Badge label={recipe.source} variant="outline" />
            )}
          </div>
        </div>
      </header>

      {recipe.mixMessage && (
        <p className="recipe-card__description">
          {sanitizeMessage(recipe.mixMessage)}
        </p>
      )}

      {recipe.tags.length > 0 && (
        <div className="recipe-card__tags">
          {recipe.tags
            .filter((tag) => !['alcoholic', 'non alcoholic', 'non-alcoholic'].includes(tag.toLowerCase()))
            .map((tag) => (
              <span key={tag} className="recipe-card__tag">{tag}</span>
            ))}
        </div>
      )}

      <div className="recipe-card__body">
        <div className="recipe-card__section">
          <h4 className="recipe-card__section-title">
            <Icon name="ingredient" size={14} />
            Ingredients
          </h4>
          <ul className="recipe-card__list">
            {recipe.requiredReagents.map((item) => (
              <IngredientItem
                key={item.path}
                item={item}
                isSourceCategoryDisabled={isSourceCategoryDisabled}
              />
            ))}
          </ul>
        </div>

        <div className="recipe-card__divider" />

        <div className="recipe-card__section">
          <h4 className="recipe-card__section-title">
            <Icon name="result" size={14} />
            Results
          </h4>
          <ul className="recipe-card__list">
            {recipe.results.map((item) => (
              <li key={item.path} className="recipe-card__item">
                <span className="recipe-card__item-qty">{formatQuantity(item.quantity)}</span>
                <span className="recipe-card__item-name">{item.displayName}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {recipe.requiredCatalysts.length > 0 && (
        <div className="recipe-card__catalysts">
          <h4 className="recipe-card__section-title">
            <Icon name="catalyst" size={14} />
            Catalysts
            <span className="recipe-card__catalyst-note">not consumed</span>
          </h4>
          <ul className="recipe-card__catalyst-list">
            {recipe.requiredCatalysts.map((item) => (
              <CatalystItem
                key={item.path}
                item={item}
                isSourceCategoryDisabled={isSourceCategoryDisabled}
              />
            ))}
          </ul>
        </div>
      )}

      {(hasTempRequirement || hasSpecialProps) && (
        <div className="recipe-card__requirements">
          {hasTempRequirement && (
            <div className="recipe-card__temp">
              <Icon name={recipe.isColdRecipe ? 'cold' : 'fire'} size={18} />
              <span className="recipe-card__temp-text">
                {formatTemperature(recipe.requiredTemp!, recipe.isColdRecipe)}
              </span>
            </div>
          )}
          {hasSpecialProps && (
            <div className="recipe-card__props">
              {recipe.specialProperties!.map((prop: SpecialProperty, i: number) => (
                <span key={`${prop.type}-${i}`} className="recipe-card__prop">
                  <Icon name={getPropertyIcon(prop.type)} size={14} />
                  {prop.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {hasRelations && (
        <div className="recipe-card__relations-section">
          <button
            type="button"
            className="recipe-card__relations-toggle"
            onClick={() => setShowRelations(!showRelations)}
            aria-expanded={showRelations}
          >
            <Icon name={showRelations ? 'chevron-down' : 'chevron-right'} size={12} />
            <Icon name="tree" size={14} className="recipe-card__relations-toggle-tree" />
            Recipe Tree
            <span className="recipe-card__relations-count">
              {recipe.requiredRecipes.length + recipe.dependentRecipes.length}
            </span>
          </button>

          {showRelations && (
            <div className="recipe-card__relations">
              {recipe.requiredRecipes.length > 0 && (
                <RelationGroup
                  title="Builds From"
                  entries={recipe.requiredRecipes}
                  recipeLookup={recipeLookup}
                  variant="from"
                />
              )}
              {recipe.dependentRecipes.length > 0 && (
                <RelationGroup
                  title="Used In"
                  entries={recipe.dependentRecipes}
                  recipeLookup={recipeLookup}
                  variant="to"
                />
              )}
            </div>
          )}
        </div>
      )}

      {showDeveloperDetails && (
        <footer className="recipe-card__dev">
          <code className="recipe-card__dev-path">{recipe.path}</code>
          <div className="recipe-card__dev-meta">
            {recipe.id && <span>ID: {recipe.id}</span>}
            {recipe.requiredTemp && (
              <span>Temp: {recipe.requiredTemp}K</span>
            )}
            {recipe.requiredPressure && (
              <span>Pressure: {recipe.requiredPressure}</span>
            )}
            {(recipe.requiredPhMin || recipe.requiredPhMax) && (
              <span>pH: {recipe.requiredPhMin ?? '?'}-{recipe.requiredPhMax ?? '?'}</span>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}


interface IngredientItemProps {
  item: RecipeItem;
  isSourceCategoryDisabled: (source: IngredientSource | undefined) => boolean;
}

function IngredientItem({ item, isSourceCategoryDisabled }: IngredientItemProps) {
  const visibleSources = item.sources?.filter((s) => !isSourceCategoryDisabled(s)) ?? [];

  return (
    <li className="recipe-card__item">
      <span className="recipe-card__item-qty">{formatQuantity(item.quantity)}</span>
      <div className="recipe-card__item-content">
        <span className="recipe-card__item-name">{item.displayName}</span>
        {visibleSources.length > 0 && (
          <div className="recipe-card__item-sources">
            {visibleSources.slice(0, 3).map((source, i) => (
              <SourceBadge key={i} source={source} />
            ))}
            {visibleSources.length > 3 && (
              <span className="recipe-card__item-more">+{visibleSources.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

interface CatalystItemProps {
  item: RecipeItem;
  isSourceCategoryDisabled: (source: IngredientSource | undefined) => boolean;
}

function CatalystItem({ item, isSourceCategoryDisabled }: CatalystItemProps) {
  const visibleSources = item.sources?.filter((s) => !isSourceCategoryDisabled(s)) ?? [];

  return (
    <li className="recipe-card__catalyst">
      <span className="recipe-card__catalyst-qty">{formatQuantity(item.quantity)}</span>
      <div className="recipe-card__catalyst-info">
        <span className="recipe-card__catalyst-name">
          {item.displayName || item.name || item.path || 'Unknown'}
        </span>
        {visibleSources.length > 0 && (
          <div className="recipe-card__catalyst-sources">
            {visibleSources.slice(0, 2).map((source, i) => (
              <SourceBadge key={i} source={source} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

interface SourceBadgeProps {
  source: IngredientSource;
}

function SourceBadge({ source }: SourceBadgeProps) {
  const machine = source.machineName ?? source.machinePath ?? 'Unknown';
  const tier = source.tierLabel || '';
  const label = tier ? `${machine} · ${tier}` : machine;

  return (
    <Badge label={label} variant={sourceBadgeVariant(source.tier)} />
  );
}

interface RelationGroupProps {
  title: string;
  entries: RecipeRelation[];
  recipeLookup: Map<string, RecipeType>;
  variant: 'from' | 'to';
}

function RelationGroup({ title, entries, recipeLookup, variant }: RelationGroupProps) {
  return (
    <div className={`recipe-card__relation-group recipe-card__relation-group--${variant}`}>
      <h5 className="recipe-card__relation-title">{title}</h5>
      <ul className="recipe-card__relation-list">
        {entries.map((entry) => (
          <RelationEntry key={entry.id} entry={entry} recipeLookup={recipeLookup} />
        ))}
      </ul>
    </div>
  );
}

interface RelationEntryProps {
  entry: RecipeRelation;
  recipeLookup: Map<string, RecipeType>;
}

function RelationEntry({ entry, recipeLookup }: RelationEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const recipe = recipeLookup.get(entry.id);

  if (!recipe) {
    return (
      <li className="recipe-card__relation-item recipe-card__relation-item--missing">
        <span>{entry.name}</span>
      </li>
    );
  }

  return (
    <li className="recipe-card__relation-item">
      <button
        type="button"
        className="recipe-card__relation-btn"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="recipe-card__relation-name">{recipe.name}</span>
        {recipe.strength != null && recipe.strength > 0 && (
          <span className="recipe-card__relation-strength">{recipe.strength}%</span>
        )}
        <Icon name={expanded ? 'minus' : 'plus'} size={12} className="recipe-card__relation-arrow" />
      </button>

      {expanded && (
        <div className="recipe-card__relation-details">
          {recipe.mixMessage && (
            <p className="recipe-card__relation-msg">{sanitizeMessage(recipe.mixMessage)}</p>
          )}
          {recipe.requiredReagents.length > 0 && (
            <ul className="recipe-card__relation-ingredients">
              {recipe.requiredReagents.map((item) => (
                <li key={item.path}>
                  <strong>{formatQuantity(item.quantity)}</strong> {item.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
