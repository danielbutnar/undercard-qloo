import { labShot } from "@/server/lab";

/** A still or a clip from .design/lab, under `next dev` only (src/server/lab.ts). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/lab/shots/[file]">,
): Promise<Response> {
  const { file } = await params;
  return labShot(file);
}
