const path = require("path");
const { randomUUID } = require("crypto");
const { getSupabase, supabaseUrl } = require("../config/supabase");

const STORAGE_BUCKETS = ["profiles", "chat", "bookings", "portfolio", "verification", "reviews"];

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * Full public URL for a stored object. Mobile treats absolute http(s) URLs as
 * external, so clients render these directly.
 */
function storageFileUrl(bucketName, key) {
  return `${supabaseUrl()}/storage/v1/object/public/${bucketName}/${key}`;
}

/** Create the public buckets on first boot (idempotent). */
async function ensureStorageBuckets() {
  const client = getSupabase();
  const { data: existing } = await client.storage.listBuckets();
  const have = new Set((existing || []).map((b) => b.name));
  for (const bucket of STORAGE_BUCKETS) {
    if (have.has(bucket)) continue;
    await client.storage.createBucket(bucket, { public: true }).then(
      () => console.log(`Storage bucket "${bucket}" ready`),
      () => {}
    );
  }
}

/**
 * Multer storage engine backed by Supabase Storage instead of the local disk
 * or GridFS. The stored key keeps the original extension so callers can detect
 * image vs PDF from the key, e.g. <uuid>.jpg.
 */
function gridFsStorage({ bucketName }) {
  return {
    _handleFile(req, file, cb) {
      const key = `${randomUUID()}${path.extname(file.originalname) || ""}`;
      const chunks = [];
      file.stream.on("data", (c) => chunks.push(c));
      file.stream.on("error", cb);
      file.stream.on("end", () => {
        const buf = Buffer.concat(chunks);
        getSupabase()
          .storage.from(bucketName)
          .upload(key, buf, {
            contentType: file.mimetype || "application/octet-stream",
            cacheControl: "31536000",
            upsert: false,
          })
          .then(({ error }) => {
            if (error) return cb(error);
            return cb(null, { filename: key, key, size: buf.length, bucket: bucketName });
          })
          .catch(cb);
      });
    },

    _removeFile(req, file, cb) {
      if (!file || !file.key) return cb(null);
      getSupabase()
        .storage.from(file.bucket || bucketName)
        .remove([file.key])
        .then(() => cb(null))
        .catch(cb);
    },
  };
}

/**
 * Express handler that streams a stored object for legacy /uploads/<bucket>/<id>
 * links. New code writes absolute public URLs; this keeps old URLs working.
 */
async function streamGridFsFile(req, res, next) {
  const { subdir, fileId } = req.params;
  if (!subdir || !fileId) return next();
  const key = String(fileId).split("?")[0];
  try {
    const { data, error } = await getSupabase().storage.from(subdir).download(key);
    if (error || !data) return next();
    const buf = Buffer.from(await data.arrayBuffer());
    const contentType = MIME_BY_EXT[path.extname(key).toLowerCase()] || "application/octet-stream";
    res.set("Content-Type", contentType);
    res.set("Content-Length", String(buf.length));
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(buf);
  } catch (err) {
    return next(err);
  }
}

module.exports = { gridFsStorage, streamGridFsFile, storageFileUrl, ensureStorageBuckets, STORAGE_BUCKETS };