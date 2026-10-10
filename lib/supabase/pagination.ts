/**
 * Supabase/PostgREST returns at most `db-max-rows` (1000 by default) per request.
 * The question bank is imported from large CSVs, so any unpaginated select here
 * silently returns a truncated slice and the analytics built on top of it are wrong.
 * These helpers page through the full result set instead.
 */

export const SUPABASE_PAGE_SIZE = 1000;

/** Guard against an unbounded loop if a query keeps returning full pages. */
const MAX_FETCHED_ROWS = 200000;

type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * Repeatedly calls `buildQuery` with a growing range until a short page comes back.
 * `buildQuery` must apply a stable `.order(...)` or rows can repeat across pages.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < MAX_FETCHED_ROWS; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

/**
 * `.in("col", ids)` is sent as a query string, so a few thousand attempt ids
 * overflow the request URL. Split the id list into request-sized batches.
 */
export function chunkIds<T>(ids: T[], size = 200): T[][] {
  if (ids.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

/** Runs a paginated fetch for each id batch and concatenates the results. */
export async function fetchAllRowsForIds<T, Id>(
  ids: Id[],
  buildQuery: (idChunk: Id[], from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];

  for (const idChunk of chunkIds(ids)) {
    const chunkRows = await fetchAllRows<T>((from, to) => buildQuery(idChunk, from, to), pageSize);
    rows.push(...chunkRows);
  }

  return rows;
}
