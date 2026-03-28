// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

export const SYSTEM_DEFAULTS = {
  version: "v1.2.1",
  defaultCurrency: "₹",
  guestName: "Guest",
  guestEmail: "Not signed in",
  mockUser: { name: "Guru", email: "guru@example.com" }
};

export const DEFAULT_CONFIG_VERSION = "2026-03-28";

export const DEFAULT_CONFIG = {
  _defaults: {
    activitiesVersion: DEFAULT_CONFIG_VERSION,
    activitiesPristine: true,
    quickActionsVersion: DEFAULT_CONFIG_VERSION,
    quickActionsPristine: true,
    activityOptionsVersion: DEFAULT_CONFIG_VERSION,
    activityOptionsPristine: true,
    categoriesVersion: DEFAULT_CONFIG_VERSION,
    categoriesPristine: true,
    categoryColorsVersion: DEFAULT_CONFIG_VERSION,
    categoryColorsPristine: true,
    optionsItemsVersion: DEFAULT_CONFIG_VERSION,
    optionsItemsPristine: true,
    optionsNestedVersion: DEFAULT_CONFIG_VERSION,
    optionsNestedPristine: true,
    panicTriggersVersion: DEFAULT_CONFIG_VERSION,
    panicTriggersPristine: true,
    taskDefaultsByWeekdayVersion: DEFAULT_CONFIG_VERSION,
    taskDefaultsByWeekdayPristine: true,
    themeVersion: DEFAULT_CONFIG_VERSION,
    themePristine: true,
    uiVersion: DEFAULT_CONFIG_VERSION,
    uiPristine: true
  },
  ui: {
    topBadge: "Phase 0 · Week 1",
    topEmoji: "🔥",
    nav: {
      log: { label: "Log", icon: "📓" },
      money: { label: "Money", icon: "💰" },
      tasks: { label: "Tasks", icon: "✅" },
      settings: { label: "Set", icon: "⚙️" }
    },
    sections: {
      intention: "Today's One Thing",
      battery: "Mental Battery",
      activity: "Log Activity",
      quick: "Quick Actions",
      panicTrigger: "What triggered the loop?",
      timeline: "Timeline",
      moneyHero: "Spent Today",
      moneyAdd: "Add Expense",
      moneyDist: "Distribution",
      moneyHist: "History",
      tasksAdd: "Add task",
      tasksList: "Today",
      settingsCloud: "Account & Cloud",
      settingsVault: "Vault Security (Auto-E2EE)",
      settingsAdv: "Advanced (Backup & UI)",
      settingsInfo: "App Info",
      optionsModalStartTitle: "Details before starting:",
      optionsModalEndTitle: "What were you doing?",
      optionsModalInstantTitle: "Choose option:"
    },
    buttons: { panic: "🚨 Caught in a Fatal Loop?", custom: "+ Custom" }
  },
  theme: {
    bg: "#0D0D0B", bg2: "#141412", bg3: "#1A1A17", card: "#171715", card2: "#1E1E1B", text: "#E6E4DD",
    amber: "#E8A830", teal: "#2DC98A", red: "#E86060", radius: "12px", dailyBudget: 500, currencySymbol: SYSTEM_DEFAULTS.defaultCurrency
  },
  
  activities: [
    { id:'wake', emoji:'☀️', label:'Woke Up', type:'instant', color:'var(--teal)', actionText:'☀️ Start Day' },
    { id:'bath', emoji:'🚿', label:'Bath', type:'duration' },
    { id:'breakfast',emoji:'🍳', label:'Breakfast', type:'duration' },
    { id:'commute', emoji:'🚗', label:'Commute', type:'duration', optionsType:'start', optionsKey:'commute' },
    { id:'walk', emoji:'🚶', label:'Walking', type:'duration' },
    { id:'office', emoji:'🏢', label:'Office Work', type:'duration' },
    { id:'lunch', emoji:'🍛', label:'Lunch', type:'duration' },
    { id:'home', emoji:'🏠', label:'Reached Home', type:'instant' },
    { id:'workout', emoji:'💪', label:'Workout', type:'duration', optionsType:'end', optionsKey:'workout' },
    { id:'stretch', emoji:'🧘', label:'Stretch', type:'duration', optionsType:'start', optionsKey:'stretch' },
    { id:'play', emoji:'🎲', label:'Playing', type:'duration', optionsType:'start', optionsKey:'play' },
    { id:'dinner', emoji:'🥘', label:'Dinner', type:'duration' },
    { id:'build', emoji:'🔨', label:'Build Window', type:'duration' },
    { id:'learning',emoji:'📚', label:'Learning', type:'duration' },
    { id:'read', emoji:'📖', label:'Reading', type:'duration' },
    { id:'phone', emoji:'📱', label:'Phone', type:'duration', color:'var(--red)', optionsType:'end', optionsKey:'phone' },
    { id:'sleep', emoji:'🌙', label:'Sleep', type:'instant', color:'var(--blue)', actionText:'🌙 Wrap Up' }
  ],
  
  activityOptions: {
    'commute': ['🚇 Metro', '🚌 Bus', '🚕 Cab', '🚶 Walk'],
    'workout': ['🏃 Cardio', '🏋️ Weights', '🧘 Yoga', '🏊 Swim'],
    '🏃 Cardio': ['Treadmill', 'Cycling', 'Running outside'],
    '🏋️ Weights': ['Upper Body', 'Lower Body', 'Core'],
    'phone': ['📞 Call', '📸 Insta', '🦸 Comics', '🎵 Spotify', '▶️ YouTube', '💬 WhatsApp', '🌐 Browse', '🎮 Games'],
    '📸 Insta': ['Feed', 'Reels', 'DMs', 'Explore'],
    '▶️ YouTube': ['Shorts', 'Long Form', 'Educational'],
    'snack': ['🍫 Chocolate', '🍟 Junk', '🍎 Fruit'],
    'play': ['♟️ Chess', '🪀 Carrom'],
    'stretch': ['🧘 Mobility', '🦵 Legs', '🧍 Full Body']
  },

  categories: ['🍛 Food', '🚌 Transport', '☕ Chai', '🛒 Shopping', '💊 Health', '🎮 Fun', '📦 Other'],
  categoryColors: { '🍛 Food': 'var(--amber)', '🚌 Transport': 'var(--blue)', '☕ Chai': 'var(--teal)', '🛒 Shopping': 'var(--pink)', '💊 Health': '#2DC98A', '🎮 Fun': '#E87AAA', '📦 Other': 'var(--text3)' },
  
  quickActions: [
    { id: 'qa_water', emoji: '💧', label: 'Water', type: 'instant' },
    { id: 'qa_coffee', emoji: '☕', label: 'Coffee', type: 'instant' },
    { id: 'qa_meds', emoji: '💊', label: 'Meds', type: 'instant' },
    { id: 'qa_snack', emoji: '🍩', label: 'Snack', type: 'instant', optionsType: 'instant', optionsKey: 'snack' },
    { id: 'qa_sun', emoji: '☀️', label: 'Sunshine', type: 'duration' }
  ],

  optionsItems: [
    { id: 'opt_commute', key: 'commute', emoji: '🚗', label: 'Commute', values: ['🚇 Metro', '🚌 Bus', '🚕 Cab', '🚶 Walk'] },
    { id: 'opt_workout', key: 'workout', emoji: '💪', label: 'Workout', values: ['🏃 Cardio', '🏋️ Weights', '🧘 Yoga', '🏊 Swim'] },
    { id: 'opt_phone', key: 'phone', emoji: '📱', label: 'Phone', values: ['📞 Call', '📸 Insta', '🦸 Comics', '🎵 Spotify', '▶️ YouTube', '💬 WhatsApp', '🌐 Browse', '🎮 Games'] },
    { id: 'opt_snack', key: 'snack', emoji: '🍩', label: 'Snack', values: ['🍫 Chocolate', '🍟 Junk', '🍎 Fruit'] },
    { id: 'opt_play', key: 'play', emoji: '🎲', label: 'Playing', values: ['♟️ Chess', '🪀 Carrom'] },
    { id: 'opt_stretch', key: 'stretch', emoji: '🧘', label: 'Stretch', values: ['🧘 Mobility', '🦵 Legs', '🧍 Full Body'] }
  ],

  optionsNested: {
    'commute': {},
    'workout': { '🏃 Cardio': ['Treadmill', 'Cycling', 'Running outside'], '🏋️ Weights': ['Upper Body', 'Lower Body', 'Core'] },
    'phone': { '📸 Insta': ['Feed', 'Reels', 'DMs', 'Explore'], '▶️ YouTube': ['Shorts', 'Long Form', 'Educational'] },
    'snack': {},
    'play': {},
    'stretch': {}
  },

  taskDefaultsByWeekday: {
    '0': ['🧹 Weekly reset'],
    '1': ['🗂️ Plan the week'],
    '2': ['💧 Hydrate check'],
    '3': ['📚 Learn 30 mins'],
    '4': ['🏃 Move body'],
    '5': ['🧾 Review spend'],
    '6': ['🧠 Weekly reflection']
  },

  scheduledTasks: [],
  
  panicTriggers: ['😵 Procrastination', '😰 Stress', '🥱 Boredom', '😴 Tiredness', '🙈 Avoidance', '🫨 Anxiety']
};