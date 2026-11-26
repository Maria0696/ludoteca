import type { Metadata } from "next";
import { YearsView } from "./YearsView";

export const metadata: Metadata = { title: "Anuario" };

export default function AnuarioPage() {
  return <YearsView />;
}
