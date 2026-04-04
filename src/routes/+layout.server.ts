import { redirect } from "@sveltejs/kit";

export const load = async ({ locals, url }) => {
  if (!locals.user && !url.pathname.startsWith("/auth")) redirect(302, "/auth");
  return { user: locals.user };
};
