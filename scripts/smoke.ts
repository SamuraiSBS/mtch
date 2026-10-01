import { readFileSync } from "node:fs";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const portrait = readFileSync(new URL("../photo-processor/fixtures/astronaut.png", import.meta.url));
const suffix = crypto.randomUUID().slice(0, 8);
type Client = { cookie: string; email: string };
function expectStatus(response: Response, expected: number, label: string) { if (response.status !== expected) throw new Error(`${label}: expected ${expected}, got ${response.status}: ${response.statusText}`); }
async function request(client: Client | null, method: string, path: string, body?: unknown, expected = 200) {
  const headers: Record<string,string> = {}; if (client?.cookie) headers.cookie = client.cookie; if (method !== "GET") headers.origin = base;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body; else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  const response = await fetch(base + "/api/v1" + path, { method, headers, body: payload, redirect: "manual" });
  expectStatus(response, expected, `${method} ${path}`);
  const cookie = response.headers.get("set-cookie"); if (client && cookie) client.cookie = cookie.split(";")[0];
  return response.status === 204 ? null : response.json();
}
async function register(role: "SPECIALIST"|"EMPLOYER") { const client = { cookie: "", email: `${role.toLowerCase()}-${suffix}@smoke.mtch.test` }; const result = await request(client,"POST","/auth/register",{email:client.email,password:"SmokePass123!",passwordConfirmation:"SmokePass123!",role},201); if(result.user.role!==role) throw new Error("Role mismatch"); return {client,id:result.user.id}; }
async function upload(client: Client, kind: "AVATAR"|"COMPANY_LOGO"|"COMPANY_PHOTO") { const form=new FormData();form.set("kind",kind);form.set("file",new File([kind==="AVATAR"?portrait:png],"demo.png",{type:"image/png"}));return (await request(client,"POST","/media",form,201)).fileId as string; }
async function main() {
  const health=await request(null,"GET","/health"); if(health.database!=="ok") throw new Error("Database unavailable");
  await request(null,"GET","/catalogs/skills",undefined,401);
  const specialist=await register("SPECIALIST"), employer=await register("EMPLOYER");
  const duplicate=await fetch(`${base}/api/v1/auth/register`,{method:"POST",headers:{origin:base,"content-type":"application/json"},body:JSON.stringify({email:specialist.client.email.toUpperCase(),password:"SmokePass123!",passwordConfirmation:"SmokePass123!",role:"EMPLOYER"})});
  if(duplicate.ok)throw new Error("Duplicate email was accepted");
  const me=await request(specialist.client,"GET","/auth/me"); if(me.role!=="SPECIALIST")throw new Error("Session missing");
  const professions=await request(specialist.client,"GET","/catalogs/professions"), skills=await request(specialist.client,"GET","/catalogs/skills"), cities=await request(specialist.client,"GET","/catalogs/cities");
  const stagedAvatarId=await upload(specialist.client,"AVATAR");
  await request(employer.client,"GET",`/media/${stagedAvatarId}`,undefined,404);
  const specialistBody={firstName:"Тестовый",lastName:"Специалист",birthDate:"1995-04-12",cityId:cities[0].id,avatarFileId:stagedAvatarId,professionId:professions[0].id,experience:"FROM_3_TO_5",level:"MIDDLE",cooperationType:"STAFF",skillIds:[skills[0].id,skills[1].id],about:"Smoke profile",portfolioUrl:"",githubUrl:"",behanceGitlabUrl:"",telegram:"@smoke_specialist",salaryMinRub:100000,salaryMaxRub:180000,workFormat:"REMOTE",employmentType:"FULL_TIME",searchStatus:"ACTIVE"};
  await request(specialist.client,"POST","/specialists/me",specialistBody,201);
  for(const size of [null,"256","64"]){const path=`/media/${stagedAvatarId}${size?`?size=${size}`:""}`;const image=await fetch(`${base}/api/v1${path}`,{headers:{cookie:employer.client.cookie}});expectStatus(image,200,path);if(image.headers.get("content-type")!=="image/webp")throw new Error("Avatar is not WebP");const data=Buffer.from(await image.arrayBuffer());if(data.toString("ascii",0,4)!=="RIFF"||data.toString("ascii",8,12)!=="WEBP")throw new Error("Invalid avatar bytes");}
  await request(employer.client,"GET",`/media/${stagedAvatarId}/original`,undefined,404);
  const originalAvatar=await fetch(`${base}/api/v1/media/${stagedAvatarId}/original`,{headers:{cookie:specialist.client.cookie}});expectStatus(originalAvatar,200,"original avatar");if(originalAvatar.headers.get("content-type")!=="image/png")throw new Error("Original MIME changed");
  const invalidAvatar=new FormData();invalidAvatar.set("kind","AVATAR");invalidAvatar.set("file",new File([png],"tiny.png",{type:"image/png"}));await request(specialist.client,"POST","/media",invalidAvatar,422);
  const unchanged=await request(specialist.client,"GET","/specialists/me");if(unchanged.avatarFileId!==stagedAvatarId)throw new Error("Failed upload changed avatar");
  await request(employer.client,"GET","/specialists/me",undefined,403);
  const companyBody={name:"Тестовая компания",description:"Smoke company",workFormat:"REMOTE",foundedYear:2020,sizeBand:"11-50",industry:"ИТ",websiteUrl:"",logoFileId:await upload(employer.client,"COMPANY_LOGO"),contactEmail:"hr@smoke.mtch.test",telegram:"@smoke_company",phone:"+79990000000"};
  const company=await request(employer.client,"POST","/companies/me",companyBody,201);
  const photoId=await upload(employer.client,"COMPANY_PHOTO"); const photo=await request(employer.client,"POST","/companies/me/photos",{fileId:photoId},201);
  const image=await fetch(`${base}/api/v1/media/${photoId}`,{headers:{cookie:employer.client.cookie}});expectStatus(image,200,"company photo");if(image.headers.get("content-type")!=="image/png")throw new Error("Wrong media MIME");
  await request(employer.client,"DELETE",`/companies/me/photos/${photo.id}`,undefined,204);
  const social=await request(employer.client,"POST","/companies/me/social-links",{platform:"OTHER",value:"https://example.test/company"},201);await request(employer.client,"DELETE",`/companies/me/social-links/${social.id}`,undefined,204);
  await request(specialist.client,"GET","/companies/me",undefined,403);
  const publicCompany=await request(specialist.client,"GET",`/companies/${company.id}`); if("contactEmail" in publicCompany || "telegram" in publicCompany)throw new Error("Company contacts leaked");
  const publicSpecialist=await request(employer.client,"GET",`/specialists/${specialist.id}`); if("telegram" in publicSpecialist || "email" in publicSpecialist)throw new Error("Specialist contacts leaked");
  const searchBody={title:"Frontend Middle",professionId:professions[0].id,targetLevel:"MIDDLE",minimumExperience:"FROM_1_TO_3",skillIds:[skills[0].id,skills[1].id],salaryMinRub:120000,salaryMaxRub:200000,workFormat:"REMOTE",employmentType:"FULL_TIME"};
  const search=await request(employer.client,"POST","/search-profiles",searchBody,201);
  await request(specialist.client,"GET",`/search-profiles/${search.id}`,undefined,403);
  const feed=await request(employer.client,"GET",`/feed/specialists?searchProfileId=${search.id}&pageSize=100`); if(!feed.items.some((x:any)=>x.userId===specialist.id))throw new Error("Specialist absent from feed");
  if(feed.items.some((x:any,i:number)=>i>0&&x.matchPercent>feed.items[i-1].matchPercent))throw new Error("Feed score order is unstable");
  const skilled=await request(employer.client,"GET",`/feed/specialists?searchProfileId=${search.id}&skillId=${skills[0].id}&skillId=${skills[1].id}&pageSize=100`);if(!skilled.items.some((x:any)=>x.userId===specialist.id))throw new Error("AND skill filter excluded matching specialist");
  const wrongCity=await request(employer.client,"GET",`/feed/specialists?searchProfileId=${search.id}&cityId=${cities[1].id}&pageSize=100`);if(wrongCity.items.some((x:any)=>x.userId===specialist.id))throw new Error("City filter failed");
  const offerBody={specialistUserId:specialist.id,searchProfileId:search.id,positionTitle:"Frontend Engineer",salaryMinRub:130000,salaryMaxRub:190000,description:"Smoke offer",workFormat:"REMOTE",employmentType:"FULL_TIME",message:"Приглашаем"};
  const first=await request(employer.client,"POST","/offers",offerBody,201);await request(employer.client,"POST","/offers",offerBody,409);
  await request(employer.client,"PUT",`/search-profiles/${search.id}`,{...searchBody,title:"Frontend Middle Updated"});const original=await request(employer.client,"GET",`/offers/${first.id}`);if(original.searchProfileSnapshot.title!==searchBody.title)throw new Error("Offer snapshot changed after search edit");
  await request(employer.client,"POST",`/offers/${first.id}/accept`,undefined,403);
  await request(specialist.client,"POST",`/offers/${first.id}/reject`);await request(specialist.client,"POST",`/offers/${first.id}/accept`,undefined,409);
  const second=await request(employer.client,"POST","/offers",offerBody,201);await request(employer.client,"POST",`/offers/${second.id}/withdraw`);await request(specialist.client,"POST",`/offers/${second.id}/accept`,undefined,409);
  const third=await request(employer.client,"POST","/offers",offerBody,201);await request(specialist.client,"POST",`/offers/${third.id}/accept`);await request(employer.client,"POST","/offers",offerBody,409);
  const employerMatches=await request(employer.client,"GET","/matches");const match=employerMatches.items.find((x:any)=>x.offerId===third.id);if(!match)throw new Error("Match missing");
  const employerContacts=await request(employer.client,"GET",`/matches/${match.id}/contacts`);if(employerContacts.email!==specialist.client.email||employerContacts.telegram!=="@smoke_specialist")throw new Error("Wrong specialist contacts");
  const specialistContacts=await request(specialist.client,"GET",`/matches/${match.id}/contacts`);if(specialistContacts.email!==employer.client.email||specialistContacts.telegram!=="@smoke_company")throw new Error("Wrong employer contacts");
  const outsider={cookie:"",email:"employer2@demo.mtch.test"};await request(outsider,"POST","/auth/login",{email:outsider.email,password:"DemoPass123!"});await request(outsider,"GET",`/matches/${match.id}/contacts`,undefined,404);
  const replacementId=await upload(specialist.client,"AVATAR");const beforeReplacement=await request(employer.client,"GET",`/specialists/${specialist.id}`);if(beforeReplacement.avatarFileId!==stagedAvatarId)throw new Error("Avatar published before profile save");
  await request(specialist.client,"PUT","/specialists/me",{...specialistBody,avatarFileId:replacementId,salaryMinRub:-1},422);
  const afterFailedSave=await request(employer.client,"GET",`/specialists/${specialist.id}`);if(afterFailedSave.avatarFileId!==stagedAvatarId)throw new Error("Failed profile save changed public avatar");
  const retainedAvatar=await fetch(`${base}/api/v1/media/${stagedAvatarId}`,{headers:{cookie:employer.client.cookie}});expectStatus(retainedAvatar,200,"retained old avatar");
  await request(specialist.client,"PUT","/specialists/me",{...specialistBody,avatarFileId:replacementId,searchStatus:"NOT_LOOKING"});
  const afterReplacement=await request(employer.client,"GET",`/specialists/${specialist.id}`);if(afterReplacement.avatarFileId!==replacementId)throw new Error("Avatar replacement not published");
  for(const size of [null,"256","64"]){const path=`/media/${replacementId}${size?`?size=${size}`:""}`;const image=await fetch(`${base}/api/v1${path}`,{headers:{cookie:employer.client.cookie}});expectStatus(image,200,path);}
  await request(employer.client,"GET",`/media/${stagedAvatarId}`,undefined,404);
  const after=await request(employer.client,"GET",`/feed/specialists?searchProfileId=${search.id}&pageSize=100`);if(after.items.some((x:any)=>x.userId===specialist.id))throw new Error("NOT_LOOKING visible in feed");
  const temporary=await request(employer.client,"POST","/search-profiles",{...searchBody,title:"Temporary Search"},201);await request(employer.client,"DELETE",`/search-profiles/${temporary.id}`,undefined,204);await request(employer.client,"GET",`/search-profiles/${temporary.id}`,undefined,404);
  await request(outsider,"POST","/auth/logout",undefined,204);await request(outsider,"GET","/auth/me",undefined,401);
  console.log("Smoke passed: health, auth, roles, profiles, company, search, feed, offer states, Match and contact access.");
}
main().catch(error=>{console.error(error);process.exit(1)});
