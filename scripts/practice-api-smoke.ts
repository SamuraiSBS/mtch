const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const password = "DemoPass123!";
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function login(email: string) {
  const response = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ email, password }) });
  assert(response.status === 200, `Login failed: ${email} ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0]; assert(cookie, "Session cookie missing");
  return cookie;
}
async function get(path: string, cookie: string) { return fetch(`${base}/api/v1${path}`, { headers: { cookie } }); }
async function main() {
  const employer = await login("employer1@demo.mtch.test");
  const otherEmployer = await login("employer2@demo.mtch.test");
  const specialist = await login("specialist7@demo.mtch.test");
  const list = await get("/practice-recruitments", employer); assert(list.status === 200, `Employer list: ${list.status}`);
  const data = await list.json(); assert(data.items.length > 0, "No practice recruitments");
  const id = data.items[0].id;
  const matches = await get(`/practice-recruitments/${id}/matches`, employer); assert(matches.status === 200, `Matches: ${matches.status}`);
  const matchesData = await matches.json() as { items: { score: number; reasons: unknown }[] }; assert(matchesData.items.every(item => item.score >= 0 && item.score <= 100 && Array.isArray(item.reasons)), "Invalid match response");
  assert((await get(`/practice-recruitments/${id}`, otherEmployer)).status === 404, "Other employer can see recruitment");
  assert((await get(`/practice-recruitments/${id}`, specialist)).status === 403, "Specialist can see recruitment");
  assert((await get("/practice-invitations", specialist)).status === 200, "Specialist cannot list own invitations");
  console.log("Practice API smoke passed: role, ownership, match DTO, own invitations");
}
main().catch(error => { console.error(error); process.exit(1); });
