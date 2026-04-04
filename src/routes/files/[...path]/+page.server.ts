import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const path = params.path ? params.path.replace(/\/$/, "") + "/" : "";
  return { path };
};
