import { redirect } from "next/navigation";

export default async function EjemplarRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/libros/ejemplares/${id}`);
}
