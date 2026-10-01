import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { Project } from './model';
import { exportRn2, completeRn2Geometry, importRn2 } from './rn2';
import { rn2IconResolver } from './rn2-icons';
import { osm, repository } from './services';
import { detailBounds } from './geometry';
import { routeSurfacePreview } from './ui/components/RouteBuilder/utils/routeSurfaces';
import {
  getSurfaceLabel,
  normalizeSurfaceKey,
} from './ui/components/RouteBuilder/utils/surfaces';
import i18n from './ui/i18n';
import { onlineReverse, useGeocoding } from './geocoding';

type PdfSurface = {
  key: string;
  label: string;
  meters: number;
  percentage: number;
};

const surfaceColors = ['#7c3402', '#bc7442', '#d6aa8a', '#ddd6d0'];

const coordinateLabel = (point?: { lat: number; lon: number }) =>
  point ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` : '-';

const compactPlaceLabel = (
  place: Awaited<ReturnType<typeof onlineReverse>>,
  fallback: string
) => {
  if (!place) return fallback;
  const address = place.address as Record<string, unknown>;
  const road =
    address.road ?? address.pedestrian ?? address.path ?? address.cycleway;
  const locality =
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.municipality ??
    address.county;
  const parts = [road, locality]
    .filter((value): value is string => typeof value === 'string' && !!value)
    .filter((value, index, values) => values.indexOf(value) === index);
  if (parts.length) return parts.join(', ');
  return place.displayName.split(',').slice(0, 2).join(',').trim() || fallback;
};

const pdfLocationLabels = async (
  start?: { lat: number; lon: number },
  finish?: { lat: number; lon: number }
) => {
  const fallback = [coordinateLabel(start), coordinateLabel(finish)] as const;
  if (!useGeocoding.getState().enabled || !start || !finish) return fallback;

  let timeoutId = 0;
  const timeout = new Promise<null>(resolve => {
    timeoutId = window.setTimeout(() => resolve(null), 7000);
  });
  const lookup = Promise.all([
    onlineReverse(start.lat, start.lon),
    onlineReverse(finish.lat, finish.lon),
  ]);
  const places = await Promise.race([lookup, timeout]);
  window.clearTimeout(timeoutId);
  if (!places) return fallback;
  return [
    compactPlaceLabel(places[0], fallback[0]),
    compactPlaceLabel(places[1], fallback[1]),
  ] as const;
};

const pdfRouteStats = (project: Project, language: 'de' | 'en') => {
  const preview = project.track ? routeSurfacePreview(project.track) : null;
  const bySurface = new Map<string, number>();
  let surfaceMeters = 0;

  for (const feature of preview?.features ?? []) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const meters = Number(
      properties.length_m ?? properties['track-length'] ?? 0
    );
    if (!Number.isFinite(meters) || meters <= 0) continue;
    const surface = normalizeSurfaceKey(
      String(properties.surface ?? 'unknown')
    );
    bySurface.set(surface, (bySurface.get(surface) ?? 0) + meters);
    surfaceMeters += meters;
  }

  const declaredTrackLength = Number(
    project.track?.features[0]?.properties?.['track-length'] ?? 0
  );
  const entryLength = project.entries.at(-1)?.distance ?? 0;
  const totalMeters =
    (Number.isFinite(declaredTrackLength) && declaredTrackLength > 0
      ? declaredTrackLength
      : 0) ||
    surfaceMeters ||
    entryLength;

  const surfaces: PdfSurface[] = [...bySurface.entries()]
    .map(([key, meters]) => ({
      key,
      label: getSurfaceLabel(key, language),
      meters,
      percentage: surfaceMeters
        ? Math.max(1, Math.round((meters / surfaceMeters) * 100))
        : 0,
    }))
    .sort((left, right) => right.meters - left.meters);

  return { totalMeters, surfaces };
};

export async function saveRn2(project: Project) {
  const path = await save({
    defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, '-')}.rn2`,
    filters: [{ name: 'Rally Navigator', extensions: ['rn2'] }],
  });
  if (!path) return;
  const completed = await completeRn2Geometry(project, async entry => {
    const p = entry.turn.points[0],
      bounds = detailBounds({ lat: p.latitude, lon: p.longitude });
    return (await osm.query(bounds, 'detail')).features;
  });
  const body = JSON.stringify(exportRn2(completed), null, 2) + '\n';
  await writeTextFile(path, body);
  if (completed !== project) await repository.save(completed);
}

// Project imports are untrusted. Strip scripts, events, external resources and
// unknown elements before rendering saved SVGs or passing them to the PDF library.
export function safeSvg(value: string): string {
  const doc = new DOMParser().parseFromString(value, 'image/svg+xml');
  const allowed = new Set([
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'defs',
    'marker',
    'text',
    'tspan',
    'image',
    'linearGradient',
    'radialGradient',
    'stop',
    'clipPath',
    'mask',
  ]);
  for (const node of Array.from(doc.querySelectorAll('*'))) {
    if (!allowed.has(node.localName)) {
      node.remove();
      continue;
    }
    for (const declaration of (node.getAttribute('style') || '').split(';')) {
      const [name, ...value] = declaration.split(':');
      if (
        [
          'fill',
          'stroke',
          'stroke-width',
          'fill-rule',
          'fill-opacity',
          'stroke-opacity',
          'opacity',
          'stroke-linecap',
          'stroke-linejoin',
          'stroke-dasharray',
          'stop-color',
          'stop-opacity',
          'clip-path',
        ].includes(name.trim())
      )
        node.setAttribute(name.trim(), value.join(':').trim());
    }
    for (const attr of Array.from(node.attributes)) {
      if (
        node.localName === 'image' &&
        ['href', 'xlink:href'].includes(attr.name) &&
        /^data:image\/(png|jpeg);base64,[a-z\d+/=]+$/i.test(attr.value)
      )
        continue;
      if (
        attr.name.startsWith('on') ||
        ['href', 'xlink:href', 'style'].includes(attr.name) ||
        (/url\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))
      )
        node.removeAttribute(attr.name);
    }
  }
  return doc.documentElement?.localName === 'svg'
    ? new XMLSerializer().serializeToString(doc.documentElement)
    : '<svg xmlns="http://www.w3.org/2000/svg"/>';
}
export async function exportProject(project: Project) {
  const path = await save({
    defaultPath: `${project.name}.roadbook.json`,
    filters: [{ name: 'Roadbook-Projekt', extensions: ['json'] }],
  });
  if (path) await writeTextFile(path, JSON.stringify(project, null, 2));
}
export async function exportGpx(project: Project) {
  if (!project.track) throw new Error('Zuerst die Route berechnen.');
  const esc = (s: string) =>
    s.replace(
      /[<>&"']/g,
      c =>
        ({
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&apos;',
        })[c]!
    );
  const body = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="RoadbookNavi" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(project.name)}</name><trkseg>${project.track.features[0].geometry.coordinates.map(c => `<trkpt lat="${c[1]}" lon="${c[0]}"><ele>${Number(c[2]) || 0}</ele></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const path = await save({
    defaultPath: `${project.name}.gpx`,
    filters: [{ name: 'GPX', extensions: ['gpx'] }],
  });
  if (path) await writeTextFile(path, body);
}
export async function renderPdf(
  project: Project,
  mode: 'roll' | 'a5' | 'screen' = 'roll'
): Promise<Uint8Array> {
  if (project.rn2Original) {
    const resolver = await rn2IconResolver(project.rn2Original);
    project = {
      ...project,
      entries: importRn2(JSON.stringify(project.rn2Original), resolver).entries,
    };
  } else if (project.rn2Source) {
    const resolver = await rn2IconResolver(project.rn2Source);
    const originals = importRn2(
      JSON.stringify(project.rn2Source),
      resolver
    ).entries;
    project = {
      ...project,
      entries: project.entries.map(e => {
        const original =
          e.rn2WaypointIndex === undefined
            ? undefined
            : originals.find(o => o.rn2WaypointIndex === e.rn2WaypointIndex);
        return original
          ? { ...e, svg: original.svg, rn2NotesSvg: original.rn2NotesSvg }
          : e;
      }),
    };
  }
  if (!project.entries.length) throw new Error('Zuerst ein Roadbook erzeugen.');
  const pageWidth = 420;
  const titleHeight = 250;
  const entryHeight = 100;
  const totalHeight = titleHeight + project.entries.length * entryHeight + 50;
  // A5 is the download format, roll is the printable continuous format and
  // screen splits the same continuous layout into manageable render chunks.
  const a5 = mode === 'a5';
  const screen = mode === 'screen';
  const pageHeight = a5 ? 595 : screen ? 2050 : Math.min(totalHeight, 14400);

  const unit = (value: number) => value;
  const pdf = new jsPDF({
    unit: 'pt',
    format: [pageWidth, pageHeight],
    orientation: 'portrait',
    compress: true,
    putOnlyUsedFonts: true,
    precision: 4,
  });
  // jsPDF clamps custom page formats at 14,400 pt in its constructor. The
  // existing RoadbookNavi roll exporter intentionally uses taller media boxes,
  // so update the page after construction to keep the same one-page format.
  if (!a5 && !screen && totalHeight > 14400)
    (
      pdf.internal.pageSize as unknown as {
        setHeight: (height: number) => void;
      }
    ).setHeight(totalHeight);

  pdf.setProperties({
    title: project.name,
    subject: 'RoadbookNavi Roadbook',
    creator: 'RoadbookNavi',
  });
  const firstPoint = project.waypoints[0];
  const lastPoint = project.waypoints.at(-1);
  const pdfLanguage: 'de' | 'en' = i18n.resolvedLanguage?.startsWith('de')
    ? 'de'
    : 'en';
  const pdfText = (key: string) => i18n.t(`roadbook:pdf.${key}`);
  const [startLabel, finishLabel] = await pdfLocationLabels(
    firstPoint,
    lastPoint
  );
  const routeStats = pdfRouteStats(project, pdfLanguage);
  const distanceLabel =
    routeStats.totalMeters >= 1000
      ? `${(routeStats.totalMeters / 1000).toFixed(1)} km`
      : `${Math.round(routeStats.totalMeters)} m`;
  const roadbookDate = new Intl.DateTimeFormat(
    pdfLanguage === 'de' ? 'de-DE' : 'en-GB',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  ).format(new Date(project.updatedAt || Date.now()));

  const margin = 20;
  const headerWidth = pageWidth - margin * 2;
  const accent = '#7c3402';
  const muted = '#6b625d';
  const panel = '#f4efeb';

  // Wordmark: position NAVI from ROADBOOK's measured width so the words never
  // overlap with different PDF font metrics.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(unit(12));
  pdf.setTextColor('#191715');
  pdf.text('ROADBOOK', unit(margin), unit(18), { baseline: 'top' });
  const roadbookWordWidth = pdf.getTextWidth('ROADBOOK');
  pdf.setTextColor(accent);
  pdf.text('NAVI', unit(margin + roadbookWordWidth + 5), unit(18), {
    baseline: 'top',
  });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(unit(8));
  pdf.setTextColor(muted);
  pdf.text(roadbookDate, unit(pageWidth - margin), unit(20), {
    align: 'right',
    baseline: 'top',
  });
  pdf.setDrawColor(accent);
  pdf.setLineWidth(unit(2));
  pdf.line(unit(margin), unit(38), unit(pageWidth - margin), unit(38));

  pdf.setTextColor('#191715');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(unit(19));
  const titleLines = pdf.splitTextToSize(project.name, headerWidth).slice(0, 2);
  pdf.text(titleLines, unit(margin), unit(49), {
    baseline: 'top',
    lineHeightFactor: 1.05,
  });

  const cardY = 94;
  const cardHeight = 48;
  const cardGap = 5;
  const cardWidth = (headerWidth - cardGap * 2) / 3;
  const cards = [
    [pdfText('distance'), distanceLabel],
    [pdfText('waypoints'), String(project.waypoints.length)],
    [
      pdfText('profile'),
      project.profile.length > 28
        ? `${project.profile.slice(0, 27)}...`
        : project.profile,
    ],
  ];
  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);
    pdf.setFillColor(panel);
    pdf.roundedRect(
      unit(x),
      unit(cardY),
      unit(cardWidth),
      unit(cardHeight),
      3,
      3,
      'F'
    );
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(unit(6.5));
    pdf.setTextColor(muted);
    pdf.text(label, unit(x + 8), unit(cardY + 8), { baseline: 'top' });
    pdf.setFontSize(unit(index === 3 ? 9 : 13));
    pdf.setTextColor('#191715');
    pdf.text(value, unit(x + 8), unit(cardY + 23), {
      baseline: 'top',
      maxWidth: unit(cardWidth - 16),
    });
  });

  const locationY = 154;
  const locationWidth = (headerWidth - 16) / 2;
  [
    [pdfText('start'), startLabel],
    [pdfText('finish'), finishLabel],
  ].forEach(([label, value], index) => {
    const x = margin + index * (locationWidth + 16);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(unit(6.5));
    pdf.setTextColor(accent);
    pdf.text(label, unit(x), unit(locationY), { baseline: 'top' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(unit(8.5));
    pdf.setTextColor('#191715');
    const locationLines = pdf.splitTextToSize(value, locationWidth).slice(0, 2);
    pdf.text(locationLines, unit(x), unit(locationY + 12), {
      baseline: 'top',
      lineHeightFactor: 1.05,
    });
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(unit(6.5));
  pdf.setTextColor(muted);
  pdf.text(pdfText('surface'), unit(margin), unit(190), { baseline: 'top' });

  const displayedSurfaces = routeStats.surfaces.slice(0, 4);
  const surfaceTotal =
    displayedSurfaces.reduce((sum, surface) => sum + surface.meters, 0) || 1;
  let surfaceX = margin;
  if (!displayedSurfaces.length) {
    pdf.setFillColor('#ddd6d0');
    pdf.roundedRect(
      unit(margin),
      unit(203),
      unit(headerWidth),
      unit(7),
      2,
      2,
      'F'
    );
  } else {
    displayedSurfaces.forEach((surface, index) => {
      const width =
        index === displayedSurfaces.length - 1
          ? margin + headerWidth - surfaceX
          : (surface.meters / surfaceTotal) * headerWidth;
      pdf.setFillColor(surfaceColors[index]);
      pdf.rect(unit(surfaceX), unit(203), unit(width), unit(7), 'F');
      surfaceX += width;
    });
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(unit(7));
  pdf.setTextColor('#3f3935');
  const surfaceText = displayedSurfaces.length
    ? displayedSurfaces
        .map(surface => `${surface.label} ${surface.percentage}%`)
        .join('  ·  ')
    : pdfText('noSurfaceData');
  pdf.text(surfaceText, unit(margin), unit(218), {
    baseline: 'top',
    maxWidth: unit(headerWidth),
  });

  const contentWidth = 410;
  const distanceColWidth = contentWidth * 0.25;
  const turnColWidth = contentWidth * 0.5;

  const drawEntry = async (i: number, x: number, y: number) => {
    const entry = project.entries[i];
    const previous = project.entries[i - 1];
    const next = project.entries[i + 1];
    const closeToPrevious =
      previous !== undefined && entry.distance - previous.distance <= 200;
    const closeToNext =
      next !== undefined && next.distance - entry.distance <= 200;

    // RoadbookPdfViewer reads these invisible markers to map an entry to its
    // PDF position for keyboard navigation and GPS auto-follow.
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(1);
    pdf.text(`#${i + 1}`, x + 1, y + 1, {
      baseline: 'top',
      renderingMode: 'invisible',
    });

    if (closeToPrevious) {
      pdf.setFillColor('#AAFB96');
      pdf.rect(
        unit(x),
        unit(y),
        unit(distanceColWidth),
        unit(entryHeight),
        'F'
      );
    }

    pdf.setDrawColor('#cccccc');
    pdf.setLineWidth(unit(1));
    pdf.rect(unit(x), unit(y), unit(contentWidth), unit(entryHeight), 'S');
    pdf.line(
      unit(x + distanceColWidth),
      unit(y),
      unit(x + distanceColWidth),
      unit(y + entryHeight)
    );
    pdf.line(
      unit(x + distanceColWidth + turnColWidth),
      unit(y),
      unit(x + distanceColWidth + turnColWidth),
      unit(y + entryHeight)
    );

    const distance =
      entry.distance < 1000
        ? { value: Math.round(entry.distance).toString(), unit: 'm' }
        : { value: (entry.distance / 1000).toFixed(1), unit: 'km' };
    const distanceCenter = x + distanceColWidth / 2;
    pdf.setTextColor('#000000');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(unit(32));
    pdf.text(distance.value, unit(distanceCenter), unit(y + 15), {
      align: 'center',
      baseline: 'top',
    });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(unit(14));
    pdf.text(distance.unit, unit(distanceCenter), unit(y + 50), {
      align: 'center',
      baseline: 'top',
    });

    pdf.setFillColor('#000000');
    pdf.rect(unit(x + 5), unit(y + entryHeight - 25), unit(30), unit(20), 'F');
    pdf.setTextColor('#ffffff');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(unit(10));
    pdf.text(String(i + 1), unit(x + 20), unit(y + entryHeight - 21), {
      align: 'center',
      baseline: 'top',
    });

    if (next) {
      const delta = next.distance - entry.distance;
      const deltaText =
        delta < 1000 ? Math.round(delta).toString() : (delta / 1000).toFixed(1);
      pdf.setTextColor('#000000');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(unit(14));
      pdf.text(
        deltaText,
        unit(x + distanceColWidth - 10),
        unit(y + entryHeight - 25),
        { align: 'right', baseline: 'top' }
      );
    }

    if (closeToNext) {
      const centerX = x + distanceColWidth / 2;
      const lineTop = y + entryHeight * 0.5 + 15;
      const lineBottom = y + entryHeight - 2;
      pdf.setDrawColor('#000000');
      pdf.setFillColor('#000000');
      pdf.setLineWidth(unit(1.5));
      pdf.line(unit(centerX), unit(lineTop), unit(centerX), unit(lineBottom));
      pdf.triangle(
        unit(centerX),
        unit(lineBottom),
        unit(centerX - 6),
        unit(lineBottom - 8),
        unit(centerX + 6),
        unit(lineBottom - 8),
        'F'
      );
    }

    const turnX = x + distanceColWidth;
    const svgDoc = new DOMParser().parseFromString(
      safeSvg(entry.svg),
      'image/svg+xml'
    );
    const svg = svgDoc.documentElement;
    // svg2pdf renders the generated route-arrow marker substantially larger
    // than browsers do. Keep the route drawing untouched and reduce only the
    // marker's viewport to the compact RoadbookNavi arrow size.
    for (const marker of Array.from(svg.querySelectorAll('marker'))) {
      marker.setAttribute('markerWidth', '2.4');
      marker.setAttribute('markerHeight', '2.4');
      marker.setAttribute('viewBox', '0 0 14 21');
      marker.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    const sourceViewBox = (svg.getAttribute('viewBox') || '0 0 300 200')
      .trim()
      .split(/[ ,]+/)
      .map(Number);
    if (
      entry.rn2WaypointIndex === undefined &&
      sourceViewBox.length === 4 &&
      sourceViewBox.every(Number.isFinite)
    ) {
      const [sourceX, sourceY, sourceWidth, sourceHeight] = sourceViewBox;
      const viewportWidth = turnColWidth - 20;
      const viewportHeight = entryHeight - 20;
      svg.setAttribute(
        'viewBox',
        `${sourceX + (sourceWidth - viewportWidth) / 2} ${sourceY + (sourceHeight - viewportHeight) / 2} ${viewportWidth} ${viewportHeight}`
      );
    }
    svg.setAttribute('width', String(turnColWidth - 20));
    svg.setAttribute('height', String(entryHeight - 20));
    await pdf.svg(svg, {
      x: unit(turnX + 10),
      y: unit(y + 10),
      width: unit(turnColWidth - 20),
      height: unit(entryHeight - 20),
    });

    if (entry.rn2NotesSvg) {
      const notes = new DOMParser().parseFromString(
        safeSvg(entry.rn2NotesSvg),
        'image/svg+xml'
      ).documentElement;
      await pdf.svg(notes, {
        x: turnX + turnColWidth + 3,
        y: y + 3,
        width: 96,
        height: 72,
      });
    } else if (entry.note) {
      pdf.setTextColor('#000000');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      const allLines: string[] = pdf.splitTextToSize(entry.note, 92);
      const lines = allLines.slice(0, 7);
      if (allLines.length > 7) lines[6] = lines[6].slice(0, -3) + '...';
      pdf.text(lines, unit(turnX + turnColWidth + 5), unit(y + 8), {
        baseline: 'top',
      });
    }
    if (Number.isFinite(entry.turn.bearing)) {
      const infoX = turnX + turnColWidth;
      pdf.setFillColor('#000000');
      pdf.rect(
        unit(infoX),
        unit(y + entryHeight - 20),
        unit(50),
        unit(20),
        'F'
      );
      pdf.setTextColor('#ffffff');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(unit(7));
      pdf.text('CAP', unit(infoX + 3), unit(y + entryHeight - 16), {
        baseline: 'top',
      });
      pdf.setFontSize(unit(10));
      pdf.text(
        `${Math.round(entry.turn.bearing)}°`,
        unit(infoX + 22),
        unit(y + entryHeight - 16),
        { baseline: 'top' }
      );
    }
  };
  if (a5) {
    // Pagination: page one includes the header, followed by at most five entries.
    // Later pages use a compact header and contain at most five entries.
    let y = titleHeight;
    let pageNumber = 1;
    for (let i = 0; i < project.entries.length; i++) {
      if (y + entryHeight > pageHeight - 20) {
        pdf.addPage([pageWidth, pageHeight], 'portrait');
        pageNumber++;
        pdf.setDrawColor('#cccccc');
        pdf.setLineWidth(unit(1));
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(unit(11));
        pdf.setTextColor('#000000');
        pdf.text(project.name, unit(40), unit(30), {
          baseline: 'top',
          maxWidth: unit(280),
        });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(unit(9));
        pdf.text(`Seite ${pageNumber}`, unit(380), unit(30), {
          align: 'right',
          baseline: 'top',
        });
        pdf.line(unit(40), unit(48), unit(380), unit(48));
        y = 60;
      }
      await drawEntry(i, 5, y);
      y += entryHeight;
    }
  } else if (screen) {
    // Keep the roll appearance in the app, but avoid one gigantic canvas.
    // Consecutive PDF pages are displayed without gaps by the viewer.
    let y = titleHeight;
    for (let i = 0; i < project.entries.length; i++) {
      if (y + entryHeight > pageHeight) {
        pdf.addPage([pageWidth, pageHeight], 'portrait');
        y = 0;
      }
      await drawEntry(i, 5, y);
      y += entryHeight;
    }
  } else {
    for (let i = 0; i < project.entries.length; i++)
      await drawEntry(i, 5, titleHeight + i * entryHeight);
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}
export async function exportPdf(
  project: Project,
  mode: 'roll' | 'a5' = 'roll'
) {
  const fileName =
    mode === 'a5' ? `${project.name}.pdf` : `${project.name}-rolle.pdf`;
  const path = await save({
    defaultPath: fileName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (path) await writeFile(path, await renderPdf(project, mode));
}

export async function exportGeojson(project: Project) {
  if (!project.track) throw new Error('Zuerst die Route berechnen.');
  const path = await save({
    defaultPath: `${project.name}.geojson`,
    filters: [{ name: 'GeoJSON', extensions: ['geojson'] }],
  });
  if (path) await writeTextFile(path, JSON.stringify(project.track));
}
