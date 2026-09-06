const TRANSIENT_CODES = new Set([
  "P1001", // cannot reach database
  "P1002", // connection timed out
  "P1017", // server closed connection
  "P2024", // pool timeout
  "P2028", // interactive transaction timeout/expired
  "P2034", // transaction conflict/deadlock
  "53300", // too_many_connections
  "57P01", // admin_shutdown / connection terminated
  "57P02",
  "57P03", // cannot_connect_now
  "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE",
]);

function errorValues(error: unknown) {
  if (typeof error !== "object" || error === null) return [String(error ?? "")];
  const value = error as Record<string, unknown>;
  const cause = typeof value.cause === "object" && value.cause !== null
    ? value.cause as Record<string, unknown>
    : undefined;
  return [
    value.code,
    value.name,
    value.message,
    cause?.code,
    cause?.name,
    cause?.message,
  ].map((item) => String(item ?? ""));
}

export function isTransientDatabaseError(error: unknown) {
  const values = errorValues(error);
  if (values.some((value) => TRANSIENT_CODES.has(value))) return true;
  const text = values.join(" ").toLowerCase();
  return [
    "connection terminated",
    "connection closed",
    "connection reset",
    "too many connections",
    "remaining connection slots",
    "timed out fetching a new connection",
    "can't reach database server",
    "cannot reach database server",
    "database server was not reached",
    "socket hang up",
  ].some((needle) => text.includes(needle));
}
