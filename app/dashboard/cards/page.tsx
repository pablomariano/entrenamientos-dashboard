import { CardsContent } from "./cards-content";

export default async function CardsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await (searchParams ?? Promise.resolve({}));
  return <CardsContent />;
}
