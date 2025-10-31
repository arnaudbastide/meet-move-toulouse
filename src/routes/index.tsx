import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EventCard } from '@/components/EventCard';
import { supabase, type EventRecord } from '@/lib/supabase';
import { extractLatLng } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface EventWithExtras extends EventRecord {
  vendor_name?: string | null;
  next_slot?: string | null;
}

type MarkerLocation = {
  event: EventWithExtras;
  coords: { lat: number; lng: number };
};

interface Cluster {
  id: string;
  center: { lat: number; lng: number };
  points: MarkerLocation[];
  layerPoint: L.Point;
  sumLat: number;
  sumLng: number;
}

const CLUSTER_RADIUS_PX = 45;

const ClusteredMarkers: React.FC<{ markers: MarkerLocation[] }> = ({ markers }) => {
  const map = useMap();
  const [mapStateVersion, setMapStateVersion] = useState(0);

  useEffect(() => {
    const triggerUpdate = () => setMapStateVersion((value) => value + 1);
    map.on('zoomend', triggerUpdate);
    map.on('moveend', triggerUpdate);
    return () => {
      map.off('zoomend', triggerUpdate);
      map.off('moveend', triggerUpdate);
    };
  }, [map]);

  const clusters = useMemo<Cluster[]>(() => {
    return markers.reduce<Cluster[]>((acc, marker) => {
      const { coords } = marker;
      const latLng = L.latLng(coords.lat, coords.lng);
      const layerPoint = map.latLngToLayerPoint(latLng);

      const existingCluster = acc.find((cluster) => cluster.layerPoint.distanceTo(layerPoint) <= CLUSTER_RADIUS_PX);

      if (existingCluster) {
        existingCluster.points.push(marker);
        existingCluster.sumLat += coords.lat;
        existingCluster.sumLng += coords.lng;
        const count = existingCluster.points.length;
        existingCluster.center = {
          lat: existingCluster.sumLat / count,
          lng: existingCluster.sumLng / count,
        };
        existingCluster.layerPoint = map.latLngToLayerPoint(existingCluster.center);
        return acc;
      }

      acc.push({
        id: marker.event.id,
        center: coords,
        points: [marker],
        layerPoint,
        sumLat: coords.lat,
        sumLng: coords.lng,
      });

      return acc;
    }, []);
  }, [map, markers, mapStateVersion]);

  const handleClusterClick = useCallback(
    (cluster: Cluster) => {
      if (cluster.points.length <= 1) return;
      const bounds = L.latLngBounds(cluster.points.map(({ coords }) => [coords.lat, coords.lng] as [number, number]));

      if (!bounds.isValid()) return;

      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();

      if (northEast.equals(southWest)) {
        map.setView(bounds.getCenter(), Math.min(map.getZoom() + 2, 18));
        return;
      }

      map.fitBounds(bounds.pad(0.5), { maxZoom: 18 });
    },
    [map],
  );

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.points.length === 1) {
          const [{ event, coords }] = cluster.points;
          return (
            <Marker key={event.id} position={[coords.lat, coords.lng]}>
              <Popup>
                <div className="space-y-2">
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-sm text-muted-foreground">{event.address}</div>
                </div>
              </Popup>
            </Marker>
          );
        }

        const markerIds = cluster.points
          .map((point) => point.event.id)
          .sort()
          .join('-');

        const clusterIcon = L.divIcon({
          html: `<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow">${cluster.points.length}</div>`,
          className: 'cluster-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        return (
          <Marker
            key={markerIds}
            position={[cluster.center.lat, cluster.center.lng]}
            icon={clusterIcon}
            eventHandlers={{
              click: () => handleClusterClick(cluster),
            }}
          >
            <Popup>
              <div className="space-y-2">
                <div className="font-semibold">{cluster.points.length} événements</div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {cluster.points.slice(0, 5).map(({ event }) => (
                    <li key={event.id}>{event.title}</li>
                  ))}
                </ul>
                {cluster.points.length > 5 && (
                  <div className="text-xs text-muted-foreground">
                    et {cluster.points.length - 5} autres…
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

const IndexRoute: React.FC = () => {
  const [view, setView] = useState<'map' | 'list'>('list');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, vendor:profiles(name), slots:event_slots(start_at)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as (EventRecord & {
        vendor?: { name?: string | null } | null;
        slots?: { start_at: string }[] | null;
      })[];
    },
  });

  const events = useMemo<EventWithExtras[]>(() => {
    if (!data) return [];
    return data.map((event) => {
      const vendor_name = event.vendor?.name ?? null;
      const next_slot = event.slots?.length
        ? event.slots.map((s) => s.start_at).sort()[0]
        : null;
      return { ...event, vendor_name, next_slot };
    });
  }, [data]);

  const markerLocations = useMemo(
    () =>
      events
        .map((event) => {
          const coords = extractLatLng(event.geom);
          if (!coords) return null;
          const markerLocation: MarkerLocation = { event, coords };
          return markerLocation;
        })
        .filter((value): value is MarkerLocation => value !== null),
    [events],
  );

  const mapContent = (
    <div className="h-[480px] w-full overflow-hidden rounded-xl border">
      {isClient ? (
        <MapContainer center={[43.6047, 1.4442]} zoom={12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClusteredMarkers markers={markerLocations} />
        </MapContainer>
      ) : (
        <Skeleton className="h-full w-full" />
      )}
    </div>
  );

  const listContent = (
    <div className="grid gap-4 sm:grid-cols-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Explorez les expériences locales</h1>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => value && setView(value as 'map' | 'list')}
        >
          <ToggleGroupItem value="list">Liste</ToggleGroupItem>
          <ToggleGroupItem value="map">Carte</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">Aucun événement publié pour le moment.</p>
      ) : view === 'map' ? (
        mapContent
      ) : (
        listContent
      )}
    </main>
  );
};

export default IndexRoute;
