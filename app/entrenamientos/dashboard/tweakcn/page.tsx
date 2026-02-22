import { TweakcnContent } from "./tweakcn-content";

export default async function EntrenamientosTweakcnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await (searchParams ?? Promise.resolve({}));
  return <TweakcnContent />;
}
