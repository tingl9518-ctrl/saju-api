export async function GET() {
  return new Response(
    JSON.stringify({
      title: "깊은 물속의 불꽃",
      summary: "당신은..."
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}




