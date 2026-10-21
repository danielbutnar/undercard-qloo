import { labShot } from "@/server/lab-shots";

/** A still or a clip from .design/lab, under `next dev` only (src/server/lab-shots.ts). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/lab/shots/[file]">,
): Promise<Response> {
  const { file } = await params;
  return labShot(file);
}
