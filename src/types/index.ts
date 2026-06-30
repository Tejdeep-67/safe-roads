export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  reported_by: string | null;
  verified: boolean;
  report_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserReport {
  id: string;
  user_id: string;
  pothole_id: string;
  image_url: string | null;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

export interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

export interface RouteInfo {
  distance: number;
  duration: number;
  coordinates: [number, number][];
}
