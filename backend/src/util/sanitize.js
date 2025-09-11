// src/util/sanitize.js

/**
 * Convert dotted keys to nested objects and merge parent/child paths to
 * prevent Mongo "path conflict" errors like:
 *   Updating the path '_source' would create a conflict at '_source'
 *
 * - Turns {"_source.scheme": "X"} into {_source: { scheme: "X" }}
 * - If both {_source: {...}} and {"_source.x": ...} exist, merges them.
 * - Leaves scalars/arrays untouched (except for dotted-key conversion).
 */
export function sanitizeForMongo(doc) {
  const out = {};

  // 1) First pass: copy non-dotted keys by value
  for (const [k, v] of Object.entries(doc || {})) {
    if (!k.includes('.')) {
      // simple assign (shallow; nested will be merged later if needed)
      out[k] = v;
    }
  }

  // 2) Second pass: expand dotted keys and deep-merge into out
  for (const [k, v] of Object.entries(doc || {})) {
    if (k.includes('.')) {
      setDeep(out, k.split('.'), v);
    }
  }

  return out;
}

function setDeep(target, pathParts, value) {
  let cur = target;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const p = pathParts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = cur[p];
  }
  const last = pathParts[pathParts.length - 1];

  // If both sides are objects, merge; else overwrite
  if (
    typeof cur[last] === 'object' && cur[last] !== null && !Array.isArray(cur[last]) &&
    typeof value === 'object' && value !== null && !Array.isArray(value)
  ) {
    Object.assign(cur[last], value);
  } else {
    cur[last] = value;
  }
}
