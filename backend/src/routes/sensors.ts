import { Router } from 'express';

export const sensorsRouter = Router();

sensorsRouter.get('/', (_req, res) => {
  res.json([
    {
      id: 'SENSOR-ARRAY-NORTH-01',
      name: 'North Perimeter Array Alpha',
      location: 'Sector A1 - North Gate Tower',
      status: 'Active',
      signalQuality: 98,
      snrDb: 34.2,
      lastUpdate: 'Just now',
      micArrayCount: 8
    },
    {
      id: 'SENSOR-ARRAY-EAST-02',
      name: 'East Perimeter Array Beta',
      location: 'Sector B4 - Hangar Roof',
      status: 'Active',
      signalQuality: 95,
      snrDb: 31.8,
      lastUpdate: '2s ago',
      micArrayCount: 8
    },
    {
      id: 'SENSOR-ARRAY-SOUTH-03',
      name: 'South Boundary Array Gamma',
      location: 'Sector C2 - Water Tower',
      status: 'Calibrating',
      signalQuality: 88,
      snrDb: 28.4,
      lastUpdate: '5s ago',
      micArrayCount: 8
    },
    {
      id: 'SENSOR-ARRAY-WEST-04',
      name: 'West Perimeter Array Delta',
      location: 'Sector D1 - West Fence',
      status: 'Active',
      signalQuality: 96,
      snrDb: 33.1,
      lastUpdate: '1s ago',
      micArrayCount: 8
    }
  ]);
});
