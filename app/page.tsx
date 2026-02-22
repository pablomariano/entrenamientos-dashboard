import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await (searchParams ?? Promise.resolve({}));
  redirect("/dashboard");
}
