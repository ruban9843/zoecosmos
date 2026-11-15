import { auth } from "../../../../lib/auth";

export async function GET() {
  const session = await auth();
  const isAdmin =
    session?.user.role === "STAFF" || session?.user.role === "OWNER";

  return Response.json({ isAdmin });
}
