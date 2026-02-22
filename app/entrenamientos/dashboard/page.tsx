import { EntrenamientosDashboardContent } from "./dashboard-content";

export default async function EntrenamientosDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await (searchParams ?? Promise.resolve({}));
  return <EntrenamientosDashboardContent />;
}
