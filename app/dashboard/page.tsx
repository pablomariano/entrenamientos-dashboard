import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await (searchParams ?? Promise.resolve({}));
  return <DashboardContent />;
}
