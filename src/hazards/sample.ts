// SAMPLE DATA - not real reports.
// I placed these points along real roads in Guntur and Vijayawada (route geometry from
// OSRM) so the map and the route alerts have something to show on the first visit.
// They are always labelled "sample" in the UI and can be hidden from the account menu.
import type { Hazard } from './types';

type Raw = Pick<Hazard, 'id' | 'lat' | 'lng' | 'severity' | 'confidence' | 'source' | 'note' | 'createdAt'> & { confirmations: number };

const raw: Raw[] = [
  {id: "s01", lat: 16.2921, lng: 80.454427, severity: "medium", confidence: 0.54, source: "photo", note: "Uneven surface after rain", createdAt: "2026-10-31T02:55:00+05:30", confirmations: 1},
  {id: "s02", lat: 16.292276, lng: 80.453743, severity: "low", confidence: 0.48, source: "camera", note: "Loose gravel patch", createdAt: "2026-10-19T19:52:00+05:30", confirmations: 2},
  {id: "s03", lat: 16.292154, lng: 80.446232, severity: "high", confidence: 0.7, source: "camera", note: "Large crater near the divider", createdAt: "2026-10-23T01:37:00+05:30", confirmations: 4},
  {id: "s04", lat: 16.291329, lng: 80.427341, severity: "high", confidence: 0.63, source: "camera", note: "Water-filled pothole, depth unclear", createdAt: "2026-10-15T00:06:00+05:30", confirmations: 3},
  {id: "s05", lat: 16.291181, lng: 80.426727, severity: "medium", confidence: 0.74, source: "camera", note: "Patchwork breaking up", createdAt: "2026-09-16T22:54:00+05:30", confirmations: 3},
  {id: "s06", lat: 16.288869, lng: 80.419498, severity: "high", confidence: 0.87, source: "camera", note: "Water-filled pothole, depth unclear", createdAt: "2026-09-20T10:08:00+05:30", confirmations: 1},
  {id: "s07", lat: 16.282171, lng: 80.399653, severity: "low", confidence: 0.44, source: "photo", note: "Loose gravel patch", createdAt: "2026-10-19T16:23:00+05:30", confirmations: 1},
  {id: "s08", lat: 16.278601, lng: 80.387994, severity: "medium", confidence: 0.47, source: "photo", note: "Pothole on the left lane", createdAt: "2026-09-25T22:19:00+05:30", confirmations: 2},
  {id: "s09", lat: 16.272499, lng: 80.369301, severity: "medium", confidence: 0.79, source: "photo", note: "Pothole near speed breaker", createdAt: "2026-09-30T20:22:00+05:30", confirmations: 4},
  {id: "s10", lat: 16.270785, lng: 80.364066, severity: "medium", confidence: 0.83, source: "camera", note: "Pothole on the left lane", createdAt: "2026-10-09T03:34:00+05:30", confirmations: 4},
  {id: "s11", lat: 16.267618, lng: 80.355945, severity: "medium", confidence: null, source: "manual", note: "Pothole near speed breaker", createdAt: "2026-09-19T20:35:00+05:30", confirmations: 2},
  {id: "s12", lat: 16.255537, lng: 80.336884, severity: "low", confidence: null, source: "manual", note: "Loose gravel patch", createdAt: "2026-09-19T02:26:00+05:30", confirmations: 4},
  {id: "s13", lat: 16.294175, lng: 80.464645, severity: "medium", confidence: 0.5, source: "camera", note: "Patchwork breaking up", createdAt: "2026-10-05T04:19:00+05:30", confirmations: 1},
  {id: "s14", lat: 16.300807, lng: 80.483221, severity: "high", confidence: 0.9, source: "camera", note: "Large crater near the divider", createdAt: "2026-10-01T13:21:00+05:30", confirmations: 3},
  {id: "s15", lat: 16.32514, lng: 80.484172, severity: "medium", confidence: 0.77, source: "camera", note: "Uneven surface after rain", createdAt: "2026-10-12T04:13:00+05:30", confirmations: 4},
  {id: "s16", lat: 16.328676, lng: 80.484546, severity: "low", confidence: null, source: "manual", note: "Loose gravel patch", createdAt: "2026-10-20T11:32:00+05:30", confirmations: 1},
  {id: "s17", lat: 16.345387, lng: 80.490313, severity: "high", confidence: 0.9, source: "photo", note: "Deep pothole, slow down", createdAt: "2026-10-29T01:22:00+05:30", confirmations: 1},
  {id: "s18", lat: 16.359087, lng: 80.498006, severity: "high", confidence: 0.76, source: "camera", note: "Water-filled pothole, depth unclear", createdAt: "2026-10-14T06:51:00+05:30", confirmations: 4},
  {id: "s19", lat: 16.381281, lng: 80.528188, severity: "low", confidence: 0.58, source: "camera", note: "Small pothole", createdAt: "2026-10-23T02:43:00+05:30", confirmations: 2},
  {id: "s20", lat: 16.392587, lng: 80.541921, severity: "medium", confidence: 0.64, source: "photo", note: "Patchwork breaking up", createdAt: "2026-10-28T23:29:00+05:30", confirmations: 1},
  {id: "s21", lat: 16.40897, lng: 80.555706, severity: "high", confidence: 0.64, source: "photo", note: "Water-filled pothole, depth unclear", createdAt: "2026-10-03T16:52:00+05:30", confirmations: 1},
  {id: "s22", lat: 16.411725, lng: 80.557928, severity: "high", confidence: 0.73, source: "camera", note: "Broken patch across the lane", createdAt: "2026-09-27T21:15:00+05:30", confirmations: 2},
  {id: "s23", lat: 16.447702, lng: 80.596902, severity: "high", confidence: null, source: "manual", note: "Large crater near the divider", createdAt: "2026-09-22T00:41:00+05:30", confirmations: 2},
  {id: "s24", lat: 16.454767, lng: 80.604652, severity: "medium", confidence: 0.71, source: "photo", note: "Patchwork breaking up", createdAt: "2026-10-18T00:02:00+05:30", confirmations: 1},
  {id: "s25", lat: 16.455899, lng: 80.605979, severity: "medium", confidence: 0.69, source: "camera", note: "Uneven surface after rain", createdAt: "2026-10-03T02:22:00+05:30", confirmations: 1},
  {id: "s26", lat: 16.487519, lng: 80.622026, severity: "high", confidence: 0.74, source: "photo", note: "Broken patch across the lane", createdAt: "2026-10-02T23:17:00+05:30", confirmations: 2},
  {id: "s27", lat: 16.495674, lng: 80.650795, severity: "medium", confidence: null, source: "manual", note: "Patchwork breaking up", createdAt: "2026-10-29T19:20:00+05:30", confirmations: 3},
  {id: "s28", lat: 16.494446, lng: 80.645882, severity: "low", confidence: null, source: "manual", note: "Surface cracks starting", createdAt: "2026-09-22T10:27:00+05:30", confirmations: 2},
  {id: "s29", lat: 16.495967, lng: 80.643471, severity: "medium", confidence: 0.77, source: "photo", note: "Pothole on the left lane", createdAt: "2026-10-19T09:58:00+05:30", confirmations: 2},
  {id: "s30", lat: 16.507456, lng: 80.616412, severity: "high", confidence: 0.87, source: "photo", note: "Large crater near the divider", createdAt: "2026-10-21T11:57:00+05:30", confirmations: 2},
  {id: "s31", lat: 16.507168, lng: 80.615982, severity: "low", confidence: null, source: "manual", note: "Small pothole", createdAt: "2026-10-07T05:29:00+05:30", confirmations: 1},
  {id: "s32", lat: 16.507012, lng: 80.614867, severity: "high", confidence: 0.64, source: "camera", note: "Broken patch across the lane", createdAt: "2026-10-04T06:10:00+05:30", confirmations: 2},
  {id: "s33", lat: 16.519579, lng: 80.615087, severity: "medium", confidence: null, source: "manual", note: "Uneven surface after rain", createdAt: "2026-09-28T12:01:00+05:30", confirmations: 1},
  {id: "s34", lat: 16.328668, lng: 80.418407, severity: "medium", confidence: 0.67, source: "photo", note: "Patchwork breaking up", createdAt: "2026-10-14T09:02:00+05:30", confirmations: 2},
  {id: "s35", lat: 16.330638, lng: 80.458692, severity: "low", confidence: 0.63, source: "photo", note: "Surface cracks starting", createdAt: "2026-10-17T01:33:00+05:30", confirmations: 2},
  {id: "s36", lat: 16.328276, lng: 80.462783, severity: "low", confidence: 0.53, source: "photo", note: "Surface cracks starting", createdAt: "2026-10-16T07:48:00+05:30", confirmations: 3},
  {id: "s37", lat: 16.344587, lng: 80.478987, severity: "high", confidence: 0.62, source: "photo", note: "Large crater near the divider", createdAt: "2026-10-10T21:17:00+05:30", confirmations: 3},
  {id: "s38", lat: 16.346724, lng: 80.480046, severity: "high", confidence: 0.82, source: "photo", note: "Large crater near the divider", createdAt: "2026-10-26T18:38:00+05:30", confirmations: 4},
  {id: "s39", lat: 16.348985, lng: 80.481791, severity: "high", confidence: 0.68, source: "photo", note: "Water-filled pothole, depth unclear", createdAt: "2026-10-01T07:08:00+05:30", confirmations: 4},
  {id: "s40", lat: 16.454334, lng: 80.525052, severity: "low", confidence: 0.44, source: "photo", note: "Surface cracks starting", createdAt: "2026-09-27T01:42:00+05:30", confirmations: 1},
  {id: "s41", lat: 16.464102, lng: 80.51794, severity: "high", confidence: 0.71, source: "camera", note: "Large crater near the divider", createdAt: "2026-10-14T10:47:00+05:30", confirmations: 1},
  {id: "s42", lat: 16.47363, lng: 80.513686, severity: "medium", confidence: 0.78, source: "photo", note: "Uneven surface after rain", createdAt: "2026-09-19T04:03:00+05:30", confirmations: 2},
  {id: "s43", lat: 16.487505, lng: 80.513645, severity: "low", confidence: 0.5, source: "photo", note: "Surface cracks starting", createdAt: "2026-10-06T22:08:00+05:30", confirmations: 2},
  {id: "s44", lat: 16.495149, lng: 80.51363, severity: "high", confidence: 0.71, source: "camera", note: "Deep pothole, slow down", createdAt: "2026-10-10T15:56:00+05:30", confirmations: 2},
  {id: "s45", lat: 16.296985, lng: 80.445215, severity: "high", confidence: null, source: "manual", note: "Broken patch across the lane", createdAt: "2026-10-18T19:58:00+05:30", confirmations: 1},
  {id: "s46", lat: 16.291678, lng: 80.438295, severity: "low", confidence: 0.43, source: "camera", note: "Small pothole", createdAt: "2026-09-18T15:43:00+05:30", confirmations: 1},
  {id: "s47", lat: 16.292112, lng: 80.432311, severity: "high", confidence: 0.64, source: "camera", note: "Large crater near the divider", createdAt: "2026-09-29T22:54:00+05:30", confirmations: 2},
  {id: "s48", lat: 16.291911, lng: 80.429763, severity: "high", confidence: 0.87, source: "camera", note: "Broken patch across the lane", createdAt: "2026-10-17T10:18:00+05:30", confirmations: 2},
];

export const SAMPLE_HAZARDS: Hazard[] = raw.map(({ confirmations, ...h }) => ({
  ...h,
  potholes: confirmations > 2 ? 2 : 1,
  by: null,
  mine: false,
  hasPhoto: false,
  origin: 'sample',
}));

// handy demo route: Guntur NTR bus station -> RVR & JC College of Engineering
export const DEMO_ROUTE = {
  from: { label: 'NTR Bus Station, Guntur', lat: 16.2957, lng: 80.4565 },
  to: { label: 'RVR & JC College of Engineering, Chowdavaram', lat: 16.2554, lng: 80.3242 },
};
