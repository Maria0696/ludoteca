/** Se vuelve a montar en cada navegación: el contenido entra con un fundido breve. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
