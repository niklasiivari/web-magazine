export function articleSlug(id: string): string {
  const slug = id.split("/").pop();
  if (!slug) throw new Error(`Malformed article id: ${id}`);
  return slug;
}
