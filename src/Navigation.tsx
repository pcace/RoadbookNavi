import { useEffect, useRef, useState } from 'react';
import {
  watchPosition,
  clearWatch,
  requestPermissions,
} from '@tauri-apps/plugin-geolocation';
import { calculateDistance } from './core/geo';
import type { Project } from './model';
import { safeSvg } from './export';

export function Navigation({ project }: { project: Project }) {
  const [odometer, setOdometer] = useState(0),
    [gps, setGps] = useState(false),
    [error, setError] = useState(''),
    [follow, setFollow] = useState(true);
  const previous = useRef<{ lat: number; lon: number; time: number } | null>(
      null
    ),
    refs = useRef<(HTMLDivElement | null)[]>([]);
  const active = Math.max(
    0,
    project.entries.findIndex(e => e.distance > odometer) - 1
  );
  useEffect(() => {
    if (follow)
      refs.current[active]?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
  }, [active, follow]);
  useEffect(() => {
    if (!gps) return;
    let stopped = false,
      watch: number | undefined,
      wake: WakeLockSentinel | undefined;
    const start = async () => {
      try {
        const permissions = await requestPermissions(['location']);
        if (permissions.location !== 'granted')
          throw new Error('Standortzugriff wurde nicht erlaubt.');
        if (stopped) return;
        watch = await watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (position, error) => {
            if (stopped) return;
            if (error) {
              setError(error);
              return;
            }
            if (!position || position.coords.accuracy > 50) return;
            const c = position.coords,
              p = {
                lat: c.latitude,
                lon: c.longitude,
                time: position.timestamp,
              },
              last = previous.current;
            if (last) {
              const dt = (p.time - last.time) / 1000;
              const d = calculateDistance(last.lat, last.lon, p.lat, p.lon);
              if (
                dt > 0 &&
                dt < 15 &&
                d / dt < 70 &&
                (c.speed === null ? d > 3 : c.speed > 0.5)
              )
                setOdometer(x => x + (c.speed !== null ? c.speed * dt : d));
            }
            previous.current = p;
          }
        );
        if (stopped && watch !== undefined) await clearWatch(watch);
        if (!stopped && 'wakeLock' in navigator)
          wake = await navigator.wakeLock.request('screen');
      } catch (e) {
        if (!stopped) {
          setError(String(e));
          setGps(false);
        }
      }
    };
    void start();
    return () => {
      stopped = true;
      previous.current = null;
      if (watch !== undefined) void clearWatch(watch);
      void wake?.release();
    };
  }, [gps]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea')) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setOdometer(x => Math.max(0, x - 10));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOdometer(x => x + 10);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <section className="reader">
      <div className="reader-controls">
        <strong>{(odometer / 1000).toFixed(2)} km</strong>
        <button onClick={() => setOdometer(x => Math.max(0, x - 10))}>
          −10 m
        </button>
        <button onClick={() => setOdometer(x => x + 10)}>+10 m</button>
        <button onClick={() => setOdometer(0)}>Nullen</button>
        <button className={gps ? 'selected' : ''} onClick={() => setGps(!gps)}>
          {gps ? 'GPS stoppen' : 'GPS starten'}
        </button>
        <label>
          <input
            type="checkbox"
            checked={follow}
            onChange={e => setFollow(e.target.checked)}
          />{' '}
          Automatisch folgen
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="muted">
        Navigation bei geöffneter App. Bei gesperrtem Bildschirm ist die
        Positionsfortschreibung noch nicht garantiert.
      </p>
      {!project.entries.length && (
        <p>In der Planung zuerst ein Roadbook erzeugen.</p>
      )}
      {project.entries.map((e, i) => (
        <div
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
          className={`roadbook-row ${i === active ? 'current' : ''}`}
        >
          <div>
            <small>#{i + 1}</small>
            <strong>{(e.distance / 1000).toFixed(2)}</strong>
            <small>
              +
              {(
                (e.distance - (project.entries[i - 1]?.distance || 0)) /
                1000
              ).toFixed(2)}{' '}
              km
            </small>
            <button onClick={() => setOdometer(e.distance)}>Hier</button>
          </div>
          <div dangerouslySetInnerHTML={{ __html: safeSvg(e.svg) }} />
          <p>{e.note || e.turn.instruction}</p>
        </div>
      ))}
    </section>
  );
}
