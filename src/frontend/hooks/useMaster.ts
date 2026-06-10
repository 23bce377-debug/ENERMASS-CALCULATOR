import { useState, useEffect } from 'react';
import {
  StateRuleORM,
  CalculationSchemeORM,
  CategoryMarginORM,
  QuoteFormatTemplateORM,
  AppSettingORM,
  type StateRuleRow,
  type CalculationSchemeRow,
  type CategoryMarginRow,
  type QuoteFormatTemplateRow,
  type AppSettingRow,
  type AppSettingUpdate
} from '../../backend/orm/master';

export function useMasterData(orgId?: string) {
  const [stateRules, setStateRules] = useState<StateRuleRow[]>([]);
  const [schemes, setSchemes] = useState<CalculationSchemeRow[]>([]);
  const [categoryMargins, setCategoryMargins] = useState<CategoryMarginRow[]>([]);
  const [templates, setTemplates] = useState<QuoteFormatTemplateRow[]>([]);
  const [settings, setSettings] = useState<AppSettingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const promises: [
        Promise<StateRuleRow[]>,
        Promise<CalculationSchemeRow[]>,
        Promise<QuoteFormatTemplateRow[]>,
        Promise<CategoryMarginRow[] | null>,
        Promise<AppSettingRow | null>
      ] = [
        StateRuleORM.getAll(),
        CalculationSchemeORM.getAll(),
        QuoteFormatTemplateORM.getAll(orgId),
        orgId ? CategoryMarginORM.getByOrgId(orgId) : Promise.resolve(null),
        orgId ? AppSettingORM.getByOrgId(orgId) : Promise.resolve(null)
      ];

      const [
        stateRulesData,
        schemesData,
        templatesData,
        categoryMarginsData,
        settingsData
      ] = await Promise.all(promises);

      setStateRules(stateRulesData);
      setSchemes(schemesData);
      setTemplates(templatesData);
      if (categoryMarginsData) setCategoryMargins(categoryMarginsData);
      if (settingsData) setSettings(settingsData);
      
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, [orgId]);

  const updateSettings = async (updates: AppSettingUpdate) => {
    if (!orgId) throw new Error('Organisation ID is required to update settings.');
    try {
      const data = await AppSettingORM.update(orgId, updates);
      setSettings(data);
      return data;
    } catch (err) {
      throw err;
    }
  };

  return {
    stateRules,
    schemes,
    categoryMargins,
    templates,
    settings,
    loading,
    error,
    refresh: loadMasterData,
    updateSettings
  };
}
