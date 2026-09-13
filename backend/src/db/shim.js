/**
 * Lightweight Mongoose-compatible shim backed by Supabase PostgREST.
 *
 * Covers every Mongoose pattern actually used in the FundiLink backend:
 *   find / findOne / findById + .sort/.select/.skip/.limit/.populate
 *   create / insertMany / new Model(data).save() (diff-based save)
 *   findOneAndUpdate / findByIdAndUpdate / updateOne / updateMany
 *   deleteOne / deleteMany / findByIdAndDelete / findOneAndDelete
 *   countDocuments
 *   aggregate (in-memory stage executor for the admin/analytics pipelines used)
 *
 * Returned documents carry both `id` and `_id` (mirroring Mongoose virtuals)
 * and are model instances with a working `.save()`, so controllers, routes,
 * services and the socket layer require no changes.
 */

const { getSupabase } = require("../config/supabase");

/* ------------------------------------------------------------------ */
/*  Registry (lazy, circular-safe)                                    */
/* ------------------------------------------------------------------ */

const _registry = {};
function registerModel(name, model) { _registry[name] = model; }
function getModel(name) {
  const m = _registry[name];
  if (!m) throw new Error(`Model "${name}" not registered in shim`);
  return m;
}

/* ------------------------------------------------------------------ */
/*  Field/column mapping helpers                                      */
/* ------------------------------------------------------------------ */

const TS_TO_COL = { createdAt: "created_at", updatedAt: "updated_at" };
const COL_TO_TS = { created_at: "createdAt", updated_at: "updatedAt" };
const ID_TO_COL = { _id: "id" };

function keyToCol(key) {
  return TS_TO_COL[key] || ID_TO_COL[key] || key;
}

function isTimestampCol(name) {
  return name === "createdAt" || name === "updatedAt" || name === "created_at" || name === "updated_at";
}

/* ------------------------------------------------------------------ */
/*  Small utilities                                                   */
/* ------------------------------------------------------------------ */

function stripUndefined(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  return JSON.parse(JSON.stringify(obj));
}

function nowIso() { return new Date().toISOString(); }

function camify(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const [snake, camel] of Object.entries(COL_TO_TS)) {
    if (snake in out) out[camel] = out[snake];
  }
  return out;
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const aTime = a instanceof Date ? a.getTime() : (typeof a === "string" && !Number.isNaN(Date.parse(a)) ? Date.parse(a) : NaN);
  const bTime = b instanceof Date ? b.getTime() : (typeof b === "string" && !Number.isNaN(Date.parse(b)) ? Date.parse(b) : NaN);
  if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/* ------------------------------------------------------------------ */
/*  Query evaluation                                                   *
/* ------------------------------------------------------------------ */

function isSimpleFilter(key, val) {
  if (val === null || val === undefined) return true;
  if (typeof val !== "object" || Array.isArray(val)) return true;
  const keys = Object.keys(val);
  return keys.length === 1 && ["$in", "$ne", "$eq", "$gt", "$gte", "$lt", "$lte"].includes(keys[0]);
}

function evalCondition(doc, key, val) {
  const field = doc[key];
  if (val === null || val === undefined) return field === undefined || field === null;
  if (typeof val !== "object" || Array.isArray(val)) {
    if (Array.isArray(field)) return field.includes(val);
    return field === val;
  }
  const entries = Object.entries(val);
  if (entries.length === 0) return true;
  const [op, operand] = entries[0];
  switch (op) {
    case "$in": {
      if (!Array.isArray(operand)) return false;
      if (Array.isArray(field)) return operand.some((v) => field.includes(v));
      return operand.includes(field);
    }
    case "$nin": {
      if (!Array.isArray(operand)) return true;
      if (Array.isArray(field)) return !operand.some((v) => field.includes(v));
      return !operand.includes(field);
    }
    case "$ne": return field !== operand;
    case "$eq": return field === operand;
    case "$gt": return compareValues(field, operand) > 0;
    case "$gte": return compareValues(field, operand) >= 0;
    case "$lt": return compareValues(field, operand) < 0;
    case "$lte": return compareValues(field, operand) <= 0;
    case "$regex": {
      if (field == null) return false;
      const re = new RegExp(operand, val.$options || "");
      return re.test(String(field));
    }
    case "$exists":
      return operand ? field !== undefined && field !== null : field === undefined || field === null;
    default:
      return true;
  }
}

function evalQuery(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;
  if (query.$or) return query.$or.some((sub) => evalQuery(doc, sub));
  if (query.$and) return query.$and.every((sub) => evalQuery(doc, sub));

  for (const [key, val] of Object.entries(query)) {
    // Dot-paths into nested objects (and arrays of objects, e.g. notifiedFundis)
    if (key.includes(".")) {
      const parts = key.split(".");
      const vals = [];
      (function walk(node, i) {
        if (node == null) return;
        if (i === parts.length) { vals.push(node); return; }
        if (Array.isArray(node)) {
          for (const item of node) walk(item, i);
        } else {
          walk(node[parts[i]], i + 1);
        }
      })(doc, 0);
      if (!vals.some((v) => evalCondition({ v }, "v", val))) return false;
      continue;
    }

    const field = doc[key];

    // Array shape matchers
    if (val && typeof val === "object" && !Array.isArray(val)) {
      if (val.$all !== undefined && val.$size !== undefined) {
        if (!Array.isArray(field) || field.length !== val.$size) return false;
        if (!val.$all.every((v) => field.includes(v))) return false;
        continue;
      }
      if (val.$all !== undefined) {
        if (!Array.isArray(field) || !val.$all.every((v) => field.includes(v))) return false;
        continue;
      }
      if (val.$size !== undefined) {
        if (!Array.isArray(field) || field.length !== val.$size) return false;
        continue;
      }
    }

    if (!evalCondition(doc, key, val)) return false;
  }
  return true;
}

/* Pipeline expression evaluator (for $group accumulators). */
function evalPipelineExpr(doc, expr) {
  if (Array.isArray(expr)) {
    if (expr.length === 1 && typeof expr[0] === "string" && expr[0].startsWith("$")) {
      const v = doc[expr[0].slice(1)];
      return [v];
    }
    return expr.map((e) => evalPipelineExpr(doc, e));
  }
  if (expr && typeof expr === "object") {
    if (expr.$eq) return evalPipelineExpr(doc, expr.$eq[0]) === evalPipelineExpr(doc, expr.$eq[1]);
    if (expr.$ne) return evalPipelineExpr(doc, expr.$ne[0]) !== evalPipelineExpr(doc, expr.$ne[1]);
    if (expr.$cond) {
      return evalPipelineExpr(doc, expr.$cond[0])
        ? evalPipelineExpr(doc, expr.$cond[1])
        : evalPipelineExpr(doc, expr.$cond[2]);
    }
    if (expr.$sum) return evalPipelineExpr(doc, expr.$sum);
    if (expr.$avg) return evalPipelineExpr(doc, expr.$avg);
    return expr;
  }
  if (typeof expr === "string" && expr.startsWith("$")) {
    return doc[expr.slice(1)];
  }
  return expr;
}

/* ------------------------------------------------------------------ */
/*  Projection (`.select`)                                            */
/* ------------------------------------------------------------------ */

function applyProjection(source, select) {
  if (!select) return { ...source };
  const d = { ...source };
  const tokens = select.split(/\s+/).filter(Boolean);
  if (!tokens.length) return d;

  if (tokens[0].startsWith("-")) {
    for (const t of tokens) {
      const key = keyToCol(t.replace(/^-/, ""));
      if (key === "id") continue;
      delete d[key];
    }
  } else {
    const keep = new Set(tokens.map((t) => keyToCol(t)));
    keep.add("id");
    for (const key of Object.keys(d)) {
      if (!keep.has(key) && key !== "_id" && key !== "id") delete d[key];
    }
  }
  return d;
}

/* ------------------------------------------------------------------ */
/*  Where classification                                              */
/* ------------------------------------------------------------------ */

/** Split a Mongoose query into: simple SQL filters, array-contains filters, JS conditions. */
function classifyQuery(query, arrayColumns, refs) {
  const sqlFilters = {};
  const containsFilters = [];
  const orFilters = [];
  const jsConditions = [];

  if (!query) return { sqlFilters, containsFilters, orFilters, jsConditions };

  for (const [key, val] of Object.entries(query)) {
    if (key === "$or") {
      const orStr = buildOrFilter(val, arrayColumns);
      if (orStr) orFilters.push(orStr);
      else jsConditions.push([key, val]);
      continue;
    }
    if (key === "$and") {
      jsConditions.push([key, val]);
      continue;
    }
    if (key.includes(".")) { jsConditions.push([key, val]); continue; }

    // Array columns: scalar → SQL contains; operator objects (e.g. $in overlap) → JS
    if (arrayColumns.includes(key)) {
      if (val !== null && typeof val === "object" && !Array.isArray(val)) { jsConditions.push([key, val]); continue; }
      containsFilters.push([key, val]);
      continue;
    }

    if (isJsCondition(key, val)) { jsConditions.push([key, val]); continue; }

    sqlFilters[key] = val;
  }

  return { sqlFilters, containsFilters, orFilters, jsConditions };
}

/** Build a PostgREST .or() expression when every element is a scalar equality. */
function buildOrFilter(orArr, arrayColumns) {
  if (!Array.isArray(orArr) || !orArr.length) return null;
  const parts = [];
  for (const sub of orArr) {
    const keys = Object.keys(sub || {});
    if (keys.length !== 1) return null;
    const k = keys[0];
    const v = sub[k];
    if (k === "$or" || k === "$and" || k.includes(".")) return null;
    if (arrayColumns.includes(k)) return null;
    if (v === null || typeof v === "object") return null;
    if (typeof v === "string" && /[.,]/.test(v)) return null;
    parts.push(`${keyToCol(k)}.eq.${v}`);
  }
  return parts.join(",");
}

function isJsCondition(key, val) {
  if (val === null || val === undefined) return false;
  if (typeof val !== "object" || Array.isArray(val)) return false;
  return !isSimpleFilter(key, val);
}

/* ------------------------------------------------------------------ */
/*  Supabase builder helpers                                          */
/* ------------------------------------------------------------------ */

function applySimpleFilter(builder, key, val) {
  const col = keyToCol(key);
  if (val === null || val === undefined) return builder.is(col, null);
  if (typeof val !== "object" || Array.isArray(val)) return builder.eq(col, val);
  const entries = Object.entries(val);
  if (entries.length === 0) return builder;
  const [op, operand] = entries[0];
  switch (op) {
    case "$in": return builder.in(col, operand);
    case "$ne": return builder.neq(col, operand);
    case "$gt": return builder.gt(col, operand);
    case "$gte": return builder.gte(col, operand);
    case "$lt": return builder.lt(col, operand);
    case "$lte": return builder.lte(col, operand);
    case "$eq": return builder.eq(col, operand);
    default: return builder;
  }
}

function orderBy(builder, sort) {
  if (sort && Object.keys(sort).length) {
    for (const [key, dir] of Object.entries(sort)) {
      builder = builder.order(keyToCol(key), { ascending: dir === 1 || dir === "asc" });
    }
    return builder;
  }
  return builder.order("created_at", { ascending: false });
}

function paginate(builder, skipVal, limitVal) {
  if (skipVal != null && limitVal != null) {
    return builder.range(Number(skipVal), Number(skipVal) + Number(limitVal) - 1);
  }
  if (limitVal != null) return builder.limit(Number(limitVal));
  return builder;
}

function jsSort(rows, sort) {
  if (!sort || !Object.keys(sort).length) return rows;
  const keys = Object.entries(sort);
  return [...rows].sort((a, b) => {
    for (const [k, dir] of keys) {
      if (k === "_id" || k === "id") {
        const va = String(a._id || a.id || ""), vb = String(b._id || b.id || "");
        if (va !== vb) return va < vb ? (dir === 1 ? -1 : 1) : (dir === 1 ? 1 : -1);
        continue;
      }
      const va = a[k], vb = b[k];
      if (va == null && vb == null) continue;
      if (va == null) return dir === 1 ? 1 : -1;
      if (vb == null) return dir === 1 ? -1 : 1;
      const c = compareValues(va, vb);
      if (c !== 0) return dir === 1 ? c : -c;
    }
    return 0;
  });
}

function jsSlice(rows, skipVal, limitVal) {
  let out = rows;
  if (skipVal != null) out = out.slice(Number(skipVal));
  if (limitVal != null) out = out.slice(0, Number(limitVal));
  return out;
}

/* ------------------------------------------------------------------ */
/*  Model factory                                                     */
/* ------------------------------------------------------------------ */

function createModel(config) {
  const {
    tableName,
    name,
    timestamps = true,
    arrayColumns = [],
    refs = {},
    upsertConflict,
  } = config;

  /* ---- internal fetch primitives ---- */

  async function rawFind(query = {}) {
    const { sqlFilters, containsFilters, orFilters, jsConditions } = classifyQuery(query, arrayColumns, refs);

    let builder = getSupabase().from(tableName).select("*");
    for (const [key, val] of Object.entries(sqlFilters)) builder = applySimpleFilter(builder, key, val);
    for (const [key, val] of containsFilters) builder = builder.contains(keyToCol(key), Array.isArray(val) ? val : [val]);
    if (orFilters.length) builder = builder.or(orFilters.join(","));

    let rows;
    if (jsConditions.length) {
      const { data, error } = await builder;
      if (error) throw error;
      rows = (data || []).filter((r) => evalQuery(r, Object.fromEntries(jsConditions)));
    } else {
      const { data, error } = await builder;
      if (error) throw error;
      rows = data || [];
    }
    return rows.map((r) => camify(r));
  }

  /* ---- populate ---- */

  async function doPopulate(docs, populateSpecs) {
    if (!populateSpecs?.length || !docs.length) return;
    const specs = populateSpecs.map((s) =>
      typeof s === "string"
        ? { path: s, select: null, match: null }
        : { path: s.path, select: s.select ?? null, match: s.match ?? null }
    );

    for (const spec of specs) {
      const target = refs[spec.path];
      if (!target) continue;
      const targetModel = getModel(target);

      // Collect referenced ids per doc
      const wanted = new Map(); // id -> count of occurrences
      for (const doc of docs) {
        const val = doc[spec.path];
        if (val == null) continue;
        const ids = Array.isArray(val) ? val : [val];
        for (const id of ids) {
          const sid = String(id);
          if (!sid) continue;
          wanted.set(sid, (wanted.get(sid) || 0) + 1);
        }
      }
      if (!wanted.size) continue;

      const refRows = await targetModel.__rawFind({ _id: { $in: [...wanted.keys()] } });
      const refMap = new Map(refRows.map((r) => [String(r.id), r]));

      for (const doc of docs) {
        const val = doc[spec.path];
        if (val == null) continue;

        const resolve = (id) => {
          let ref = refMap.get(String(id));
          if (!ref || (spec.match && !evalQuery(ref, spec.match))) return null;
          if (spec.select) ref = applyProjection(ref, spec.select);
          return { ...ref, _id: ref.id, id: ref.id };
        };

        if (Array.isArray(val)) {
          doc[spec.path] = val.map(resolve);
        } else {
          doc[spec.path] = resolve(val);
        }
      }
    }
  }

  /* ---- find pipeline ---- */

  async function doFind(query, populateSpecs, selectStr, sort, limit, skip) {
    const { sqlFilters, containsFilters, orFilters, jsConditions } = classifyQuery(query, arrayColumns, refs);
    const needsJsPagination = jsConditions.length > 0;

    let builder = getSupabase().from(tableName).select("*");
    for (const [key, val] of Object.entries(sqlFilters)) builder = applySimpleFilter(builder, key, val);
    for (const [key, val] of containsFilters) builder = builder.contains(keyToCol(key), Array.isArray(val) ? val : [val]);
    if (orFilters.length) builder = builder.or(orFilters.join(","));

    if (!needsJsPagination) {
      builder = orderBy(builder, sort);
      builder = paginate(builder, skip, limit);
    }

    const { data, error } = await builder;
    if (error) throw error;

    let rows = (data || []).map((r) => camify(r));

    if (jsConditions.length) rows = rows.filter((r) => evalQuery(r, Object.fromEntries(jsConditions)));
    if (sort && Object.keys(sort).length) rows = jsSort(rows, sort);
    if (needsJsPagination) rows = jsSlice(rows, skip, limit);

    await doPopulate(rows, populateSpecs);

    if (selectStr) rows = rows.map((r) => applyProjection(r, selectStr));

    return rows.map((r) => docFromRow(r));
  }

  /* ---- query builder (chainable & thenable) ---- */

  function makeFindQuery(query, populateSpecs, selectStr, sort, limit, skip) {
    const chain = {
      sort(obj) {
        let norm = obj;
        if (typeof obj === "string") {
          norm = {};
          for (const f of obj.split(/\s+/).filter(Boolean)) {
            if (f.startsWith("-")) norm[f.slice(1)] = -1;
            else norm[f] = 1;
          }
        }
        return makeFindQuery(query, populateSpecs, selectStr, { ...(sort || {}), ...norm }, limit, skip);
      },
      select(s) { return makeFindQuery(query, populateSpecs, s, sort, limit, skip); },
      limit(n) { return makeFindQuery(query, populateSpecs, selectStr, sort, n, skip); },
      skip(n) { return makeFindQuery(query, populateSpecs, selectStr, sort, limit, n); },
      populate(s, select) {
        const spec = typeof s === "string"
          ? { path: s, select: select || null, match: null }
          : (typeof s === "object" ? { ...s, select: s.select || select || null, match: s.match ?? null } : null);
        return makeFindQuery(query, [...(populateSpecs || []), spec].filter(Boolean), selectStr, sort, limit, skip);
      },
      async exec() { return doFind(query, populateSpecs, selectStr, sort, limit, skip); },
      then(resolve, reject) { return doFind(query, populateSpecs, selectStr, sort, limit, skip).then(resolve, reject); },
      catch(fn) { return doFind(query, populateSpecs, selectStr, sort, limit, skip).catch(fn); },
      async countEstimated() { const rows = await doFind(query, populateSpecs, selectStr, sort, limit, skip); return Array.isArray(rows) ? rows.length : 1; },
    };
    return chain;
  }

  function makeSingleQuery(run, query, populateSpecs = []) {
    async function resolveSingle() {
      const out = await run();
      if (out == null) return null;
      const single = Array.isArray(out) ? (out[0] || null) : out;
      if (single == null) return null;
      if (populateSpecs.length) await doPopulate([single], populateSpecs);
      return docFromRow(single);
    }

    const chain = {
      populate(s, select) {
        const spec = typeof s === "string"
          ? { path: s, select: select || null, match: null }
          : (typeof s === "object" ? { ...s, select: s.select || select || null, match: s.match ?? null } : null);
        return makeSingleQuery(run, query, [...populateSpecs, spec].filter(Boolean));
      },
      select(s) {
        return makeSingleQuery(async () => {
          const single = await resolveSingle();
          return single == null ? null : applyProjection(single, s);
        }, query);
      },
      then(resolve, reject) {
        return this.exec().then((out) => (resolve ? resolve(out) : null), reject);
      },
      catch(fn) { return this.exec().catch(fn); },
      async exec() { return resolveSingle(); },
    };
    return chain;
  }

  /* ---- Document class ---- */

  const Document = class Document {
    constructor(data = {}) {
      const src = { ...data };
      if (src.id != null && src._id == null) src._id = src.id;
      for (const [k, v] of Object.entries(src)) {
        if (k === "__snapshot" || k === "__isNew" || k === "id") continue;
        this[k] = v;
      }
      Object.defineProperty(this, "id", {
        get: () => this._id,
        set: (v) => { this._id = v; },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(this, "__isNew", { value: this._id == null, writable: true, configurable: true });
      if (this._id == null && src._id != null) this._id = src._id;
    }

    get id() { return this._id; }
    set id(v) { this._id = v; }

    __toPlain() {
      const out = {};
      for (const k of Object.keys(this)) {
        if (k === "__isNew" || k === "__snapshot" || k === "id") continue;
        out[k] = this[k];
      }
      if (out._id == null) out._id = this._id;
      if (this._id != null) out.id = this._id;
      return out;
    }

    toObject() { return this.__toPlain(); }
    toJSON() { return this.__toPlain(); }

    async save() {
      const plain = this.__toPlain();
      const now = nowIso();

      if (!this._id) {
        // INSERT
        const row = stripUndefined({ ...plain });
        delete row.id; delete row._id;
        if (timestamps) {
          row.created_at = plain.createdAt || now;
          row.updated_at = plain.updatedAt || now;
          delete row.createdAt;
          delete row.updatedAt;
        }
        const { data, error } = await getSupabase().from(tableName).upsert(row, { onConflict: upsertConflict }).select().single();
        if (error) throw error;
        const merged = camify(data);
        this._id = merged.id;
        for (const [k, v] of Object.entries(merged)) this[k] = v;
        this.__isNew = false;
        this.__snapshot = deepClone(this.__toPlain());
        return this;
      }

      // UPDATE via diff
      const orig = this.__snapshot || this.__toPlain();
      const patch = {};
      for (const [k, v] of Object.entries(plain)) {
        if (k === "_id" || k === "id" || k === "__isNew" || k === "__snapshot") continue;
        if (isTimestampCol(k)) continue;
        if (JSON.stringify(v) !== JSON.stringify(orig[k])) patch[k] = v;
      }

      if (Object.keys(patch).length === 0) return this;

      if (timestamps) patch.updatedAt = now;
      const row = { ...patch };
      if (row.createdAt) { row.created_at = row.createdAt; delete row.createdAt; }
      if (row.updatedAt) { row.updated_at = row.updatedAt; delete row.updatedAt; }

      const { error } = await getSupabase().from(tableName).update(row).eq("id", this._id);
      if (error) throw error;
      if (timestamps) this.updatedAt = now;
      this.__snapshot = deepClone(this.__toPlain());
      return this;
    }

    async delete() { return Model.deleteOne({ _id: this._id }); }
  };

  function docFromRow(row) {
    if (!row) return null;
    const doc = new Document(row);
    Object.defineProperty(doc, "__snapshot", { value: deepClone(doc.__toPlain()), writable: true, configurable: true });
    doc.__isNew = false;
    return doc;
  }

  /* ---- update helpers ---- */

  function computePatch(original, update) {
    if (!update || typeof update !== "object") return {};
    const hasOps = Object.keys(update).some((k) => k.startsWith("$"));
    if (!hasOps) return stripUndefined({ ...update });

    const patch = {};
    for (const [op, fields] of Object.entries(update)) {
      if (!fields || typeof fields !== "object") continue;
      for (const [key, val] of Object.entries(fields)) {
        if (op === "$set") patch[key] = val;
        else if (op === "$inc") patch[key] = (original?.[key] ?? 0) + Number(val);
        else if (op === "$push") {
          const list = Array.isArray(original?.[key]) ? [...original[key]] : [];
          if (val && Array.isArray(val.$each)) list.push(...val.$each);
          else list.push(val);
          patch[key] = list;
        } else if (op === "$pull") {
          const list = Array.isArray(original?.[key]) ? [...original[key]] : [];
          if (val && Array.isArray(val.$each)) patch[key] = list.filter((v) => !val.$each.includes(v));
          else patch[key] = list.filter((v) => v !== val);
        }
      }
    }
    return patch;
  }

  async function findAndUpdate(query, update, opts = {}) {
    const existing = await rawFind(query).then((rows) => rows[0] || null);

    if (!existing && opts.upsert) {
      const base = { ...query };
      delete base.$or; delete base.$and;
      for (const [k, v] of Object.entries(base)) {
        if (v !== null && typeof v === "object" && !Array.isArray(v) && !v.$in) delete base[k];
      }
      const patch = computePatch({}, update);
      const created = await Model.create({ ...stripUndefined(base), ...patch });
      return created;
    }

    if (!existing) return null;

    const patch = computePatch(existing, update);
    const id = existing.id;
    if (Object.keys(patch).length > 0) {
      const row = { ...patch };
      if (row.createdAt) { row.created_at = row.createdAt; delete row.createdAt; }
      if (row.updatedAt) { row.updated_at = row.updatedAt; delete row.updatedAt; }
      if (timestamps && !isTimestampCol(String(Object.keys(row)[0] || ""))) row.updated_at = nowIso();
      const { error } = await getSupabase().from(tableName).update(stripUndefined({ ...row, updated_at: row.updated_at || nowIso() })).eq("id", id);
      if (error) throw error;
    }

    const fresh = await rawFind({ _id: id }).then((rows) => rows[0] || null);
    return fresh ? docFromRow(fresh) : null;
  }

  async function updateWhere(query, update) {
    const rows = await rawFind(query);
    const patch = computePatch({}, update);
    delete patch.id; delete patch._id;
    if (timestamps && Object.keys(patch).length) patch.updatedAt = nowIso();
    const row = { ...patch };
    if (row.createdAt) { row.created_at = row.createdAt; delete row.createdAt; }
    if (row.updatedAt) { row.updated_at = row.updatedAt; delete row.updatedAt; }

    if (Object.keys(row).length === 0) return { matchedCount: rows.length, modifiedCount: 0 };

    for (const r of rows) {
      const { error } = await getSupabase().from(tableName).update(row).eq("id", r.id);
      if (error) throw error;
    }
    return { matchedCount: rows.length, modifiedCount: rows.length };
  }

  /* ---- aggregate ---- */

  async function aggregate(pipeline) {
    let rows = await rawFind({});

    for (const stage of pipeline) {
      if (stage.$match) {
        rows = rows.filter((row) => evalQuery(row, stage.$match));
      }

      if (stage.$group) {
        const groups = new Map();
        const groupKey = (doc, expr) => {
          if (expr == null) return null;
          if (typeof expr === "object" && expr.$dateToString) {
            const d = doc[expr.$dateToString.date.slice(1)];
            if (!d) return null;
            const date = new Date(d);
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            if (expr.$dateToString.format === "%Y-%m") return `${y}-${m}`;
            return `${y}-${m}-${day}`;
          }
          if (typeof expr === "string" && expr.startsWith("$")) return doc[expr.slice(1)];
          return expr;
        };
        const avgCountKey = (field) => `__avg_cnt_${field}`;

        for (const doc of rows) {
          const key = groupKey(doc, stage.$group._id);
          const kStr = JSON.stringify(key);
          if (!groups.has(kStr)) {
            const init = { _id: key };
            for (const [field, accum] of Object.entries(stage.$group)) {
              if (field === "_id") continue;
              if (accum && typeof accum === "object") {
                if (accum.$avg) { init[field] = 0; init[avgCountKey(field)] = 0; }
                else if (accum.$sum) init[field] = 0;
                else init[field] = null;
              } else init[field] = null;
            }
            groups.set(kStr, init);
          }
          const g = groups.get(kStr);
          for (const [field, accum] of Object.entries(stage.$group)) {
            if (field === "_id" || !(accum && typeof accum === "object")) continue;
            if (accum.$avg) {
              const v = evalPipelineExpr(doc, accum.$avg);
              if (typeof v === "number") {
                g[field] = (g[field] ?? 0) + v;
                g[avgCountKey(field)] = (g[avgCountKey(field)] ?? 0) + 1;
              }
            } else if (accum.$sum) {
              g[field] = (g[field] ?? 0) + Number(evalPipelineExpr(doc, accum.$sum));
            }
          }
        }

        for (const g of groups.values()) {
          for (const [field, accum] of Object.entries(stage.$group)) {
            if (field === "_id" || !(accum && typeof accum === "object")) continue;
            if (accum.$avg) {
              const cnt = g[avgCountKey(field)] || 0;
              g[field] = cnt ? +(g[field] / cnt).toFixed(2) : 0;
              delete g[avgCountKey(field)];
            }
          }
        }
        rows = [...groups.values()];
      }

      if (stage.$sort) rows = jsSort(rows, stage.$sort);
      if (stage.$limit) rows = rows.slice(0, stage.$limit);
    }

    return rows;
  }

  /* ---- Model API ---- */

  const modelStatics = {
    name,
    tableName,
    __register() { registerModel(name, Model); },

    find(query = {}) { return makeFindQuery(query, [], null, null, null, null); },

    findOne(query = {}) {
      return makeSingleQuery(() => doFind(query, [], null, null, 1, null), query);
    },

    findById(id) {
      if (!id) return makeSingleQuery(() => Promise.resolve([]), {});
      return makeSingleQuery(() => doFind({ _id: String(id) }, [], null, null, 1, null), { _id: id });
    },

    async create(data) {
      const src = stripUndefined({ ...data });
      if (src._id != null && src.id == null) src.id = src._id;
      delete src._id;
      if (src.id != null) src.id = String(src.id);
      if (timestamps) {
        const now = nowIso();
        src.created_at = src.created_at || src.createdAt || now;
        src.updated_at = src.updated_at || src.updatedAt || now;
        delete src.createdAt;
        delete src.updatedAt;
      }
      const { data: row, error } = await getSupabase().from(tableName).insert(src).select().single();
      if (error) throw error;
      return docFromRow(camify(row));
    },

    async insertMany(arr) {
      const now = nowIso();
      const rows = arr.map((d) => {
        const src = stripUndefined({ ...d });
        if (src._id != null && src.id == null) src.id = src._id;
        delete src._id;
        if (src.id != null) src.id = String(src.id);
        if (timestamps) {
          src.created_at = src.created_at || src.createdAt || now;
          src.updated_at = src.updated_at || src.updatedAt || now;
          delete src.createdAt;
          delete src.updatedAt;
        }
        return src;
      });
      const { data, error } = await getSupabase().from(tableName).insert(rows).select();
      if (error) throw error;
      return (data || []).map((r) => docFromRow(camify(r)));
    },

    findOneAndUpdate(query, update, opts = {}) {
      const safeOpts = (opts && typeof opts === "object" && !Array.isArray(opts)) ? opts : {};
      return makeSingleQuery(() => findAndUpdate(query, update, safeOpts), query);
    },
    findByIdAndUpdate(id, update, opts = {}) {
      const safeOpts = (opts && typeof opts === "object" && !Array.isArray(opts)) ? opts : {};
      return makeSingleQuery(() => findAndUpdate({ _id: String(id) }, update, safeOpts), { _id: id });
    },

    async updateOne(query, update) { return updateWhere(query, update); },
    async updateMany(query, update) { return updateWhere(query, update); },

    async deleteOne(query) {
      const rows = await rawFind(query);
      if (!rows.length) return { deletedCount: 0 };
      await getSupabase().from(tableName).delete().eq("id", rows[0].id);
      return { deletedCount: 1 };
    },

    async deleteMany(query) {
      const rows = await rawFind(query || {});
      if (!rows.length) return { deletedCount: 0 };
      if (!query || Object.keys(query).length === 0) {
        const { error } = await getSupabase().from(tableName).delete().gte("updated_at", "1970-01-01");
        if (error) throw error;
      } else {
        for (const r of rows) {
          const { error } = await getSupabase().from(tableName).delete().eq("id", r.id);
          if (error) throw error;
        }
      }
      return { deletedCount: rows.length };
    },

    async findByIdAndDelete(id) {
      const rows = await rawFind({ _id: String(id) });
      if (!rows.length) return null;
      await getSupabase().from(tableName).delete().eq("id", rows[0].id);
      return docFromRow(rows[0]);
    },

    async findOneAndDelete(query) {
      const rows = await rawFind(query);
      if (!rows.length) return null;
      await getSupabase().from(tableName).delete().eq("id", rows[0].id);
      return docFromRow(rows[0]);
    },

    async countDocuments(query = {}) {
      const { sqlFilters, containsFilters, orFilters, jsConditions } = classifyQuery(query, arrayColumns, refs);
      if (!jsConditions.length && !containsFilters.length) {
        let builder = getSupabase().from(tableName).select("*", { count: "exact", head: true });
        for (const [key, val] of Object.entries(sqlFilters)) builder = applySimpleFilter(builder, key, val);
        if (orFilters.length) builder = builder.or(orFilters.join(","));
        const { count, error } = await builder;
        if (error) throw error;
        return count || 0;
      }
      const rows = await rawFind(query);
      return rows.length;
    },

    aggregate,

    __rawFind: rawFind,
    Document,
  };

  function Model(data = {}) {
    return new Document(data);
  }
  Model.prototype = Document.prototype;
  for (const [key, value] of Object.entries(modelStatics)) Model[key] = value;
  Model.Document = Document;

  Model.__register();

  return Model;
}

module.exports = { createModel, registerModel, getModel };