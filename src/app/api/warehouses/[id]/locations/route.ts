import { NextRequest } from 'next/server';
import { getLocations, addLocation } from '../../handlers';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return getLocations(req, params.id);
}
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return addLocation(req, params.id);
}
