import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin } from 'lucide-react';
import { getGoogleMapsApiKey } from '../lib/supabase';

interface GoogleMapLocationViewerProps {
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string | null;
  city: string;
  title: string;
}

function ViewerMapCanvas({
  latitude,
  longitude,
  title,
}: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return null;
  }

  return (
    <div className="h-56 sm:h-64 w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        center={{ lat: latitude, lng: longitude }}
        defaultZoom={15}
        gestureHandling="cooperative"
        streetViewControl={false}
        mapTypeControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={{ lat: latitude, lng: longitude }} title={title}>
          <Pin background="#1d4ed8" borderColor="#1e3a8a" glyphColor="#ffffff" />
        </AdvancedMarker>
      </GoogleMap>
    </div>
  );
}

export default function GoogleMapLocationViewer({
  latitude,
  longitude,
  locationAddress,
  city,
  title,
}: GoogleMapLocationViewerProps) {
  const hasCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const hasAddress = Boolean(locationAddress && locationAddress.trim());

  if (!hasCoords && !hasAddress) {
    return null;
  }

  const apiKey = getGoogleMapsApiKey();
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${locationAddress || ''} ${city}`.trim()
      )}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
            الموقع الجغرافي
          </p>
          <p className="text-xs text-slate-600 mt-0.5 truncate">
            {hasAddress ? locationAddress : city}
          </p>
        </div>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          فتح الاتجاهات على خرائط جوجل
        </a>
      </div>

      {hasCoords && apiKey && (
        <APIProvider apiKey={apiKey} language="ar" region="EG" libraries={['marker']}>
          <ViewerMapCanvas latitude={latitude} longitude={longitude} title={title} />
        </APIProvider>
      )}
    </div>
  );
}
