import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, Loader2, MapPin, Search, Trash2 } from 'lucide-react';
import { getGoogleMapsApiKey } from '../lib/supabase';

interface GoogleMapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  locationAddress: string;
  onChange: (coords: {
    latitude: number | null;
    longitude: number | null;
    locationAddress: string;
  }) => void;
}

const DEFAULT_EGYPT_CENTER = { lat: 30.0444, lng: 31.2357 };

function isQuotaErrorMessage(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return (
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429')
  );
}

function PlacesSearchAndPan({
  latitude,
  longitude,
  onSelectPosition,
}: {
  latitude: number | null;
  longitude: number | null;
  onSelectPosition: (lat: number, lng: number, addressLabel?: string) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (map && latitude !== null && longitude !== null) {
      map.panTo({ lat: latitude, lng: longitude });
      if ((map.getZoom() || 6) < 13) {
        map.setZoom(14);
      }
    }
  }, [map, latitude, longitude]);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setLoadingSuggestions(true);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['eg'],
        });
        if (!cancelled) {
          setSuggestions(res.suggestions || []);
        }
      } catch (err) {
        if (isQuotaErrorMessage(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, query]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });
        if (place.location) {
          const lat = place.location.lat();
          const lng = place.location.lng();
          const label =
            place.formattedAddress ||
            place.displayName ||
            suggestion.placePrediction.text.text ||
            '';
          onSelectPosition(lat, lng, label);
          if (map) {
            if (place.viewport) {
              map.fitBounds(place.viewport);
            } else {
              map.panTo({ lat, lng });
              map.setZoom(15);
            }
          }
        }
        sessionTokenRef.current = null;
        setSuggestions([]);
        setQuery('');
      } catch (err) {
        if (isQuotaErrorMessage(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    },
    [map, onSelectPosition]
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onInput={(e: FormEvent<HTMLInputElement>) =>
            setQuery((e.target as HTMLInputElement).value)
          }
          placeholder="ابحث عن حي أو شارع أو معلم قريب (مثال: مدينة نصر)..."
          className="w-full pr-9 pl-8 py-2 border border-slate-200 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-blue-600"
        />
        {loadingSuggestions && (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin absolute left-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((suggestion, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => void handleSelectSuggestion(suggestion)}
                className="w-full text-right px-3.5 py-2.5 hover:bg-blue-50 text-xs text-slate-800 flex items-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{suggestion.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InteractiveMapContent({
  latitude,
  longitude,
  locationAddress,
  onChange,
}: GoogleMapLocationPickerProps) {
  const status = useApiLoadingStatus();
  const hasPin = latitude !== null && longitude !== null;
  const center = hasPin ? { lat: latitude, lng: longitude } : DEFAULT_EGYPT_CENTER;

  const isUnavailable =
    status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE;

  if (isUnavailable) {
    return (
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
        تعذر تحميل الخريطة التفاعلية حالياً — يمكنك استخدام زر «تحديد موقعي الحالي» أو كتابة العنوان يدوياً.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <PlacesSearchAndPan
        latitude={latitude}
        longitude={longitude}
        onSelectPosition={(lat, lng, addr) =>
          onChange({
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            locationAddress: addr || locationAddress,
          })
        }
      />

      <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={center}
          defaultZoom={hasPin ? 14 : 6}
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          style={{ width: '100%', height: '100%' }}
          onClick={(ev) => {
            const latLng = ev.detail?.latLng;
            if (!latLng) return;
            onChange({
              latitude: Number(latLng.lat.toFixed(6)),
              longitude: Number(latLng.lng.toFixed(6)),
              locationAddress,
            });
          }}
        >
          {hasPin && (
            <AdvancedMarker position={{ lat: latitude, lng: longitude }} title="موقع الإعلان">
              <Pin background="#1d4ed8" borderColor="#1e3a8a" glyphColor="#ffffff" />
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>
      <p className="text-[11px] text-slate-500">
        اضغط على الخريطة لوضع دبوس الموقع بدقة أو ابحث عن أقرب منطقة.
      </p>
    </div>
  );
}

export default function GoogleMapLocationPicker({
  latitude,
  longitude,
  locationAddress,
  onChange,
}: GoogleMapLocationPickerProps) {
  const apiKey = getGoogleMapsApiKey();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const handleUseGps = () => {
    setGeoError('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('المتصفح لا يدعم تحديد الموقع التلقائي (GPS)');
      return;
    }
    setLocating(true);

    const onSuccess = (pos: GeolocationPosition) => {
      setLocating(false);
      onChange({
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        locationAddress,
      });
    };

    const showGeoError = (err: GeolocationPositionError) => {
      setLocating(false);
      if (err.code === 1) {
        setGeoError(
          'تم حظر صلاحية الموقع من المتصفح أو المعاينة؛ يرجى تفعيل الموقع من أيقونة القفل بجانب رابط الموقع أو تحديد النقطة مباشرة على الخريطة.'
        );
      } else if (err.code === 3) {
        setGeoError('انتهت مهلة تحديد الموقع التلقائي؛ يمكنك الضغط على الخريطة أو البحث باسم المنطقة.');
      } else {
        setGeoError('تعذر تحديد موقعك تلقائياً من الجهاز؛ يمكنك اختيار النقطة مباشرة على الخريطة أو البحث بالاسم.');
      }
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === 1) {
          showGeoError(err);
          return;
        }
        // Fallback to network/coarse location (especially helpful on desktops/laptops)
        navigator.geolocation.getCurrentPosition(onSuccess, showGeoError, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60000,
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const hasCoords = latitude !== null && longitude !== null;

  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-700" />
            الموقع الجغرافي على الخريطة (اختياري)
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            يساعد المشترين والعملاء في الوصول لمقر النشاط أو معاينة العقار والسيارة.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={locating}
            onClick={handleUseGps}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors"
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-blue-700" />
            )}
            تحديد موقعي الحالي
          </button>
          {(hasCoords || locationAddress.trim()) && (
            <button
              type="button"
              onClick={() => onChange({ latitude: null, longitude: null, locationAddress: '' })}
              title="مسح الموقع"
              className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-red-50 text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {geoError && (
        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
          {geoError}
        </div>
      )}

      {apiKey ? (
        <APIProvider apiKey={apiKey} language="ar" region="EG" libraries={['places', 'marker']}>
          <InteractiveMapContent
            latitude={latitude}
            longitude={longitude}
            locationAddress={locationAddress}
            onChange={onChange}
          />
        </APIProvider>
      ) : (
        <p className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
          خريطة البحث التفاعلية ستظهر تلقائياً عند ضبط مفتاح خرائط جوجل؛ يمكنك الآن استخدام زر «تحديد موقعي الحالي» أو كتابة العنوان بالأسفل.
        </p>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">
          وصف العنوان أو المنطقة (اختياري)
        </label>
        <input
          type="text"
          value={locationAddress}
          onChange={(e) =>
            onChange({
              latitude,
              longitude,
              locationAddress: e.target.value,
            })
          }
          placeholder="مثال: شارع عباس العقاد، مدينة نصر، القاهرة"
          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {hasCoords && (
        <p className="text-[11px] font-semibold text-emerald-700 tabular-nums">
          تم تحديد الإحداثيات: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
}
