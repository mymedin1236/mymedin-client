// Normalize a typed/pasted phone number into local Pakistani format:
// 11 digits starting with 0 (e.g. 03234944896).
//
// Handles common paste formats, tolerating spaces/dashes/plus:
//   "+92 323 4944896"  -> "03234944896"
//   "0092 323 4944896" -> "03234944896"
//   "923234944896"     -> "03234944896"
//   "3234944896"       -> "03234944896"  (national, missing leading 0)
//   "03234944896"      -> "03234944896"  (already local)
export const normalizePkPhone = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = "0" + d.slice(4);
  else if (d.startsWith("92") && d.length >= 12) d = "0" + d.slice(2);
  if (d.length === 10 && d[0] === "3") d = "0" + d; // national -> local
  return d.slice(0, 11);
};
