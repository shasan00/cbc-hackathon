// ===== State =====
const state = {
  calories: 0, protein: 0, carbs: 0, fats: 0,
  calorieGoal: 2000, proteinGoal: 120, carbsGoal: 250, fatsGoal: 65,
  xp: 0, level: 1, xpNeeded: 500,
  streak: 4,
  meals: [],
  activeChar: { emoji: '🐼', name: 'Panda Pete' }
};

// ===== DOM Refs =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Date =====
$('#dashDate').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric'
});

// ===== Streak =====
$('#streakCount').textContent = state.streak;

// ===== Quiz =====
const quizModal = $('#quizModal');
const quizSteps = $$('.quiz-step');
let currentStep = 1;

$('#heroStartBtn').addEventListener('click', () => {
  quizModal.classList.add('open');
});

// Single-select quiz options (steps 1 & 2)
$$('.quiz-step[data-step="1"] .quiz-option, .quiz-step[data-step="2"] .quiz-option').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    setTimeout(() => advanceQuiz(), 350);
  });
});

// Multi-select toggle (step 3)
$$('.quiz-options.multi .quiz-option').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('selected'));
});

function advanceQuiz() {
  currentStep++;
  quizSteps.forEach(s => s.classList.remove('active'));
  const next = $(`.quiz-step[data-step="${currentStep}"]`);
  if (next) {
    next.classList.add('active');
    $('#quizProgressBar').style.width = `${(currentStep / 3) * 100}%`;
  }
}

$('#quizFinish').addEventListener('click', () => {
  advanceQuiz();
  // Animate loading bar
  const bar = $('#loadingBar');
  let w = 0;
  const interval = setInterval(() => {
    w += Math.random() * 15 + 5;
    if (w >= 100) { w = 100; clearInterval(interval); }
    bar.style.width = w + '%';
    if (w >= 100) {
      setTimeout(() => {
        quizModal.classList.remove('open');
        showToast('🎉 Your plan is ready! Start logging meals.');
      }, 600);
    }
  }, 200);
});

// ===== Meal Logging =====
const mealIcons = { breakfast: '🥣', lunch: '🥗', dinner: '🍲', snack: '🍎', smoothie: '🥤', treat: '🍩' };

$$('.log-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const meal = btn.dataset.meal;
    const cal = parseInt(btn.dataset.cal);
    const p = parseInt(btn.dataset.p);
    const c = parseInt(btn.dataset.c);
    const f = parseInt(btn.dataset.f);

    state.calories += cal;
    state.protein += p;
    state.carbs += c;
    state.fats += f;

    state.meals.push({ meal, cal, p, c, f, time: new Date() });

    btn.classList.add('logged');
    addXP(50);
    updateDashboard();
    addMealEntry(meal, cal, p, c, f);
    showToast(`${mealIcons[meal]} +${cal} kcal logged! +50 XP`);

    // Character happy animation
    $('#characterEmoji').classList.add('happy');
    setTimeout(() => $('#characterEmoji').classList.remove('happy'), 600);
  });
});

function addMealEntry(meal, cal, p, c, f) {
  const feed = $('#mealFeed');
  const empty = feed.querySelector('.empty-feed');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'meal-entry';
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  entry.innerHTML = `
    <span class="meal-entry-icon">${mealIcons[meal]}</span>
    <div class="meal-entry-info">
      <div class="meal-entry-name">${meal} <span style="color:var(--text-muted);font-weight:400;font-size:0.7rem">${time}</span></div>
      <div class="meal-entry-macros">P: ${p}g · C: ${c}g · F: ${f}g</div>
    </div>
    <span class="meal-entry-cal">+${cal}</span>
  `;
  feed.prepend(entry);
}

// ===== Update Dashboard =====
function updateDashboard() {
  const pPct = Math.min((state.protein / state.proteinGoal) * 100, 100);
  const cPct = Math.min((state.carbs / state.carbsGoal) * 100, 100);
  const fPct = Math.min((state.fats / state.fatsGoal) * 100, 100);
  const calPct = Math.min(state.calories / state.calorieGoal, 1);

  $('#proteinBar').style.width = pPct + '%';
  $('#carbsBar').style.width = cPct + '%';
  $('#fatsBar').style.width = fPct + '%';

  $('#proteinVal').textContent = `${state.protein}/${state.proteinGoal}g`;
  $('#carbsVal').textContent = `${state.carbs}/${state.carbsGoal}g`;
  $('#fatsVal').textContent = `${state.fats}/${state.fatsGoal}g`;

  // Calorie ring
  const circumference = 326.7;
  $('#calorieRing').style.strokeDashoffset = circumference - (calPct * circumference);
  $('#calorieNum').textContent = state.calories;

  // Character fill
  const fillPct = Math.min((state.calories / state.calorieGoal) * 100, 100);
  $('#characterFill').style.height = fillPct + '%';
  $('#progressPercent').textContent = Math.round(fillPct);

  if (fillPct > 50) {
    $('#characterContainer').classList.add('fed');
  }
}

// ===== XP System =====
function addXP(amount) {
  state.xp += amount;
  if (state.xp >= state.xpNeeded) {
    state.level++;
    state.xp -= state.xpNeeded;
    state.xpNeeded = Math.round(state.xpNeeded * 1.4);
    showToast(`🎉 Level Up! You're now Level ${state.level}!`);
    $('#characterLevel').textContent = state.level;
  }
  updateXPBar();
}

function updateXPBar() {
  const pct = (state.xp / state.xpNeeded) * 100;
  $('#xpBar').style.width = pct + '%';
  $('#xpLevel').textContent = state.level;
  $('#xpCurrent').textContent = state.xp;
  $('#xpNeeded').textContent = state.xpNeeded;
}

// ===== Character Collection =====
$$('.collection-item.unlocked').forEach(item => {
  item.addEventListener('click', () => {
    $$('.collection-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const emoji = item.dataset.emoji;
    const name = item.dataset.name;
    state.activeChar = { emoji, name };
    $('#characterEmoji').textContent = emoji;
    $('#characterName').textContent = name;
    showToast(`${emoji} Switched to ${name}!`);
  });
});

// ===== Chat =====
const chatResponses = [
  "Great question! A balanced plate should be roughly ½ veggies, ¼ protein, and ¼ complex carbs. 🥦🍗🍠",
  "For a pre-workout snack, try a banana with almond butter about 30 min before. Quick energy! 🍌",
  "Greek yogurt with berries is one of the best high-protein snacks — around 15g protein per serving. 💪",
  "Aim for 25-30g of fiber daily. Oats, lentils, and broccoli are your best friends here. 🌾",
  "Hydration tip: drink a glass of water before each meal. It helps with digestion and portion control! 💧",
  "Nuts are calorie-dense but super nutritious. A small handful (about 1oz) is the perfect portion. 🥜",
  "Try to eat the rainbow — different colored fruits and veggies provide different nutrients. 🌈",
];

$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (!text) return;
  addChatMessage(text, true);
  $('#chatInput').value = '';
  addXP(10);
  setTimeout(() => {
    const reply = chatResponses[Math.floor(Math.random() * chatResponses.length)];
    addChatMessage(reply, false);
  }, 500);
});

function addChatMessage(text, isUser) {
  const msg = document.createElement('div');
  msg.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
  msg.innerHTML = `
    <span class="message-avatar">${isUser ? '👤' : '🥑'}</span>
    <div class="message-bubble">${text}</div>
  `;
  $('#chatMessages').appendChild(msg);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

// ===== Tips Carousel =====
const tips = $$('.tip-card');
const dotsContainer = $('#tipDots');
let activeTip = 0;

tips.forEach((_, i) => {
  const dot = document.createElement('div');
  dot.className = `tip-dot${i === 0 ? ' active' : ''}`;
  dot.addEventListener('click', () => showTip(i));
  dotsContainer.appendChild(dot);
});

function showTip(index) {
  tips.forEach(t => t.classList.remove('active'));
  $$('.tip-dot').forEach(d => d.classList.remove('active'));
  tips[index].classList.add('active');
  $$('.tip-dot')[index].classList.add('active');
  activeTip = index;
}

setInterval(() => {
  showTip((activeTip + 1) % tips.length);
}, 5000);

// ===== Toast =====
function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Mobile Menu =====
$('.mobile-menu-btn').addEventListener('click', () => {
  const nav = $('.nav-links');
  const isOpen = nav.style.display === 'flex';
  nav.style.display = isOpen ? 'none' : 'flex';
  nav.style.flexDirection = 'column';
  nav.style.position = 'absolute';
  nav.style.top = '60px';
  nav.style.left = '0';
  nav.style.right = '0';
  nav.style.background = 'rgba(12,15,26,0.95)';
  nav.style.padding = '1rem';
  nav.style.gap = '1rem';
});

// ===== Init =====
updateDashboard();
updateXPBar();
