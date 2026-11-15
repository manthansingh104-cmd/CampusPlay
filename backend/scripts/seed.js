import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
const hash=await bcrypt.hash('password123',10);
const organizer=await prisma.user.upsert({where:{email:'sports@campus.edu'},update:{},create:{name:'Campus Sports Organizer',email:'sports@campus.edu',passwordHash:hash,role:'organizer',department:'Sports Committee'}});
const students=[];
for(let i=1;i<=12;i++)students.push(await prisma.user.upsert({where:{email:`student${i}@campus.edu`},update:{},create:{name:`Student ${i}`,email:`student${i}@campus.edu`,passwordHash:hash,role:'student',department:['Computer Science','Mechanical','Electrical','Civil'][i%4],year:'2',section:'A'}}));
const sports=['Cricket','Football','Basketball','Volleyball','Badminton','Table Tennis','Chess','Carrom','Athletics','Cricket'];
for(let i=0;i<sports.length;i++){
 const t=await prisma.tournament.create({data:{name:`Campus ${sports[i]} Cup ${i+1}`,sport:sports[i],description:'Seeded demo tournament',format:i%2?'league':'knockout',status:i<2?'live':'upcoming',venue:'Main Sports Ground',minPlayers:1,maxPlayers:20,startDate:new Date(Date.now()+i*86400000)}});
 const a=students[i%students.length],b=students[(i+1)%students.length];
 const team1=await prisma.team.create({data:{name:`${a.name} Warriors`,department:a.department,captainId:a.id,tournamentId:t.id,players:[{id:a.id,name:a.name}]}});const team2=await prisma.team.create({data:{name:`${b.name} Strikers`,department:b.department,captainId:b.id,tournamentId:t.id,players:[{id:b.id,name:b.name}]}}); 
 await prisma.registration.create({data:{userId:a.id,tournamentId:t.id,teamId:team1.id,type:'team',status:'approved'}}).catch(()=>{});
 await prisma.match.create({data:{tournamentId:t.id,homeTeamId:team1.id,awayTeamId:team2.id,scheduledAt:new Date(Date.now()+i*86400000),venue:'Main Sports Ground',status:i===0?'live':'upcoming',homeScore:i===0?45:0,awayScore:i===0?32:0}});
}
console.log('Seed complete. Organizer sports@campus.edu / password123; students student1@campus.edu / password123');
await prisma.$disconnect();
