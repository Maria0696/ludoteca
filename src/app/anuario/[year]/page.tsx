import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YearStory } from "../YearStory";

export const metadata: Metadata = { title: "Anuario" };

export default async function AnuarioYearPage({ params }: PageProps<"/anuario/[year]">) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  return <YearStory year={Number(year)} />;
}
