import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "32px var(--gutter)" }}>
      <div className="empty">
        <h1>Esta página no está en la sala</h1>
        <p>Puede que el enlace esté mal escrito o que lo que buscabas ya no exista.</p>
        <Link href="/" className="btn btn-ink">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
