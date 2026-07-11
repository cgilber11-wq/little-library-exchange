"use client";

type Props = {
  maxMiles: string;
  onMaxMilesChange: (value: string) => void;
  browseDefault: boolean;
  savedHasCoords: boolean;
  useDeviceLocation: boolean;
  deviceLat: number | null;
  onUseDeviceLocation: () => void;
  onClearDeviceLocation: () => void;
  geoStatus: string | null;
};

export function SearchDistanceFilters({
  maxMiles,
  onMaxMilesChange,
  browseDefault,
  savedHasCoords,
  useDeviceLocation,
  deviceLat,
  onUseDeviceLocation,
  onClearDeviceLocation,
  geoStatus,
}: Props) {
  const originHint =
    geoStatus ||
    (useDeviceLocation && deviceLat != null
      ? "Using your device location."
      : savedHasCoords
        ? "Using your saved library location."
        : "Set your library on the Location page, or use current location.");

  return (
    <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/50 px-4 py-3">
      <div className="flex flex-wrap gap-x-6 gap-y-3 items-start">
        <div className="min-w-[12rem]">
          <label htmlFor="maxMiles" className="block text-xs font-medium text-stone-600 mb-1">
            Max distance
          </label>
          <select
            id="maxMiles"
            value={maxMiles}
            onChange={(e) => onMaxMilesChange(e.target.value)}
            className="w-full min-w-[12rem] px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
          >
            <option value="">{browseDefault ? "Default 25 mi" : "No limit"}</option>
            <option value="5">Within 5 mi</option>
            <option value="10">Within 10 mi</option>
            <option value="25">Within 25 mi</option>
            <option value="50">Within 50 mi</option>
          </select>
        </div>
        <div>
          <span className="block text-xs font-medium text-stone-600 mb-1">Starting point</span>
          <div className="flex flex-wrap items-center gap-2 min-h-[2.5rem]">
            <button
              type="button"
              onClick={onUseDeviceLocation}
              className="text-sm px-3 py-2 border border-stone-300 rounded-lg bg-white hover:bg-stone-50"
            >
              Use current location
            </button>
            {useDeviceLocation && deviceLat != null && (
              <button
                type="button"
                onClick={onClearDeviceLocation}
                className="text-sm px-3 py-2 text-stone-600 hover:underline"
              >
                Use saved library
              </button>
            )}
          </div>
        </div>
      </div>
      <p className={`text-xs max-w-2xl ${geoStatus ? "text-amber-800" : "text-stone-500"}`}>{originHint}</p>
    </div>
  );
}
