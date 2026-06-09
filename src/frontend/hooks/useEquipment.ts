import { useState, useEffect } from 'react';
import {
  PanelORM,
  InverterORM,
  BatteryORM,
  MeterORM,
  LightningArresterORM,
  MountingStructureORM,
  BomItemORM,
  CommunicationDeviceORM,
  type EqPanelRow,
  type EqInverterRow,
  type EqBatteryRow,
  type EqMeterRow,
  type EqLightningArresterRow,
  type EqMountingStructureRow,
  type EqBomItemRow,
  type EqCommunicationDeviceRow
} from '../../backend/orm/equipment';

export function useEquipment(orgId?: string) {
  const [panels, setPanels] = useState<EqPanelRow[]>([]);
  const [inverters, setInverters] = useState<EqInverterRow[]>([]);
  const [batteries, setBatteries] = useState<EqBatteryRow[]>([]);
  const [meters, setMeters] = useState<EqMeterRow[]>([]);
  const [las, setLas] = useState<EqLightningArresterRow[]>([]);
  const [structures, setStructures] = useState<EqMountingStructureRow[]>([]);
  const [bomItems, setBomItems] = useState<EqBomItemRow[]>([]);
  const [commDevices, setCommDevices] = useState<EqCommunicationDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAllEquipment = async () => {
    setLoading(true);
    try {
      const [
        panelsData,
        invertersData,
        batteriesData,
        metersData,
        lasData,
        structuresData,
        bomItemsData,
        commDevicesData
      ] = await Promise.all([
        PanelORM.getAll(orgId),
        InverterORM.getAll(orgId),
        BatteryORM.getAll(orgId),
        MeterORM.getAll(orgId),
        LightningArresterORM.getAll(orgId),
        MountingStructureORM.getAll(orgId),
        BomItemORM.getAll(orgId),
        CommunicationDeviceORM.getAll(orgId)
      ]);

      setPanels(panelsData);
      setInverters(invertersData);
      setBatteries(batteriesData);
      setMeters(metersData);
      setLas(lasData);
      setStructures(structuresData);
      setBomItems(bomItemsData);
      setCommDevices(commDevicesData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllEquipment();
  }, [orgId]);

  return {
    panels,
    inverters,
    batteries,
    meters,
    las,
    structures,
    bomItems,
    commDevices,
    loading,
    error,
    refresh: loadAllEquipment
  };
}
