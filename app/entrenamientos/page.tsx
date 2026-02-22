import { EntrenamientosHomeContent } from "./entrenamientos-home-content";

export default async function EntrenamientosHomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await (searchParams ?? Promise.resolve({}));
  return <EntrenamientosHomeContent />;
}
