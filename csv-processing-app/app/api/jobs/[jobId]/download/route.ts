const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const response = await fetch(`${BACKEND_URL}/download_csv/${jobId}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Download failed" }));
    return Response.json(errorData, { status: response.status });
  }

  const csvContent = await response.blob();

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="output_${jobId}.csv"`,
    },
  });
}
