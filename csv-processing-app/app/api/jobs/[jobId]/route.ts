const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const response = await fetch(`${BACKEND_URL}/jobs/${jobId}`, {
    method: "GET",
  });

  const data = await response.json();

  return Response.json(data, { status: response.status });
}
