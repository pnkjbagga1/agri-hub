const B="http://localhost:3100";
const login=async(e,p)=>{const r=await fetch(B+"/api/v1/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:e,password:p,portal:"member"})});return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");};
const ck=await login("grower@agrihub.test",process.argv[2]);
const t=await (await fetch(B+"/dashboard",{headers:{cookie:ck}})).text();
const i=t.indexOf("Active listings");console.log(t.slice(i-300,i+500));
for (const u of ["/marketplace?page=abc","/marketplace?category=notacat","/marketplace?sort=zzz&season=zz","/api/v1/listings?page=99999999999"]) {const r=await fetch(B+u);console.log(u,r.status);}
