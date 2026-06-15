export interface SolarEdgeSystem {
  id: string;
  name: string;
  status: string;
  currentPowerKw: number;
}

export async function fetchSolarEdgeSystems(apiKey: string): Promise<SolarEdgeSystem[]> {
  // Stub implementation
  console.log('Fetching systems from SolarEdge API...', apiKey ? 'Using key' : 'No key');
  return [];
}
