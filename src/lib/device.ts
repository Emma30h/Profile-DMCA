// En mobile, el input con capture="user" abre la cámara nativa del SO
// (mejor UX ahí: control de flash, HDR, etc.). En desktop ese atributo no
// hace nada, así que ahí se usa un modal con getUserMedia en su lugar.
export function esDispositivoMobil(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
