export async function POST(request) {

  const body = await request.json();
  
  const { name, birth, gender, time } = body;
  
  return new Response(
  JSON.stringify({
  title: `${name}님의 사주해설`,
  summary:
  `${name}님은 ${birth}에 태어난 ${gender}이며, 깊은 감수성과 강한 직관을 가진 사주입니다.`
  }),
  {
  headers: {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*"
  }
  }
  );
  }
  