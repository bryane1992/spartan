import { useState, useEffect, useCallback, useRef } from "react";
import { loadState, saveDay, setWeek as apiSetWeek, resetAll as apiReset, seedData, setPin, getPin } from "./api.js";
import RunTracker from "./RunTracker.jsx";

const DAYS = ["MON","TUE","WED","THU","FRI"];
const F = { h:"'Oswald',sans-serif", m:"'JetBrains Mono',monospace" };
const iS = (x={}) => ({background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:5,padding:"6px 8px",color:"#fff",fontFamily:F.m,fontSize:11,width:"100%",boxSizing:"border-box",outline:"none",...x});

const PHASES = [
  { name:"FOUNDATION", weeks:[1,4], color:"#FF4136", desc:"Rebuild base, run to 3mi, muscle memory" },
  { name:"BUILD", weeks:[5,8], color:"#FF851B", desc:"Push heavier, 5K+ runs, bulk arms & chest" },
  { name:"PEAK", weeks:[9,12], color:"#B10DC9", desc:"Heaviest phase, 8K+ runs, max definition" },
  { name:"RACE PREP", weeks:[13,15], color:"#01FF70", desc:"Taper, race-pace 10K, obstacle simulation" },
];
const getPhase = w => PHASES.find(p => w >= p.weeks[0] && w <= p.weeks[1]) || PHASES[0];
const isBench = w => [4,8,12].includes(w);

const VIDS = {
  "Bench Press":"https://www.youtube.com/results?search_query=barbell+bench+press+form",
  "Incline DB Press":"https://www.youtube.com/results?search_query=incline+dumbbell+press+form",
  "Incline DB Fly":"https://www.youtube.com/results?search_query=incline+dumbbell+fly+form",
  "DB Squeeze Press":"https://www.youtube.com/results?search_query=dumbbell+squeeze+press",
  "DB Floor Fly to Press":"https://www.youtube.com/results?search_query=dumbbell+floor+fly+press",
  "Close-Grip Bench":"https://www.youtube.com/results?search_query=close+grip+bench+press",
  "Incline Bench Press":"https://www.youtube.com/results?search_query=incline+barbell+bench+press",
  "Back Squat":"https://www.youtube.com/results?search_query=barbell+back+squat+form",
  "Clean to Front Squat":"https://www.youtube.com/results?search_query=power+clean+front+squat",
  "Barbell Bent Over Row":"https://www.youtube.com/results?search_query=barbell+bent+over+row",
  "DB Arnold Press":"https://www.youtube.com/results?search_query=arnold+press+form",
  "DB Romanian Deadlift":"https://www.youtube.com/results?search_query=dumbbell+romanian+deadlift",
  "Ring Pull-Ups":"https://www.youtube.com/results?search_query=ring+pull+ups+form",
  "Ring Inverted Row":"https://www.youtube.com/results?search_query=ring+inverted+row",
  "Barbell Curl":"https://www.youtube.com/results?search_query=barbell+curl+form",
  "Skull Crushers":"https://www.youtube.com/results?search_query=barbell+skull+crushers",
  "DB Hammer Curl":"https://www.youtube.com/results?search_query=dumbbell+hammer+curl",
  "DB Curl to Press":"https://www.youtube.com/results?search_query=dumbbell+curl+to+press",
  "KB Swings":"https://www.youtube.com/results?search_query=kettlebell+swing+form",
  "Farmer Carry":"https://www.youtube.com/results?search_query=farmer+carry+form",
  "Tempo Run":"https://www.youtube.com/results?search_query=tempo+run+beginner",
  "Fartlek Run":"https://www.youtube.com/results?search_query=fartlek+run+explained",
};

// ══════════════════════════════════════════════════════════════════════════════
// PROGRAM GENERATOR — generates workouts for any week 1-15
// ══════════════════════════════════════════════════════════════════════════════
function genWeek(wk, prev) {
  const ph = getPhase(wk), p = ph.name, bm = isBench(wk);
  const pw = (di,bi,ei) => { const d=prev?.[di]?.lg?.[`${bi}-${ei}`]; if(d?.wt){const m=d.wt.match(/(\d+)/);return m?+m[1]:null;} return null; };
  const bump = (v,fb,mx=155) => v ? Math.min(Math.round(v*1.05/5)*5, mx) : fb;
  const bb = p==="FOUNDATION"?75:p==="BUILD"?90:p==="PEAK"?105:95;
  const sq = p==="FOUNDATION"?85:p==="BUILD"?105:p==="PEAK"?120:105;
  const dbMon=p==="FOUNDATION"?30:p==="BUILD"?35:p==="PEAK"?40:35;
  const dbWed=p==="FOUNDATION"?25:p==="BUILD"?30:p==="PEAK"?35:30;
  const dbThu=p==="FOUNDATION"?30:p==="BUILD"?35:p==="PEAK"?40:35;
  const intv = p==="FOUNDATION"?4:p==="BUILD"?6:p==="PEAK"?8:6;
  const runShort = p==="FOUNDATION"?"2–2.5 mi":p==="BUILD"?"3–3.5 mi":p==="PEAK"?"4–5 mi":"3–4 mi";
  const runLong = p==="FOUNDATION"?"2.5–3 mi":p==="BUILD"?"4–4.5 mi":p==="PEAK"?"5–6.5 mi":"6–6.5 mi (10K pace)";
  const runType = p==="FOUNDATION"?"INTERVALS":p==="BUILD"?(wk%2===0?"TEMPO":"FARTLEK"):p==="PEAK"?"RACE PACE":"EASY";
  const puReps = Math.min(4+Math.floor(wk/3),10);
  const themes = {
    FOUNDATION:[["GARAGE WARRIOR","ROAD WORK","ARMOR UP","LEGS & GUNS","DISTANCE DAY"],["FULL SEND","CARDIO CORE","PUSH PULL PUMP","SQUAT & CURL","TRAIL BLAZER"],["COMEBACK KID","HEART & LUNGS","CHEST DESTROYER","HILL CLIMBER","ENDURANCE"],["★ BENCHMARK","★ BENCH RUN","★ BENCH UPPER","★ BENCH LOWER","★ BENCH 10K"]],
    BUILD:[["MASS MONDAY","SPEED WORK","GUN SHOW","HEAVY CARRY + GUNS","LONG HAUL"],["POWER HOUSE","TEMPO TUESDAY","CHEST & BACK ATTACK","SQUAT & PUMP","FARTLEK FRIDAY"],["STRENGTH SURGE","INTERVAL HELL","ARMS RACE","CARRY MONSTER","OBSTACLE SIM"],["★ BENCHMARK","★ BENCH RUN","★ BENCH UPPER","★ BENCH LOWER","★ BENCH 10K"]],
    PEAK:[["PEAK POWER","RACE PACE","MAX UPPER","MAX LOWER + ARMS","DISTANCE PR"],["SPARTAN STRONG","TEMPO GRIND","CHEST DESTROYER","LEG BLASTER","OBSTACLE BEAST"],["WARRIOR MODE","SPEED DEMON","ARMS RACE II","CARRY & CURL","ENDURANCE BEAST"],["★ BENCHMARK","★ BENCH RUN","★ BENCH UPPER","★ BENCH LOWER","★ BENCH 10K"]],
    "RACE PREP":[["SHARP & READY","RACE REHEARSAL","MAINTAIN PUMP","OBSTACLE READY","FINAL LONG RUN"],["TAPER POWER","PACE LOCK","KEEP THE PUMP","CARRY SIM","RACE WEEK"],["RACE WEEK","EASY JOG","LIGHT PUMP","REST DAY","AROO!"]],
  };
  const tl = themes[p]||themes.FOUNDATION;
  const dt = tl[Math.min(wk-getPhase(wk).weeks[0], tl.length-1)];

  const mon = { day:"MON", title:dt[0], color:"#FF4136",
    focus: bm?"BENCHMARK WEEK — Test your strength!":`${p} • Total Body Power`,
    blocks:[
      { n:"WARM-UP",t:"MOVEMENT PREP",tm:"8 min",c:"#555",ex:[{name:"Row or Run",rx:"3 min",ld:"Gradually build pace"},{name:"Dynamic Stretching",rx:"2 min",ld:"Leg swings, arm circles"},{name:"Goblet Squats",rx:"10",ld:"Light KB",w:"Hip mobility"},{name:"Push-Up to T",rx:"10 alt",ld:"BW",w:"Shoulder stability"},{name:"Band Pull-Aparts",rx:"20",ld:"Light band",w:"Rear delts"}]},
      { n:"POWER LIFTS",t:bm?"STRENGTH TEST":"COMPOUND MOVEMENTS",tm:"25 min",c:"#FF4136",note:bm?"Work up to heavy singles":"Focus on power & form",
        ex:[
          {name:wk>=5?"Deadlift":"Trap Bar Deadlift",rx:bm?"Build to heavy 3":`5×5`,ld:`${bump(pw(0,1,0),135,225)} lb`,w:"Total body power"},
          {name:"Bench Press",rx:bm?"Build to heavy 5":`5×5`,ld:`${bump(pw(0,1,1),bb)} lb`,w:"Upper body strength"},
          {name:wk>=5?"Back Squat":"Front Squat",rx:bm?"Build to heavy 5":`5×5`,ld:`${bump(pw(0,1,2),sq)} lb`,w:"Leg drive"}
        ]},
      { n:"ACCESSORY CIRCUIT",t:"SUPERSETS",tm:"12 min",c:"#FF851B",note:"Move quickly between exercises",
        ex:[
          {name:"Pull-Ups",rx:`3×${Math.min(5+Math.floor(wk/2),12)}`,ld:"BW",w:"Back strength"},
          {name:"Dips",rx:`3×${Math.min(8+Math.floor(wk/2),15)}`,ld:"BW",w:"Chest & triceps"},
          {name:"Walking Lunges",rx:"3×10 ea",ld:`${Math.max(20,dbMon-10)} lb DBs`,w:"Unilateral strength"}
        ]},
      { n:"CORE FINISHER",t:"SPARTAN CORE",tm:"8 min",c:"#01FF70",amrap:true,note:"Quality over speed",
        ex:[{name:"Plank to Push-Up",rx:"10",ld:"BW",w:"Core stability"},{name:"V-Ups",rx:"15",ld:"BW",w:"Ab strength"},{name:"Russian Twists",rx:"20",ld:"25 lb plate",w:"Rotation"},{name:"Bear Crawl",rx:"10 steps",ld:"BW",w:"Full body"}]},
      { n:"COOL-DOWN",t:"MOBILITY",tm:"5 min",c:"#555",ex:[{name:"Foam Roll",rx:"2 min",ld:"Focus on tight spots"},{name:"Couch Stretch",rx:"60s ea",ld:"Hip flexors"},{name:"Shoulder Dislocates",rx:"15",ld:"PVC pipe"}]},
    ]};

  const tue = { day:"TUE", title:dt[1], color:"#0074D9",focus:`${runType} • ${runShort} target • Functional Core`,
    blocks:[
      { n:"WARM-UP",t:"DYNAMIC ACTIVATION",tm:"8 min",c:"#555",ex:[{name:"Easy Jog",rx:"3 min",ld:"Build pace gradually"},{name:"Lunge Matrix",rx:"5 ea direction",ld:"Forward/lateral/reverse"},{name:"A-Skips",rx:"30s",ld:"Running form drill"},{name:"Butt Kicks",rx:"30s",ld:"Hamstring activation"},{name:"Strides",rx:"3×50m",ld:"Build to 80% speed"}]},
      { n:runType==="INTERVALS"?"INTERVAL RUN":runType==="TEMPO"?"TEMPO RUN":runType==="FARTLEK"?"FARTLEK RUN":runType==="RACE PACE"?"RACE PACE RUN":"EASY RUN",t:"SPARTAN 10K BUILDER",tm:p==="FOUNDATION"?"20–25 min":p==="BUILD"?"25–35 min":"30–40 min",c:"#0074D9",
        note:runType==="INTERVALS"?`${intv} rounds: 2 min hard / 1 min recovery`:runType==="TEMPO"?"Comfortably hard, race simulation":runType==="FARTLEK"?"Play with speed, mimic race terrain":runType==="RACE PACE"?"Lock in your 10K race pace":"Easy conversational pace",
        ex:[{name:"Warm-Up Run",rx:"5 min",ld:"Easy pace",w:"GPS tracking available"},
          ...(runType==="INTERVALS"?[{name:"Hard Interval",rx:"2 min",ld:"80-85% effort",w:"Spartan race pace"},{name:"Recovery Jog",rx:"1 min",ld:"60% effort",w:"Active recovery"},{name:`Repeat ×${intv}`,rx:`${intv} rounds`,ld:"Consistent splits",w:"Track with GPS"}]:[{name:runType==="TEMPO"?"Tempo Run":runType==="FARTLEK"?"Fartlek Run":runType==="RACE PACE"?"Race Pace Run":"Easy Run",rx:p==="BUILD"?"20 min":p==="PEAK"?"25 min":"20 min",ld:runType==="TEMPO"?"Threshold pace":"Variable pace",w:"Use TRACK button"}]),
          {name:"Cool-Down Run",rx:"5 min",ld:"Easy jog",w:"Gradual recovery"}]},
      { n:"FUNCTIONAL CORE",t:"OBSTACLE PREP",tm:"15 min",c:"#7FDBFF",note:"Core strength for obstacles",
        ex:[{name:"Plank to Push-Up",rx:"3×10",ld:"BW",w:"Core stability"},{name:"Bear Crawl Hold",rx:`3×${20+wk*2}s`,ld:"BW",w:"Full body tension"},{name:"Pallof Press",rx:"3×12 ea",ld:"Band or cable",w:"Anti-rotation"},{name:"Turkish Get-Ups",rx:"3×3 ea",ld:`${wk>=5?26:18} lb KB`,w:"Full body control"},{name:wk>=9?"Toes to Bar":"Hanging Knee Raise",rx:"3×8-12",ld:"From bar",w:"Grip + core"}]},
      { n:"COOL-DOWN",t:"RECOVERY",tm:"5 min",c:"#555",ex:[{name:"Easy Walk",rx:"2 min",ld:"Bring HR down"},{name:"90/90 Hip Stretch",rx:"60s ea",ld:"Each side"},{name:"Calf Stretch",rx:"30s ea",ld:"Wall stretch"},{name:"Hamstring Stretch",rx:"60s ea",ld:"Each leg"}]},
    ]};

  const wed = { day:"WED", title:dt[2], color:"#FF851B",focus:p==="FOUNDATION"?"CrossFit Fundamentals":p==="BUILD"?"MetCon Mayhem":"Beast Mode WOD",
    blocks:[
      { n:"WARM-UP",t:"DYNAMIC PREP",tm:"8 min",c:"#555",ex:[{name:"Row/Bike/Run",rx:"3 min",ld:"Build intensity"},{name:"PVC Pass-Throughs",rx:"15",ld:"Shoulder mobility"},{name:"Samson Stretch",rx:"30s ea",ld:"Hip flexors"},{name:"Inchworm to Push-Up",rx:"10",ld:"Full body activation"},{name:"Air Squats",rx:"15",ld:"Deep & controlled"}]},
      { n:wk>=9?"STRENGTH/SKILL":"SKILL WORK",t:wk>=9?"OLYMPIC LIFTING":"MOVEMENT PRACTICE",tm:"15 min",c:"#FF851B",note:wk>=9?"Build to moderate weight, focus on form":"Practice technique, build confidence",
        ex:[
          ...(wk>=5?[{name:"Power Clean",rx:wk>=9?"5×3":"5×5",ld:wk>=9?`${Math.min(bump(pw(2,1,0),75),115)} lb`:"65 lb",w:"Explosive power"}]:[{name:"Hang Power Clean",rx:"5×5",ld:"45 lb bar",w:"Learn the movement"}]),
          {name:"Front Squat",rx:"3×8",ld:wk>=5?`${Math.min(bump(pw(2,1,1),65),95)} lb`:"45 lb",w:"Core & leg strength"},
          ...(wk>=9?[{name:"Push Jerk",rx:"3×5",ld:`${Math.min(bump(pw(2,1,2),65),95)} lb`,w:"Overhead power"}]:[])
        ]},
      { n:"WOD",t:bm?"BENCHMARK TEST":"WORKOUT OF THE DAY",tm:p==="FOUNDATION"?"12 min":p==="BUILD"?"15 min":"20 min",c:"#FF4136",amrap:true,
        note:bm?"Go all out! Log rounds + reps":"Pace yourself, maintain form",
        ex:[
          ...(p==="FOUNDATION"?[
            {name:"Box Jumps",rx:"10",ld:"20\" box",w:"Explosive legs"},
            {name:"Push-Ups",rx:"10",ld:"BW",w:"Upper body endurance"},
            {name:"KB Swings",rx:"15",ld:"35 lb",w:"Posterior chain"},
            {name:"Sit-Ups",rx:"15",ld:"BW",w:"Core endurance"}
          ]:p==="BUILD"?[
            {name:"Wall Balls",rx:"15",ld:"14 lb",w:"Full body power"},
            {name:"Pull-Ups",rx:"10",ld:"BW",w:"Back strength"},
            {name:"Box Jump Overs",rx:"10",ld:"24\" box",w:"Agility"},
            {name:"Thrusters",rx:"10",ld:"65 lb",w:"Legs & shoulders"}
          ]:[
            {name:"Burpee Box Jumps",rx:"10",ld:"24\" box",w:"Full body explosion"},
            {name:"Toes to Bar",rx:"10",ld:"BW",w:"Core & grip"},
            {name:"DB Snatches",rx:"10 alt",ld:"35 lb",w:"Power & coordination"},
            {name:"Double Unders",rx:"30",ld:"Jump rope",w:"Cardio & coordination"}
          ])
        ]},
      { n:"FINISHER",t:wk>=5?"EMOM 10":"TABATA",tm:wk>=5?"10 min":"8 min",c:"#B10DC9",
        note:wk>=5?"Every Minute On the Minute":"20s on / 10s off × 8 rounds",
        ex:wk>=5?[
          {name:"Cal Row/Bike",rx:"12",ld:"Max effort",w:"Minute 1"},
          {name:"Burpees",rx:"8",ld:"BW",w:"Minute 2"}
        ]:[
          {name:"Mountain Climbers",rx:"20s max",ld:"BW",w:"Speed"},
          {name:"Rest",rx:"10s",ld:"Breathe",w:"Recovery"}
        ]},
      { n:"COOL-DOWN",t:"RECOVERY",tm:"8 min",c:"#555",ex:[{name:"Easy Walk/Row",rx:"3 min",ld:"Bring HR down"},{name:"Pigeon Pose",rx:"90s ea",ld:"Hip stretch"},{name:"Child's Pose",rx:"90s",ld:"Back stretch"},{name:"Foam Roll",rx:"3 min",ld:"Focus on tight spots"}]},
    ]};

  const thu = { day:"THU", title:dt[3], color:"#2ECC40",focus:p==="FOUNDATION"?"Functional Strength":p==="BUILD"?"Obstacle Prep":"Race Simulation",
    blocks:[
      { n:"WARM-UP",t:"ACTIVATE",tm:"8 min",c:"#555",ex:[{name:"Assault Bike/Row",rx:"3 min",ld:"Build intensity"},{name:"Bear Crawl",rx:"20 steps",ld:"Forward & back"},{name:"Cossack Squats",rx:"10 ea",ld:"BW",w:"Hip mobility"},{name:"Spiderman Lunges",rx:"10 ea",ld:"With rotation"},{name:"Burpees",rx:"10",ld:"Get heart rate up"}]},
      { n:"STRENGTH CIRCUIT",t:"FUNCTIONAL POWER",tm:"20 min",c:"#2ECC40",note:"3 rounds, 90s rest between rounds",
        ex:[
          {name:wk>=5?"Sandbag Squat":"Goblet Squat",rx:"3×12",ld:wk>=5?"60 lb bag":"50 lb KB",w:"Functional leg strength"},
          {name:"Tire Flips",rx:"3×5",ld:"Medium tire",w:"Full body power"},
          {name:wk>=9?"Rope Climb":"Rope Pull-Ups",rx:wk>=9?"3×1":"3×8",ld:"15 ft rope",w:"Grip & pulling"},
          {name:"Sled Push",rx:"3×40 yd",ld:p==="FOUNDATION"?"90 lb":p==="BUILD"?"135 lb":"180 lb",w:"Leg drive"}
        ]},
      { n:"OBSTACLE TRAINING",t:wk>=9?"RACE SPECIFIC":"BUILD SKILLS",tm:"15 min",c:"#01FF70",note:"Focus on technique, not speed",
        ex:[
          {name:"Spear Throw",rx:"10 throws",ld:"Practice form",w:"Accuracy"},
          {name:"Wall Balls",rx:"3×20",ld:"20 lb",w:"Wall sim"},
          {name:"Bucket Carry",rx:"2×100 yd",ld:"50 lb",w:"Grip endurance"},
          ...(wk>=5?[{name:"Atlas Stone Lift",rx:"3×5",ld:"50 lb stone",w:"Heavy carries"}]:[])
        ]},
      { n:"CONDITIONING",t:"SPARTAN ENDURANCE",tm:"12 min",c:"#FF851B",amrap:true,note:"Maintain steady pace",
        ex:[
          {name:"Box Step-Ups",rx:"10 ea",ld:"20\" box + 25 lb",w:"Weighted endurance"},
          {name:"Pull-Ups",rx:"8",ld:"BW",w:"Upper body"},
          {name:"Sandbag Carry",rx:"40 yd",ld:"40 lb",w:"Carry under fatigue"},
          {name:"Burpee Broad Jumps",rx:"5",ld:"BW",w:"Explosive endurance"}
        ]},
      { n:"GRIP FINISHER",t:"SPARTAN GRIP",tm:"5 min",c:"#FFDC00",note:"Don't let go!",
        ex:[{name:"Dead Hang",rx:"Max hold ×3",ld:"From bar",w:"Rest = 2× hang time"},{name:"Farmer Hold",rx:"Max hold ×2",ld:"Heavy KBs",w:"Crush grip"}]},
      { n:"COOL-DOWN",t:"RECOVERY",tm:"8 min",c:"#555",ex:[{name:"Easy Walk",rx:"3 min",ld:"Bring HR down"},{name:"Foam Roll",rx:"3 min",ld:"IT band, quads, calves"},{name:"Couch Stretch",rx:"90s ea",ld:"Hip flexors"}]},
    ]};

  const fri = { day:"FRI", title:dt[4], color:"#FFDC00",focus:`${runLong} Obstacle Run + Grip Work`,
    blocks:[
      { n:"WARM-UP",t:"PRE-RUN ACTIVATION",tm:"8 min",c:"#555",ex:[{name:"Easy Jog",rx:"4 min",ld:"Very easy pace"},{name:"Dynamic Stretching",rx:"2 min",ld:"Full body"},{name:"Strides",rx:"3×30s",ld:"Build speed gradually"},{name:"Arm Circles",rx:"20 ea",ld:"Shoulder prep"}]},
      { n:"OBSTACLE RUN",t:wk>=9?"RACE SIMULATION":"ENDURANCE + OBSTACLES",tm:p==="FOUNDATION"?"25–30 min":p==="BUILD"?"35–40 min":p==="PEAK"?"45–55 min":"50–60 min",c:"#FFDC00",
        note:p==="RACE PREP"?"Race simulation with obstacle breaks":"Run with obstacle stations every mile",
        ex:[{name:"Steady Run",rx:"5-8 min",ld:"Target pace",w:"First segment"},
          {name:"Obstacle Station 1",rx:"2 min",ld:"20 burpees + 20 squats",w:"Quick transition"},
          {name:"Continue Run",rx:"5-8 min",ld:"Resume pace",w:"Second segment"},
          {name:"Obstacle Station 2",rx:"2 min",ld:"Bear crawl 20m + 10 pull-ups",w:"Maintain form"},
          {name:"Continue Run",rx:"5-8 min",ld:"Target pace",w:"Third segment"},
          ...(wk>=5?[{name:"Obstacle Station 3",rx:"2 min",ld:"Carry simulation",w:"Sandbag or KB"}]:[]),
          {name:"Final Run",rx:"5-10 min",ld:"Strong finish",w:"Track total distance"}]},
      { n:"GRIP & CARRY",t:"SPARTAN SPECIFIC",tm:"12 min",c:"#FF851B",note:"Focus on grip endurance",
        ex:[{name:"Dead Hang",rx:`3×${20+wk*2}s`,ld:"From bar",w:"Build grip strength"},{name:"Farmer Walk",rx:"3×60 yd",ld:"Heavy KBs",w:"Don't drop them"},{name:"Plate Pinch",rx:"3×max",ld:"10-25 lb plates",w:"Finger strength"},...(wk>=9?[{name:"Rope Traverse",rx:"3×20 ft",ld:"Horizontal",w:"Rig simulation"}]:[])]},
      { n:"FINISHER",t:"SPARTAN STRONG",tm:"10 min",c:"#B10DC9",note:"End the week strong",
        ex:[{name:"Push-Up Pyramid",rx:"1-5-1",ld:"BW",w:"Up and down"},{name:"Pull-Up Pyramid",rx:"1-3-1",ld:"BW",w:"Quality reps"},{name:"Plank Hold",rx:"Max",ld:"BW",w:"Finish strong"}]},
      { n:"COOL-DOWN",t:"WEEKEND RECOVERY",tm:"10 min",c:"#555",ex:[{name:"Easy Walk",rx:"3 min",ld:"Gradual cooldown"},{name:"Foam Roll",rx:"4 min",ld:"Full body"},{name:"Static Stretching",rx:"3 min",ld:"Hold 30s each"},{name:"Deep Breathing",rx:"2 min",ld:"4-7-8 pattern"}]},
    ]};

  return [mon, tue, wed, thu, fri];
}

// Seed data for Week 1
const SEED_DATA = {1:{
  0:{ck:{"0-0":1,"0-1":1,"0-2":1,"0-3":1,"1-0":1,"1-1":1,"2-0":1,"2-1":1,"3-0":1,"3-1":1,"3-2":1,"4-0":1,"4-1":1,"4-2":1,"4-3":1,"5-0":1,"5-1":1},lg:{"1-0":{a:"3×10",wt:"85 lb",n:"Could go to 95"},"1-1":{a:"3×12",wt:"10 lb DBs",n:"Light — go heavier"},"2-0":{a:"3×10",wt:"85 lb",n:"First week back"},"2-1":{a:"3×10",wt:"30 lb DBs",n:""},"3-0":{a:"3×8",wt:"30 lb DBs",n:""},"3-1":{a:"3×max",wt:"BW",n:""},"3-2":{a:"2×12",wt:"30 lb DBs",n:""},"4-0":{a:"4 rds",wt:"—",n:""},"4-1":{a:"4 rds",wt:"35 lb",n:""},"4-2":{a:"4 rds",wt:"BW",n:""}},ar:{4:"4"}},
  1:{ck:{"0-0":1,"0-1":1,"0-2":1,"0-3":1,"1-0":1,"1-1":1,"1-2":1,"1-3":1,"1-4":1,"2-0":1,"2-1":1,"2-2":1,"2-3":1,"2-4":1,"3-0":1,"3-1":1,"3-2":1},lg:{"1-0":{a:"5 min",wt:"—",n:""},"1-1":{a:"2 min ×4",wt:"—",n:"4 rounds"},"1-2":{a:"1 min ×4",wt:"—",n:""},"1-3":{a:"×4 rounds",wt:"—",n:"22 min, 2 miles"},"1-4":{a:"5 min",wt:"—",n:""},"2-0":{a:"3×45s",wt:"BW",n:""},"2-1":{a:"3×12 ea",wt:"BW",n:""},"2-2":{a:"3×10 ea",wt:"26 lb KB",n:""},"2-3":{a:"3×20s",wt:"BW",n:""},"2-4":{a:"3×10",wt:"Med ball",n:""}},ar:{}},
}};

// ══════════════════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════════════════
const I={
  ck:<svg width="13" height="13" viewBox="0 0 18 18" fill="none"><path d="M4 9L7.5 12.5L14 5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  run:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ch:o=><svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{transform:o?"rotate(180deg)":"",transition:"transform .2s"}}><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  fire:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.13-5.59 3.5-7.13.37-.42 1.07-.15 1.07.42 0 1.48.67 2.56 1.71 2.56.7 0 1.07-.42 1.27-.87.55-1.22.73-3.04.17-5.34-.14-.57.47-1.01.97-.68C15.32 6.56 21 10.53 21 15c0 4.42-4.03 8-9 8z"/></svg>,
  chart:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 5-9"/></svg>,
  list:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  link:<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  search:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  trophy:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>,
};

// ══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function ExRow({ex,bk,ei,dl,tog,logCh,col}){
  const k=`${bk}-${ei}`,on=dl?.ck?.[k],d=dl?.lg?.[k]||{},vid=VIDS[ex.name];
  return(<div style={{marginBottom:5}}>
    <div onClick={()=>tog(k)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:7,cursor:"pointer",background:on?"rgba(255,255,255,0.02)":"transparent",borderLeft:`3px solid ${on?"rgba(255,255,255,0.08)":col}`,opacity:on?.5:1,transition:"all .2s"}}>
      <div style={{width:19,height:19,borderRadius:5,flexShrink:0,border:on?"none":"2px solid rgba(255,255,255,0.15)",background:on?col:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#000"}}>{on&&I.ck}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:4}}>
          <span style={{fontFamily:F.h,fontSize:13,fontWeight:500,letterSpacing:.4,textTransform:"uppercase",textDecoration:on?"line-through":"none",color:on?"rgba(255,255,255,0.4)":"#fff"}}>
            {ex.name}{vid&&<a href={vid} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{marginLeft:4,color:"rgba(255,255,255,0.2)",verticalAlign:"middle"}}>{I.link}</a>}
          </span>
          <span style={{fontFamily:F.m,fontSize:11,color:col,fontWeight:600,flexShrink:0,opacity:on?.4:1}}>{ex.rx}</span>
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{ex.ld}{ex.w?` — ${ex.w}`:""}</div>
      </div>
    </div>
    {on&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,padding:"5px 9px 5px 41px",opacity:.7}}>
      <input style={iS()} placeholder="Actual" value={d.a||""} onClick={e=>e.stopPropagation()} onChange={e=>logCh(k,"a",e.target.value)}/>
      <input style={iS()} placeholder="Weight" value={d.wt||""} onClick={e=>e.stopPropagation()} onChange={e=>logCh(k,"wt",e.target.value)}/>
      <input style={iS()} placeholder="Note" value={d.n||""} onClick={e=>e.stopPropagation()} onChange={e=>logCh(k,"n",e.target.value)}/>
    </div>}
  </div>);
}

function Blk({b,bi,dl,tog,logCh,arCh,onRunTracker}){
  const [open,setOpen]=useState(true);
  const dn=b.ex.filter((_,i)=>dl?.ck?.[`${bi}-${i}`]).length,tt=b.ex.length;
  const isRunBlock = b.n && b.n.includes("RUN");
  console.log(`Block: ${b.n}, isRunBlock: ${isRunBlock}, onRunTracker: ${!!onRunTracker}`);
  return(<div style={{marginBottom:12,background:"rgba(255,255,255,0.02)",borderRadius:10,border:"1px solid rgba(255,255,255,0.05)",overflow:"hidden"}}>
    <div style={{height:2,background:"rgba(255,255,255,0.04)"}}><div style={{height:"100%",width:`${tt?dn/tt*100:0}%`,background:b.c,transition:"width .3s",borderRadius:"0 1px 1px 0"}}/></div>
    <div onClick={()=>setOpen(!open)} style={{padding:"11px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{fontFamily:F.h,fontSize:14,fontWeight:600,color:"#fff",letterSpacing:.5}}>{b.n}</div><div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:1.1,marginTop:1}}>{b.t} • {b.tm}</div></div>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        {isRunBlock && onRunTracker && (
          <button
            onClick={(e)=>{e.stopPropagation();onRunTracker();}}
            style={{background:"#0074D9",border:"2px solid #fff",borderRadius:5,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,boxShadow:"0 2px 8px rgba(0,116,217,0.4)"}}
            title="Start GPS Run Tracker"
          >
            {I.run}
            <span style={{fontFamily:F.m,fontSize:10,color:"#fff",fontWeight:600}}>TRACK RUN</span>
          </button>
        )}
        <span style={{fontFamily:F.m,fontSize:10,color:"rgba(255,255,255,0.2)"}}>{dn}/{tt}</span><span style={{color:"rgba(255,255,255,0.2)"}}>{I.ch(open)}</span>
      </div>
    </div>
    {open&&<div style={{padding:"0 12px 10px"}}>
      {b.ex.map((ex,i)=>(<ExRow key={i} ex={ex} bk={bi} ei={i} dl={dl} tog={tog} logCh={logCh} col={b.c}/>))}
      {b.amrap&&<div style={{padding:"7px 9px",marginTop:4,background:"rgba(1,255,112,0.04)",borderRadius:6,display:"flex",alignItems:"center",gap:7}}>
        <span style={{fontFamily:F.h,fontSize:11,color:"#01FF70",letterSpacing:1}}>AMRAP ROUNDS:</span>
        <input style={iS({width:55,textAlign:"center",background:"rgba(1,255,112,0.08)",borderColor:"rgba(1,255,112,0.2)"})} type="number" placeholder="0" value={dl?.ar?.[bi]??""} onChange={e=>arCh(bi,e.target.value)}/>
      </div>}
      {b.note&&<div style={{marginTop:7,padding:"6px 9px",background:"rgba(255,255,255,0.02)",borderRadius:5,fontSize:10,color:"rgba(255,255,255,0.3)",borderLeft:`2px solid ${b.c}30`,fontStyle:"italic"}}>{b.note}</div>}
    </div>}
  </div>);
}

// ══════════════════════════════════════════════════════════════════════════════
// PROGRESS DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function ProgressDashboard({st}){
  const calcStats = () => {
    let totalExercises = 0, loggedExercises = 0, totalAmraps = 0, completedWeeks = 0;
    const strengthData = {}, runData = [];
    
    // Process all weeks data
    Object.keys(st.data || {}).forEach(week => {
      const wk = parseInt(week);
      const prog = genWeek(wk, wk > 1 ? st.data[wk-1] : null);
      let weekExercises = 0, weekLogged = 0;
      
      DAYS.forEach((_, di) => {
        const dayData = st.data[week]?.[di] || {ck:{}, lg:{}, ar:{}};
        prog[di].blocks.forEach((block, bi) => {
          block.ex.forEach((ex, ei) => {
            totalExercises++;
            weekExercises++;
            const key = `${bi}-${ei}`;
            if(dayData.ck?.[key]) {
              loggedExercises++;
              weekLogged++;
              
              // Track strength progression
              const logData = dayData.lg?.[key];
              if(logData?.wt && ex.name) {
                const match = logData.wt.match(/(\d+)/);
                if(match) {
                  const weight = parseInt(match[1]);
                  if(!strengthData[ex.name]) strengthData[ex.name] = [];
                  strengthData[ex.name].push({week: wk, weight, day: di});
                }
              }
            }
          });
          
          // Count AMRAPs
          if(block.amrap && dayData.ar?.[bi]) {
            totalAmraps++;
          }
        });
        
        // Collect run data
        if(di === 1 || di === 4) { // Tuesday and Friday runs
          const runBlock = prog[di].blocks.find(b => b.n.includes("RUN"));
          if(runBlock) {
            runData.push({week: wk, day: di === 1 ? "TUE" : "FRI", logged: weekLogged > 0});
          }
        }
      });
      
      if(weekLogged === weekExercises && weekExercises > 0) completedWeeks++;
    });
    
    return {totalExercises, loggedExercises, totalAmraps, completedWeeks, strengthData, runData};
  };
  
  const stats = calcStats();
  const currentPhase = getPhase(st.week);
  
  const findBiggestGains = () => {
    const gains = [];
    Object.entries(stats.strengthData).forEach(([exercise, data]) => {
      if(data.length >= 2) {
        const sorted = data.sort((a,b) => a.week - b.week);
        const gain = sorted[sorted.length-1].weight - sorted[0].weight;
        if(gain > 0) {
          gains.push({exercise, gain, from: sorted[0].weight, to: sorted[sorted.length-1].weight});
        }
      }
    });
    return gains.sort((a,b) => b.gain - a.gain).slice(0,3);
  };
  
  const biggestGains = findBiggestGains();
  
  return (
    <div style={{padding:14}}>
      {/* Phase Timeline */}
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:F.h,fontSize:16,fontWeight:600,marginBottom:10,letterSpacing:.5}}>PHASE TIMELINE</div>
        <div style={{display:"flex",gap:2}}>
          {PHASES.map(phase => {
            const isActive = st.week >= phase.weeks[0] && st.week <= phase.weeks[1];
            const isComplete = st.week > phase.weeks[1];
            return (
              <div key={phase.name} style={{
                flex:1,
                padding:"8px 6px",
                borderRadius:6,
                background: isActive ? `${phase.color}15` : isComplete ? "rgba(1,255,112,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? `${phase.color}40` : isComplete ? "rgba(1,255,112,0.2)" : "rgba(255,255,255,0.05)"}`,
                textAlign:"center"
              }}>
                <div style={{fontFamily:F.h,fontSize:9,fontWeight:600,color:isActive?phase.color:isComplete?"#01FF70":"rgba(255,255,255,0.3)",letterSpacing:1}}>{phase.name}</div>
                <div style={{fontFamily:F.m,fontSize:8,color:"rgba(255,255,255,0.2)",marginTop:2}}>WK {phase.weeks[0]}-{phase.weeks[1]}</div>
                {isActive && <div style={{width:4,height:4,borderRadius:2,background:phase.color,margin:"4px auto 0"}}/>}
                {isComplete && <div style={{fontFamily:F.m,fontSize:8,color:"#01FF70"}}>✓</div>}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Quick Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        <div style={{padding:12,background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontFamily:F.h,fontSize:20,fontWeight:700,color:"#FF4136"}}>{stats.completedWeeks}/15</div>
          <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.3)"}}>WEEKS COMPLETE</div>
        </div>
        <div style={{padding:12,background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontFamily:F.h,fontSize:20,fontWeight:700,color:"#FF851B"}}>{stats.loggedExercises}</div>
          <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.3)"}}>EXERCISES LOGGED</div>
        </div>
        <div style={{padding:12,background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontFamily:F.h,fontSize:20,fontWeight:700,color:"#01FF70"}}>{stats.totalAmraps}</div>
          <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.3)"}}>AMRAPS COMPLETED</div>
        </div>
        <div style={{padding:12,background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid rgba(255,255,255,0.05)"}}>
          <div style={{fontFamily:F.h,fontSize:20,fontWeight:700,color:"#B10DC9"}}>{Math.round(stats.loggedExercises/stats.totalExercises*100)||0}%</div>
          <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.3)"}}>COMPLETION RATE</div>
        </div>
      </div>
      
      {/* Strength Gains */}
      {biggestGains.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:F.h,fontSize:16,fontWeight:600,marginBottom:10,letterSpacing:.5}}>BIGGEST STRENGTH GAINS</div>
          {biggestGains.map((gain, i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:6,marginBottom:6,border:"1px solid rgba(255,255,255,0.05)"}}>
              <span style={{fontFamily:F.h,fontSize:12,fontWeight:500,letterSpacing:.3}}>{gain.exercise}</span>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:F.h,fontSize:14,fontWeight:600,color:"#01FF70"}}>+{gain.gain} lb</div>
                <div style={{fontFamily:F.m,fontSize:8,color:"rgba(255,255,255,0.3)"}}>{gain.from} → {gain.to}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Weekly Completion Bars */}
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:F.h,fontSize:16,fontWeight:600,marginBottom:10,letterSpacing:.5}}>WEEKLY PROGRESS</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5, 1fr)",gap:4}}>
          {Array.from({length:15}, (_, i) => {
            const week = i + 1;
            const weekData = st.data?.[week];
            let completed = 0, total = 0;
            
            if(weekData) {
              const prog = genWeek(week, week > 1 ? st.data[week-1] : null);
              DAYS.forEach((_, di) => {
                const dayData = weekData[di] || {ck:{}};
                prog[di].blocks.forEach((block, bi) => {
                  block.ex.forEach((_, ei) => {
                    total++;
                    if(dayData.ck?.[`${bi}-${ei}`]) completed++;
                  });
                });
              });
            }
            
            const pct = total ? completed/total*100 : 0;
            const phase = getPhase(week);
            const isCurrentWeek = week === st.week;
            
            return (
              <div key={week} style={{textAlign:"center"}}>
                <div style={{fontFamily:F.m,fontSize:8,color:isCurrentWeek?phase.color:"rgba(255,255,255,0.3)",marginBottom:2}}>W{week}</div>
                <div style={{height:40,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden",border:isCurrentWeek?`1px solid ${phase.color}40`:"1px solid rgba(255,255,255,0.05)"}}>
                  <div style={{
                    height:"100%",
                    width:`${pct}%`,
                    background: pct === 100 ? "#01FF70" : phase.color,
                    transition:"width 0.3s"
                  }} />
                </div>
                <div style={{fontFamily:F.m,fontSize:7,color:"rgba(255,255,255,0.2)",marginTop:2}}>{Math.round(pct)}%</div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* AMRAP Benchmarks */}
      <div>
        <div style={{fontFamily:F.h,fontSize:16,fontWeight:600,marginBottom:10,letterSpacing:.5}}>AMRAP BENCHMARKS</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8}}>
          {[4,8,12].map(benchWeek => {
            const weekData = st.data?.[benchWeek];
            let amrapRounds = [];
            
            if(weekData) {
              DAYS.forEach((_, di) => {
                const dayData = weekData[di] || {ar:{}};
                Object.entries(dayData.ar || {}).forEach(([blockIdx, rounds]) => {
                  if(rounds) amrapRounds.push({day:DAYS[di], rounds:parseInt(rounds)});
                });
              });
            }
            
            const isComplete = st.week > benchWeek;
            const isCurrent = st.week === benchWeek;
            
            return (
              <div key={benchWeek} style={{
                padding:10,
                background: isCurrent ? "rgba(255,220,0,0.08)" : isComplete ? "rgba(1,255,112,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${isCurrent ? "rgba(255,220,0,0.2)" : isComplete ? "rgba(1,255,112,0.1)" : "rgba(255,255,255,0.05)"}`,
                borderRadius:8,
                textAlign:"center"
              }}>
                <div style={{fontFamily:F.h,fontSize:12,fontWeight:600,color:isCurrent?"#FFDC00":isComplete?"#01FF70":"rgba(255,255,255,0.4)",marginBottom:4}}>WEEK {benchWeek}</div>
                {amrapRounds.length > 0 ? (
                  amrapRounds.map((amrap, i) => (
                    <div key={i} style={{fontFamily:F.m,fontSize:10,color:"rgba(255,255,255,0.6)"}}>
                      {amrap.day}: {amrap.rounds} rounds
                    </div>
                  ))
                ) : (
                  <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.2)"}}>
                    {isCurrent ? "In Progress" : st.week < benchWeek ? "Upcoming" : "Not Logged"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXERCISE HISTORY
// ══════════════════════════════════════════════════════════════════════════════
function ExerciseHistory({st}){
  const [searchTerm, setSearchTerm] = useState("");
  
  const buildExerciseData = () => {
    const exerciseMap = {};
    
    Object.keys(st.data || {}).forEach(week => {
      const wk = parseInt(week);
      const prog = genWeek(wk, wk > 1 ? st.data[wk-1] : null);
      
      DAYS.forEach((day, di) => {
        const dayData = st.data[week]?.[di] || {ck:{}, lg:{}};
        prog[di].blocks.forEach((block, bi) => {
          block.ex.forEach((ex, ei) => {
            const key = `${bi}-${ei}`;
            const exerciseName = ex.name;
            
            if(!exerciseMap[exerciseName]) {
              exerciseMap[exerciseName] = {
                name: exerciseName,
                category: block.n,
                logs: [],
                totalSessions: 0,
                bestWeight: null,
                latestWeight: null
              };
            }
            
            if(dayData.ck?.[key]) {
              exerciseMap[exerciseName].totalSessions++;
              const logData = dayData.lg?.[key];
              
              if(logData) {
                let weight = null;
                if(logData.wt) {
                  const match = logData.wt.match(/(\d+)/);
                  if(match) weight = parseInt(match[1]);
                }
                
                exerciseMap[exerciseName].logs.push({
                  week: wk,
                  day,
                  weight,
                  reps: logData.a || "",
                  notes: logData.n || ""
                });
                
                if(weight) {
                  if(!exerciseMap[exerciseName].bestWeight || weight > exerciseMap[exerciseName].bestWeight) {
                    exerciseMap[exerciseName].bestWeight = weight;
                  }
                  exerciseMap[exerciseName].latestWeight = weight;
                }
              }
            }
          });
        });
      });
    });
    
    return Object.values(exerciseMap)
      .filter(ex => ex.totalSessions > 0)
      .sort((a,b) => b.totalSessions - a.totalSessions);
  };
  
  const exercises = buildExerciseData();
  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ex.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div style={{padding:14}}>
      {/* Search */}
      <div style={{marginBottom:16,position:"relative"}}>
        <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)"}}>{I.search}</div>
        <input
          style={{...iS({paddingLeft:32,fontSize:12}),borderColor:"rgba(255,255,255,0.1)"}}
          placeholder="Search exercises..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Exercise List */}
      <div style={{fontFamily:F.h,fontSize:16,fontWeight:600,marginBottom:12,letterSpacing:.5}}>
        EXERCISE HISTORY ({filteredExercises.length})
      </div>
      
      {filteredExercises.map((exercise, i) => {
        const hasWeightProgression = exercise.logs.filter(log => log.weight).length >= 2;
        const sortedWeightLogs = exercise.logs
          .filter(log => log.weight)
          .sort((a,b) => a.week - b.week);
        
        return (
          <div key={i} style={{marginBottom:12,background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid rgba(255,255,255,0.05)",overflow:"hidden"}}>
            <div style={{padding:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontFamily:F.h,fontSize:14,fontWeight:600,letterSpacing:.3}}>{exercise.name}</div>
                  <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.3)"}}>{exercise.category} • {exercise.totalSessions} sessions</div>
                </div>
                {exercise.bestWeight && (
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:F.h,fontSize:12,color:"#01FF70"}}>PR: {exercise.bestWeight} lb</div>
                    {exercise.latestWeight !== exercise.bestWeight && (
                      <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.4)"}}>Current: {exercise.latestWeight} lb</div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Weight Progression Bar */}
              {hasWeightProgression && (
                <div style={{marginBottom:8}}>
                  <div style={{fontFamily:F.m,fontSize:8,color:"rgba(255,255,255,0.3)",marginBottom:4}}>Weight Progression:</div>
                  <div style={{height:20,background:"rgba(255,255,255,0.04)",borderRadius:3,overflow:"hidden",position:"relative"}}>
                    {sortedWeightLogs.map((log, idx) => {
                      const progress = idx / (sortedWeightLogs.length - 1) * 100;
                      return (
                        <div
                          key={idx}
                          style={{
                            position:"absolute",
                            left:`${progress}%`,
                            top:"2px",
                            width:2,
                            height:16,
                            background:"#FF851B",
                            borderRadius:1
                          }}
                          title={`W${log.week}: ${log.weight}lb`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Recent Logs */}
              <div style={{maxHeight:100,overflowY:"auto"}}>
                {exercise.logs.slice(-3).reverse().map((log, idx) => (
                  <div key={idx} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderTop:idx>0?"1px solid rgba(255,255,255,0.05)":"none"}}>
                    <div>
                      <span style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.4)"}}>W{log.week} {log.day}:</span>
                      <span style={{fontFamily:F.m,fontSize:10,color:"#fff",marginLeft:6}}>{log.reps}</span>
                      {log.weight && <span style={{fontFamily:F.m,fontSize:10,color:"#FF851B",marginLeft:4}}>{log.weight}lb</span>}
                    </div>
                    {log.notes && (
                      <div style={{fontFamily:F.m,fontSize:8,color:"rgba(255,255,255,0.3)",fontStyle:"italic",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{log.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      
      {filteredExercises.length === 0 && (
        <div style={{textAlign:"center",padding:20,color:"rgba(255,255,255,0.3)",fontFamily:F.m,fontSize:11}}>
          {searchTerm ? "No exercises match your search" : "No exercises logged yet"}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP — API-connected state management
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [st,setSt]=useState(null);
  const [ld,setLd]=useState(true);
  const [ad,setAd]=useState(0);
  const [vw,setVw]=useState("w");
  const [ss,setSs]=useState("");
  const [pin,setPinState]=useState(getPin());
  const [authed,setAuthed]=useState(false);
  const [showRunTracker,setShowRunTracker]=useState(null);
  const saveTimer=useRef(null);
  const stRef=useRef(null);

  // ── Auth Screen ──
  const tryAuth = async (p) => {
    setPin(p);
    setPinState(p);
    try {
      const data = await loadState();
      setSt(data);
      stRef.current = data;
      setAuthed(true);
      // If empty, seed it
      if (!data.data || Object.keys(data.data).length === 0) {
        await seedData(SEED_DATA);
        const fresh = await loadState();
        setSt(fresh);
        stRef.current = fresh;
      }
      setSs("connected");
      setLd(false);
    } catch(e) {
      setSs("auth failed: " + String(e).slice(0,40));
      setAuthed(false);
      setLd(false);
    }
  };

  // Auto-auth on mount if PIN exists
  useEffect(() => {
    if (pin) { tryAuth(pin); }
    else { setLd(false); }
  }, []);

  // ── Save: debounced API call per day ──
  const saveDayToServer = useCallback((week, dayIndex, dayLog) => {
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSs("saving...");
      try {
        await saveDay(week, dayIndex, dayLog);
        setSs("✓ saved");
        setTimeout(() => setSs(""), 2000);
      } catch(e) {
        setSs("save error: " + String(e).slice(0,30));
      }
    }, 600);
  }, []);

  const gl = di => st?.data?.[st.week]?.[di] || {ck:{},lg:{},ar:{}};

  const ul = (di, fn) => {
    const ns = {...st, data:{...st.data}};
    if(!ns.data[st.week]) ns.data[st.week] = {};
    ns.data[st.week] = {...ns.data[st.week]};
    const cur = gl(di);
    const dl = {ck:{...cur.ck}, lg:{...cur.lg}, ar:{...cur.ar}};
    fn(dl);
    ns.data[st.week][di] = dl;
    setSt(ns);
    stRef.current = ns;
    // Save this specific day to the server
    saveDayToServer(st.week, di, dl);
  };

  const tog = (di,k) => ul(di, l => { l.ck[k] = l.ck[k] ? 0 : 1; });
  const logC = (di,k,f,v) => ul(di, l => { l.lg[k] = {...(l.lg[k]||{}), [f]:v}; });
  const arC = (di,bi,v) => ul(di, l => { l.ar[bi] = v; });

  const chW = async (d) => {
    const nw = Math.max(1, Math.min(15, st.week+d));
    try {
      await apiSetWeek(nw);
      const ns = {...st, week:nw, data:{...st.data, ...(!st.data[nw]?{[nw]:{}}:{})}};
      setSt(ns);
      stRef.current = ns;
    } catch(e) { setSs("error: " + String(e).slice(0,30)); }
  };

  const reset = async () => {
    if(window.confirm("Reset ALL data? This cannot be undone.")) {
      try {
        await apiReset();
        await seedData(SEED_DATA);
        const fresh = await loadState();
        setSt(fresh);
        stRef.current = fresh;
        setSs("reset complete");
      } catch(e) { setSs("reset error"); }
    }
  };

  // ── Loading ──
  if(ld) return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontFamily:F.m,fontSize:12,color:"rgba(255,255,255,0.3)",letterSpacing:2}}>LOADING...</div>
    </div>
  );

  // ── PIN Entry Screen ──
  if(!authed) return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,padding:20}}>
      <div style={{fontFamily:F.h,fontSize:32,fontWeight:700,color:"#FF4136",letterSpacing:2}}>SPARTAN</div>
      <div style={{fontFamily:F.m,fontSize:11,color:"rgba(255,255,255,0.3)"}}>Enter your PIN to access training</div>
      <input
        style={{...iS({width:200,textAlign:"center",fontSize:18,padding:"12px 16px",letterSpacing:4}),borderColor:"rgba(255,65,54,0.3)"}}
        type="password" placeholder="PIN" autoFocus
        onKeyDown={e => { if(e.key === "Enter") tryAuth(e.target.value); }}
        onChange={e => setPinState(e.target.value)}
        value={pin}
      />
      <button onClick={() => tryAuth(pin)} style={{padding:"10px 32px",background:"#FF4136",border:"none",borderRadius:6,fontFamily:F.h,fontSize:14,fontWeight:600,color:"#fff",cursor:"pointer",letterSpacing:1}}>ENTER</button>
      {ss && <div style={{fontFamily:F.m,fontSize:10,color:"rgba(255,65,54,0.7)"}}>{ss}</div>}
    </div>
  );

  if(!st) return null;

  const prog = genWeek(st.week, st.week>1 ? st.data[st.week-1] : null);
  const pg = prog[ad], dl = gl(ad);
  const tE = pg.blocks.reduce((s,b) => s+b.ex.length, 0);
  const dE = Object.values(dl.ck||{}).filter(Boolean).length;
  let wT=0, wD=0;
  DAYS.forEach((_,di) => {const d=gl(di); prog[di].blocks.forEach((b,bi) => b.ex.forEach((_,ei) => {wT++; if(d.ck?.[`${bi}-${ei}`]) wD++;}));});
  const wP = wT ? Math.round(wD/wT*100) : 0;
  const phase = getPhase(st.week), bm = isBench(st.week);
  const tb = (id,c) => ({background:vw===id?`${c}15`:"rgba(255,255,255,0.04)",border:`1px solid ${vw===id?`${c}40`:"rgba(255,255,255,0.06)"}`,borderRadius:6,padding:"6px 9px",cursor:"pointer",color:vw===id?c:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center"});

  return(
    <div style={{minHeight:"100vh",background:"#0A0A0A",color:"#fff",fontFamily:F.h}}>
      {/* Header */}
      <div style={{padding:"14px 14px 0",background:"linear-gradient(180deg,#141414,#0A0A0A)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontFamily:F.m,fontSize:8,padding:"2px 6px",borderRadius:3,background:`${phase.color}15`,color:phase.color,border:`1px solid ${phase.color}30`,letterSpacing:1}}>{phase.name}</span>
            {bm&&<span style={{fontFamily:F.m,fontSize:8,padding:"2px 6px",borderRadius:3,background:"rgba(255,220,0,0.1)",color:"#FFDC00",border:"1px solid rgba(255,220,0,0.25)"}}>★ BENCHMARK</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontFamily:F.m,fontSize:8,color:ss.includes("✓")?"rgba(1,255,112,0.7)":ss.includes("saving")?"rgba(255,220,0,0.5)":ss.includes("error")?"rgba(255,65,54,0.7)":"rgba(255,255,255,0.15)"}}>{ss}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>chW(-1)} disabled={st.week<=1} style={{background:"none",border:"none",color:st.week<=1?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:18,fontFamily:F.h}}>‹</button>
            <div>
              <div style={{fontSize:21,fontWeight:700,letterSpacing:1,lineHeight:1}}>WEEK {st.week} <span style={{fontSize:12,fontWeight:400,color:"rgba(255,255,255,0.3)"}}>/ 15</span></div>
              <div style={{fontFamily:F.m,fontSize:9,color:"rgba(255,255,255,0.2)"}}>{phase.desc}</div>
            </div>
            <button onClick={()=>chW(1)} disabled={st.week>=15} style={{background:"none",border:"none",color:st.week>=15?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:18,fontFamily:F.h}}>›</button>
          </div>
          <div style={{display:"flex",gap:3}}>
            <button onClick={()=>setVw("w")} style={tb("w","#FF4136")}>{I.fire}</button>
            <button onClick={()=>setVw("p")} style={tb("p","#FFDC00")}>{I.chart}</button>
            <button onClick={()=>setVw("h")} style={tb("h","#0074D9")}>{I.list}</button>
          </div>
        </div>
        <div style={{height:3,background:"rgba(255,255,255,0.04)",borderRadius:2,marginBottom:10}}>
          <div style={{height:"100%",borderRadius:2,transition:"width .4s",width:`${wP}%`,background:wP===100?"linear-gradient(90deg,#01FF70,#2ECC40)":`linear-gradient(90deg,${phase.color},${phase.color}90)`}}/>
        </div>
        {vw==="w"&&<div style={{display:"flex",gap:3,paddingBottom:10}}>
          {DAYS.map((lb,i)=>{const d=gl(i);let t=0,n=0;prog[i].blocks.forEach((b,bi)=>b.ex.forEach((_,ei)=>{t++;if(d.ck?.[`${bi}-${ei}`])n++;}));const done=t>0&&n===t,act=ad===i;
            return(<button key={i} onClick={()=>setAd(i)} style={{flex:1,padding:"7px 3px",borderRadius:7,cursor:"pointer",border:"none",background:act?`${prog[i].color}18`:"rgba(255,255,255,0.03)",borderBottom:act?`2px solid ${prog[i].color}`:"2px solid transparent"}}>
              <div style={{fontFamily:F.h,fontSize:12,fontWeight:600,color:act?prog[i].color:"rgba(255,255,255,0.3)",letterSpacing:1}}>{lb}</div>
              {done&&<div style={{width:6,height:6,borderRadius:3,background:"#01FF70",margin:"3px auto 0"}}/>}
            </button>);
          })}
        </div>}
      </div>

      {/* Content */}
      <div style={{maxWidth:500,margin:"0 auto"}}>
        {vw==="w"?<div style={{padding:14}}>
          <div style={{marginBottom:13}}>
            <div style={{display:"inline-block",padding:"3px 7px",borderRadius:4,background:`${pg.color}15`,border:`1px solid ${pg.color}30`,fontFamily:F.m,fontSize:9,letterSpacing:1.5,color:pg.color,marginBottom:6}}>{pg.focus}</div>
            <div style={{fontSize:22,fontWeight:700,lineHeight:1,letterSpacing:.5}}>{pg.title}</div>
            <div style={{fontFamily:F.m,fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:5}}>{dE}/{tE} exercises • Tap to check off & log</div>
          </div>
          {pg.blocks.map((b,bi)=>{
            console.log(`Day: ${DAYS[ad]}, ad: ${ad}, should show tracker: ${(ad===1||ad===4)}`);
            return (<Blk key={bi} b={b} bi={bi} dl={dl} tog={k=>tog(ad,k)} logCh={(k,f,v)=>logC(ad,k,f,v)} arCh={(b2,v)=>arC(ad,b2,v)} onRunTracker={(ad===1||ad===4)?()=>setShowRunTracker({show:true,day:ad}):null}/>);
          })}
          {dE===tE&&tE>0&&<div style={{textAlign:"center",padding:16,background:"rgba(1,255,112,0.04)",borderRadius:10,border:"1px solid rgba(1,255,112,0.12)",marginBottom:12}}>
            <div style={{fontSize:26,fontWeight:700,color:"#01FF70",letterSpacing:2}}>AROO!</div>
            <div style={{fontFamily:F.m,fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{pg.day} W{st.week} COMPLETE</div>
          </div>}
        </div>
        :vw==="p"?<ProgressDashboard st={st} />:<ExerciseHistory st={st} />}

        <div style={{padding:"10px 14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:F.m,fontSize:8,color:"rgba(255,255,255,0.08)"}}>SPARTAN SUPER • 15 WEEKS • AUTO-SAVES</div>
          <button onClick={reset} style={{background:"none",border:"none",fontFamily:F.m,fontSize:7,color:"rgba(255,65,54,0.15)",cursor:"pointer"}}>RESET</button>
        </div>
      </div>
      {showRunTracker && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.95)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:"100%",maxWidth:500,height:"100vh",background:"#0A0A0A",overflow:"auto"}}>
            <div style={{padding:"10px 14px",background:"#141414",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontFamily:F.h,fontSize:16,fontWeight:600,color:"#0074D9",letterSpacing:.5}}>RUN TRACKER</div>
              <button
                onClick={()=>setShowRunTracker(null)}
                style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:20,cursor:"pointer"}}
              >×</button>
            </div>
            <RunTracker
              runType={showRunTracker?.day === 1 ? "INTERVALS" : "LONG_RUN"}
              rounds={showRunTracker?.day === 1 ? Math.max(4, Math.floor(st.week/3) + 2) : 0}
              onComplete={(data)=>{
                console.log('Run completed:', data);
                
                // Auto-save run data to workout log
                const dayIdx = showRunTracker.day;
                const runBlockIdx = dayIdx === 1 ? 1 : 1; // Run block is usually index 1
                const runExIdx = 0; // First exercise in run block
                const key = `${runBlockIdx}-${runExIdx}`;
                
                // Format run data for log
                const distance = (data.totalDistance / 1609.34).toFixed(2); // Convert to miles
                const time = Math.floor(data.totalTime / 60);
                const pace = data.totalDistance > 0 ? (data.totalTime / 60) / (data.totalDistance / 1609.34) : 0;
                
                // Update the log with run data
                ul(dayIdx, l => {
                  l.ck[key] = 1; // Mark as completed
                  l.lg[key] = {
                    a: `${time} min`,
                    wt: `${distance} mi`,
                    n: `Pace: ${pace.toFixed(1)} min/mi`
                  };
                  
                  // Log intervals if it was an interval run
                  if (data.splits && data.splits.length > 0) {
                    const intervals = data.splits.filter(s => s.type === 'hard').length;
                    const avgHardPace = data.splits
                      .filter(s => s.type === 'hard')
                      .reduce((sum, s) => sum + s.pace, 0) / intervals || 0;
                    l.lg[key].n = `${intervals} intervals, Avg hard pace: ${avgHardPace.toFixed(1)} min/mi`;
                  }
                });
                
                setSs("✓ Run saved!");
                setTimeout(() => setSs(""), 2000);
                setShowRunTracker(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
