export interface GrowattSystem {
  plantId: string;
  plantName: string;
  status: string;
  currentPower: number;
}

export async function fetchGrowattSystems(token: string): Promise<GrowattSystem[]> {
  // Stub implementation
  console.log('Fetching systems from Growatt API...', token ? 'Using token' : 'No token');
  return [];
}
