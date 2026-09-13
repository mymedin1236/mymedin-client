import { ENV_LABEL, API_BASE_URL } from "../config/env";

// A small fixed marker on any build that isn't production, so nobody mistakes
// staging for the live app — entering real patient data into staging, or
// dismissing a real problem as "just staging", are both expensive mistakes.
// Renders nothing at all in production, so the live app is untouched.
export default function EnvBadge() {
  if (!ENV_LABEL) return null;
  return (
    <div className="env-badge" title={`This is the ${ENV_LABEL.toLowerCase()} app — it talks to ${API_BASE_URL}`}>
      {ENV_LABEL}
    </div>
  );
}
