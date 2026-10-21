import Icon from "./Icon";

// Shown at startup when the session couldn't be checked because the server
// couldn't be reached, in place of an endless loader.
export default function ConnectionError({ onRetry, retrying }) {
  return (
    <div className="fullscreen-loader" role="alert">
      <div className="fsl-inner connection-error">
        <Icon name="wifi_off" size={44} className="connection-error-icon" />
        <div className="fsl-brand">Can't connect to MyMedin</div>
        <p className="connection-error-text">
          Check your internet connection and try again. We'll also retry as soon as you're back online.
        </p>
        <button type="button" onClick={onRetry} disabled={retrying}>
          {retrying ? "Trying…" : "Try again"}
        </button>
      </div>
    </div>
  );
}
