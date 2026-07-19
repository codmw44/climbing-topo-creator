import { FrenchGrade, Route } from '../types';
import { FRENCH_GRADES } from '../constants';
import { readFileFromDir } from './fsApi';

/** One row from a crag's <Name>_routes.csv, the fields the topo creator cares about. */
export type CsvRoute = {
  routeId: number;
  sector: string;
  routeNumber: number | null;
  name: string;
  grade: FrenchGrade;
};

const GRADE_SET = new Set<string>(FRENCH_GRADES);

/** Minimal CSV line splitter — handles quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function normalizeGrade(raw: string): FrenchGrade {
  const g = raw.trim();
  return (GRADE_SET.has(g) ? g : '') as FrenchGrade;
}

/** Parses a crag routes CSV (Route ID, Sector, Route Number, Name of Route, ..., French Grade, ...). */
export function parseRoutesCsv(text: string): CsvRoute[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idIdx = header.indexOf('Route ID');
  const sectorIdx = header.indexOf('Sector');
  const numberIdx = header.indexOf('Route Number');
  const nameIdx = header.indexOf('Name of Route');
  const gradeIdx = header.indexOf('French Grade');
  if (nameIdx === -1) return [];

  const rows: CsvRoute[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const name = (cols[nameIdx] ?? '').trim();
    if (!name) continue;
    const numRaw = numberIdx !== -1 ? (cols[numberIdx] ?? '').trim() : '';
    const num = numRaw === '' ? null : parseInt(numRaw, 10);
    // Fall back to the CSV row's own line number if a file predates the
    // Route ID column — keeps the picker usable even before migration.
    const idRaw = idIdx !== -1 ? (cols[idIdx] ?? '').trim() : '';
    const routeId = idRaw !== '' && !Number.isNaN(parseInt(idRaw, 10)) ? parseInt(idRaw, 10) : i;
    rows.push({
      routeId,
      sector: sectorIdx !== -1 ? (cols[sectorIdx] ?? '').trim() : '',
      routeNumber: num !== null && !Number.isNaN(num) ? num : null,
      name,
      grade: gradeIdx !== -1 ? normalizeGrade(cols[gradeIdx] ?? '') : ('' as FrenchGrade),
    });
  }
  return rows;
}

/** Looks up a CSV route by its Route ID — O(1) via a Map built once per CSV load. */
export function buildCsvRouteIndex(csvRoutes: CsvRoute[]): Map<number, CsvRoute> {
  return new Map(csvRoutes.map((r) => [r.routeId, r]));
}

/**
 * Refreshes every linked route's name/number/grade from its Route ID's current
 * CSV row — the CSV is the source of truth once a route is linked, so this is
 * called on topo open and again right before export so edits made in the CSV
 * always win. Routes with no `routeId` (never linked) are returned unchanged.
 * A `routeId` that no longer resolves in the CSV (row deleted/renumbered) is
 * also left unchanged, since silently unlinking would lose the route's own
 * name/grade with no way back — surfaced to the caller via `staleRouteIds` so
 * the UI can flag it instead.
 */
export function refreshRoutesFromCsv(
  routes: Route[],
  csvRoutes: CsvRoute[],
): { routes: Route[]; staleRouteIds: number[] } {
  const index = buildCsvRouteIndex(csvRoutes);
  const staleRouteIds: number[] = [];
  const refreshed = routes.map((route) => {
    if (route.routeId == null) return route;
    const csvRoute = index.get(route.routeId);
    if (!csvRoute) {
      staleRouteIds.push(route.routeId);
      return route;
    }
    return {
      ...route,
      name: csvRoute.name,
      numberOverride: csvRoute.routeNumber ?? undefined,
      grade: csvRoute.grade,
    };
  });
  return { routes: refreshed, staleRouteIds };
}

/** Looks directly inside `dirHandle` for a *_routes.csv file and parses it, if found. */
async function findCsvInDir(dirHandle: FileSystemDirectoryHandle): Promise<CsvRoute[] | null> {
  // @ts-expect-error — AsyncIterable iteration not in TS DOM types yet
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && /_routes\.csv$/i.test(entry.name)) {
      const file = await readFileFromDir(dirHandle, entry.name);
      if (!file) continue;
      return parseRoutesCsv(await file.text());
    }
  }
  return null;
}

/**
 * Finds and parses the crag's <Name>_routes.csv for an open image, checking the
 * image's own directory first, then walking upward through its ancestors up to
 * (and including) `rootHandle` — a crag's routes CSV commonly lives one level
 * above image subfolders (e.g. crags/La_Gorgette/La_Gorgette_routes.csv next to
 * a nested crags/La_Gorgette/16JulLaGorgette/ photo folder). Returns [] if no
 * CSV is found anywhere along that chain.
 */
export async function loadCragCsv(
  imageDirHandle: FileSystemDirectoryHandle | null,
  rootHandle: FileSystemDirectoryHandle | null,
): Promise<CsvRoute[]> {
  if (!imageDirHandle) return [];

  const direct = await findCsvInDir(imageDirHandle);
  if (direct) return direct;
  if (!rootHandle) return [];

  const pathSegments: string[] | null = await rootHandle.resolve(imageDirHandle);
  if (!pathSegments) return [];

  // Walk from the image's parent directory up to (but not including) root,
  // checking each ancestor for a routes CSV — nearest ancestor wins.
  let dir = rootHandle;
  const ancestors: FileSystemDirectoryHandle[] = [];
  for (const segment of pathSegments) {
    dir = await dir.getDirectoryHandle(segment);
    ancestors.push(dir);
  }
  ancestors.pop(); // drop the image's own directory — already checked above
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const found = await findCsvInDir(ancestors[i]);
    if (found) return found;
  }
  return (await findCsvInDir(rootHandle)) ?? [];
}
