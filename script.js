const $ = (id) => document.getElementById(id);

const environments = {
  sea: {
    title: "صوت أمواج البحر",
    description: "استمع إلى أجواء البحر الهادئة.",
    symbol: "🌊",
    animals: [
      { emoji:"🐬", ar:"الدلفين", en:"Dolphin", call:"صفير الدلفين" },
      { emoji:"🐠", ar:"السمكة", en:"Fish", call:"فقاعات الماء" },
      { emoji:"🐢", ar:"السلحفاة البحرية", en:"Sea turtle", call:"صوت البحر الهادئ" }
    ]
  },
  forest: {
    title: "أصوات الغابة",
    description: "استمع إلى زقزقة الطيور وحفيف أوراق الشجر.",
    symbol: "🌳",
    animals: [
      { emoji:"🦁", ar:"الأسد", en:"Lion", call:"زئير الأسد" },
      { emoji:"🐒", ar:"القرد", en:"Monkey", call:"صوت القرد" },
      { emoji:"🦋", ar:"الفراشة", en:"Butterfly", call:"رفرفة الفراشة" }
    ]
  },
  farm: {
    title: "أصوات المزرعة",
    description: "استمع إلى أجواء المزرعة وأصوات حيواناتها.",
    symbol: "🌾",
    animals: [
      { emoji:"🐮", ar:"البقرة", en:"Cow", call:"صوت البقرة" },
      { emoji:"🐔", ar:"الدجاجة", en:"Chicken", call:"صوت الدجاجة" },
      { emoji:"🐑", ar:"الخروف", en:"Sheep", call:"صوت الخروف" }
    ]
  }
};

const artAnimals = {
  dolphin:{emoji:"🐬",en:"DOLPHIN",shape:"fish"},
  fish:{emoji:"🐠",en:"FISH",shape:"fish"},
  lion:{emoji:"🦁",en:"LION",shape:"lion"},
  monkey:{emoji:"🐵",en:"MONKEY",shape:"round"},
  cow:{emoji:"🐮",en:"COW",shape:"round"},
  butterfly:{emoji:"🦋",en:"BUTTERFLY",shape:"butterfly"},
  turtle:{emoji:"🐢",en:"TURTLE",shape:"turtle"},
  elephant:{emoji:"🐘",en:"ELEPHANT",shape:"elephant"}
};

let sceneKey = "sea";
let animalIndex = 0;
let selectedColor = "#f28fa6";
let erasing = false;
let currentAnimal = "dolphin";
let audioContext = null;
let ambientNodes = [];
let ambientOn = false;
let lastSpeech = "";
let drawing = false;
let undoStack = [];

const canvas = $("drawingCanvas");
const ctx = canvas.getContext("2d");

function speak(text, lang="ar-SA") {
  if (!("speechSynthesis" in window)) {
    $("exploreFeedback").textContent = "القراءة الصوتية غير متاحة في هذا المتصفح.";
    return;
  }
  speechSynthesis.cancel();
  lastSpeech = text;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.86;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function stopAmbient() {
  ambientNodes.forEach(node => {
    try { if (node.stop) node.stop(); } catch(e) {}
    try { if (node.disconnect) node.disconnect(); } catch(e) {}
  });
  ambientNodes = [];
  ambientOn = false;
  $("soundToggle").textContent = "🔊 تشغيل أصوات البيئة";
  $("soundToggle").setAttribute("aria-pressed","false");
  $("sceneSoundButton").textContent = "▶ استمع للأجواء";
}

function noiseSource(ctx, filterType, frequency, gainValue) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  ambientNodes.push(source,filter,gain);
  return gain;
}

function tone(ctx, frequency, duration, volume=0.025, type="sine", delay=0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency,ctx.currentTime+delay);
  gain.gain.setValueAtTime(0.0001,ctx.currentTime+delay);
  gain.gain.exponentialRampToValueAtTime(volume,ctx.currentTime+delay+0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+delay+duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime+delay);
  osc.stop(ctx.currentTime+delay+duration+0.05);
  ambientNodes.push(osc,gain);
}

function playEnvironment(key) {
  stopAmbient();
  const ctx = getAudioContext();
  if (!ctx) return;
  ambientOn = true;
  $("soundToggle").textContent = "🔇 إيقاف أصوات البيئة";
  $("soundToggle").setAttribute("aria-pressed","true");
  $("sceneSoundButton").textContent = "■ إيقاف الأجواء";

  // أصوات بيئية إلكترونية هادئة مولّدة داخل المتصفح، وليست تسجيلات ميدانية.
  if (key === "sea") {
    noiseSource(ctx,"lowpass",420,0.035);
    noiseSource(ctx,"bandpass",850,0.008);
    tone(ctx,520,1.8,0.008,"sine",0.4);
    tone(ctx,610,1.4,0.006,"sine",2.3);
  } else if (key === "forest") {
    noiseSource(ctx,"lowpass",950,0.012);
    [0,1.1,2.5,4.1].forEach((d,i)=>{
      tone(ctx,1500+i*170,0.16,0.012,"sine",d);
      tone(ctx,1900+i*130,0.12,0.009,"sine",d+0.18);
    });
  } else {
    noiseSource(ctx,"lowpass",500,0.009);
    [0.2,1.8,3.4].forEach((d,i)=>{
      tone(ctx,740-i*80,0.22,0.012,"triangle",d);
      tone(ctx,620-i*45,0.18,0.009,"triangle",d+0.28);
    });
  }
}

function animalSound(animal) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const patterns = {
    "الدلفين":[[1100,.12],[1450,.12],[1250,.16],[1650,.1]],
    "السمكة":[[520,.22],[680,.18]],
    "السلحفاة البحرية":[[420,.3]],
    "الأسد":[[115,.45],[90,.55],[130,.3]],
    "القرد":[[650,.13],[820,.13],[610,.2],[900,.12]],
    "الفراشة":[[1300,.08],[1500,.08]],
    "البقرة":[[180,.55],[145,.4]],
    "الدجاجة":[[850,.12],[710,.14],[920,.12]],
    "الخروف":[[390,.28],[330,.35]]
  };
  (patterns[animal.ar] || [[500,.2]]).forEach((p,i)=>tone(ctx,p[0],p[1],.035,"triangle",i*.22));
  $("exploreFeedback").textContent = "هذا تقليد صوتي مبسّط للحيوان، وليس تسجيلًا حقيقيًا.";
}

function renderExplore() {
  const env = environments[sceneKey];
  const animal = env.animals[animalIndex];
  $("soundSymbol").textContent = env.symbol;
  $("soundTitle").textContent = env.title;
  $("soundDescription").textContent = env.description;
  $("animalDisplay").querySelector(".animal-emoji").textContent = animal.emoji;
  $("animalArabic").textContent = animal.ar;
  $("animalEnglish").textContent = animal.en.toUpperCase();
  $("animalCounter").textContent = `${animalIndex+1} / ${env.animals.length}`;
  $("missionTitle").textContent = "من ينتمي إلى هذه البيئة؟";
  $("missionText").textContent = "اختر الحيوان المناسب للمكان الذي تستكشفه.";
  $("exploreFeedback").textContent = "خذ وقتك، واختر الإجابة التي تراها مناسبة.";
  const grid = $("answerGrid");
  grid.innerHTML = "";
  const options = [...env.animals].sort(() => Math.random() - .5);
  options.forEach(option => {
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.innerHTML = `<span class="emoji">${option.emoji}</span><span class="label">${option.ar}</span>`;
    btn.addEventListener("click", () => {
      grid.querySelectorAll("button").forEach(b => b.disabled = true);
      if (option === animal) {
        btn.classList.add("correct");
        $("exploreFeedback").textContent = `أحسنت! هذا هو ${animal.ar}. 🌟`;
        speak(`أحسنت! هذا هو ${animal.ar}.`, "ar-SA");
      } else {
        btn.classList.add("try-again");
        $("exploreFeedback").textContent = `هذه محاولة جميلة. الحيوان الذي نبحث عنه هو ${animal.ar}.`;
        grid.querySelectorAll("button").forEach(b => {
          if (b.textContent.includes(animal.ar)) b.classList.add("correct");
        });
      }
    });
    grid.appendChild(btn);
  });
}

document.querySelectorAll("[data-scene]").forEach(button => {
  button.addEventListener("click", () => {
    sceneKey = button.dataset.scene;
    animalIndex = 0;
    document.querySelectorAll("[data-scene]").forEach(b => b.classList.toggle("selected", b === button));
    renderExplore();
    if (ambientOn) playEnvironment(sceneKey);
  });
});

$("sceneSoundButton").addEventListener("click", () => {
  if (ambientOn) stopAmbient(); else playEnvironment(sceneKey);
});
$("soundToggle").addEventListener("click", () => {
  if (ambientOn) stopAmbient(); else playEnvironment(sceneKey);
});
$("sayAnimal").addEventListener("click", () => {
  const a = environments[sceneKey].animals[animalIndex];
  speak(`${a.ar}. باللغة الإنجليزية ${a.en}.`, "ar-SA");
});
$("animalCall").addEventListener("click", () => animalSound(environments[sceneKey].animals[animalIndex]));
$("readMission").addEventListener("click", () => {
  speak(`مرحبًا بك في ${environments[sceneKey].title}. ${$("missionText").textContent}`, "ar-SA");
});
$("nextAnimal").addEventListener("click", () => {
  animalIndex = (animalIndex + 1) % environments[sceneKey].animals.length;
  renderExplore();
  speak("اكتشاف جديد. تعرف على هذا الحيوان.", "ar-SA");
});

function switchView(view) {
  document.querySelectorAll(".step").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("exploreView").classList.toggle("active", view === "explore");
  $("createView").classList.toggle("active", view === "create");
  $("progressFill").style.width = view === "explore" ? "50%" : "100%";
  if (view === "create") stopAmbient();
}
document.querySelectorAll(".step").forEach(b => b.addEventListener("click", () => switchView(b.dataset.view)));

function drawAnimalGuide(key) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#fffefa";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.strokeStyle = "#b9c5d8";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([12,10]);
  ctx.beginPath();
  if (key === "fish") {
    ctx.ellipse(340,235,160,100,0,0,Math.PI*2);
    ctx.moveTo(490,235);ctx.lineTo(625,145);ctx.lineTo(625,325);ctx.closePath();
    ctx.moveTo(285,155);ctx.quadraticCurveTo(350,235,285,315);
  } else if (key === "lion") {
    ctx.arc(360,235,155,0,Math.PI*2);
    for(let i=0;i<12;i++){let a=i*Math.PI/6;ctx.moveTo(360+155*Math.cos(a),235+155*Math.sin(a));ctx.lineTo(360+185*Math.cos(a),235+185*Math.sin(a));}
    ctx.arc(360,235,95,0,Math.PI*2);
  } else if (key === "butterfly") {
    ctx.ellipse(250,185,110,95,-.4,0,Math.PI*2);
    ctx.ellipse(465,185,110,95,.4,0,Math.PI*2);
    ctx.ellipse(270,325,85,65,.4,0,Math.PI*2);
    ctx.ellipse(445,325,85,65,-.4,0,Math.PI*2);
    ctx.moveTo(360,95);ctx.lineTo(360,390);
    ctx.moveTo(360,110);ctx.quadraticCurveTo(300,35,270,70);
    ctx.moveTo(360,110);ctx.quadraticCurveTo(420,35,450,70);
  } else if (key === "turtle") {
    ctx.ellipse(345,240,170,110,0,0,Math.PI*2);
    ctx.arc(540,235,50,0,Math.PI*2);
    [[230,145],[230,330],[440,145],[440,330]].forEach(([x,y])=>{ctx.moveTo(x+32,y);ctx.arc(x,y,32,0,Math.PI*2)});
    ctx.moveTo(345,130);ctx.lineTo(345,350);ctx.moveTo(200,240);ctx.lineTo(490,240);
  } else if (key === "elephant") {
    ctx.arc(335,215,135,0,Math.PI*2);
    ctx.ellipse(190,230,70,105,0,0,Math.PI*2);
    ctx.moveTo(435,220);ctx.quadraticCurveTo(560,240,515,370);ctx.quadraticCurveTo(485,400,470,355);
  } else {
    ctx.arc(350,235,135,0,Math.PI*2);
    ctx.moveTo(260,140);ctx.lineTo(225,55);ctx.lineTo(320,120);
    ctx.moveTo(440,140);ctx.lineTo(475,55);ctx.lineTo(380,120);
    ctx.arc(305,220,15,0,Math.PI*2);ctx.arc(395,220,15,0,Math.PI*2);
    ctx.moveTo(315,290);ctx.quadraticCurveTo(350,320,385,290);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle="#a1adbf";
  ctx.font="19px Cairo";
  ctx.textAlign="center";
  ctx.fillText("زيّن الرسم بالألوان التي تحبها",380,455);
  ctx.restore();
  undoStack = [];
}
function selectArtAnimal(key) {
  currentAnimal = key;
  const item = artAnimals[key];
  $("studioEmoji").textContent = item.emoji;
  $("traceWord").textContent = item.en;
  document.querySelectorAll(".animal-chip").forEach(b=>b.classList.toggle("selected",b.dataset.animal===key));
  drawAnimalGuide(item.shape);
  $("artFeedback").textContent = "";
}
document.querySelectorAll("[data-animal]").forEach(b=>b.addEventListener("click",()=>selectArtAnimal(b.dataset.animal)));
$("sayEnglish").addEventListener("click",()=>speak(artAnimals[currentAnimal].en,"en-US"));

function saveUndo() {
  try { undoStack.push(ctx.getImageData(0,0,canvas.width,canvas.height)); if(undoStack.length>15)undoStack.shift(); } catch(e){}
}
function canvasPoint(event) {
  const rect=canvas.getBoundingClientRect();
  return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};
}
function paint(event) {
  const p=canvasPoint(event);
  ctx.save();
  ctx.fillStyle=erasing?"#fffefa":selectedColor;
  ctx.globalAlpha=erasing?1:.88;
  ctx.beginPath();
  ctx.arc(p.x,p.y,erasing?25:19,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}
canvas.addEventListener("pointerdown",e=>{drawing=true;canvas.setPointerCapture(e.pointerId);saveUndo();paint(e)});
canvas.addEventListener("pointermove",e=>{if(drawing)paint(e)});
["pointerup","pointercancel","lostpointercapture"].forEach(name=>canvas.addEventListener(name,()=>drawing=false));
document.querySelectorAll("[data-color]").forEach(b=>b.addEventListener("click",()=>{
  selectedColor=b.dataset.color;erasing=false;
  document.querySelectorAll(".color-dot").forEach(x=>x.classList.toggle("active",x===b));
}));
$("eraser").addEventListener("click",()=>{erasing=true;document.querySelectorAll(".color-dot").forEach(x=>x.classList.remove("active"))});
$("undo").addEventListener("click",()=>{const previous=undoStack.pop();if(previous)ctx.putImageData(previous,0,0)});
$("clearCanvas").addEventListener("click",()=>drawAnimalGuide(artAnimals[currentAnimal].shape));
$("finishArt").addEventListener("click",()=>{$("artFeedback").textContent="رائع! لقد أبدعت في تزيين "+artAnimals[currentAnimal].en+" ✨";speak("عمل رائع! لقد أنهيت لوحتك.","ar-SA")});

renderExplore();
selectArtAnimal("dolphin");
