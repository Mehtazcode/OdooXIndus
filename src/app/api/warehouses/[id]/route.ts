import { NextRequest } from 'next/server';
import { GET, POST, updateWarehouse, getLocations, addLocation } from '../handlers';

export { GET, POST };

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return updateWarehouse(req, params.id);
}
