import Icon from "./Icon";

// Branded full-screen spinner overlay — used for app/route bootstrap.
export default function FullScreenLoader({ label = "Loading…" }) {
  return (
    <div className="fullscreen-loader" role="status" aria-label={label}>
      <div className="fsl-inner">
        <span className="fsl-spinner" />
        <div className="fsl-brand">
          <Icon name="stethoscope" /> MyMedin
        </div>
      </div>
    </div>
  );
}
