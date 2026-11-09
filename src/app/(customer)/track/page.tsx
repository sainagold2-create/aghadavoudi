import { TrackForm } from "@/components/track-form";

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const sp = await searchParams;
  return <TrackForm initialCode={sp.code} />;
}
