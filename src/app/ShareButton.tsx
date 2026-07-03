export function ShareButton() {
  return (
    <div className="share-button">
      <button type="button" className="share-button__trigger" disabled aria-describedby="share-button-tooltip">
        Share
      </button>
      <span id="share-button-tooltip" role="tooltip" className="share-button__tooltip">
        Sharing is coming soon
      </span>
    </div>
  );
}
