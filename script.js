const prayerTimesContainer = document.getElementById("prayerTimes");
const dateEl = document.getElementById("date");
const locationEl = document.getElementById("location");
const countdownEl = document.getElementById("countdown");
const nextPrayerNameEl = document.getElementById("nextPrayerName");
const countdownSection = document.getElementById("countdownSection");

// Panel
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");
const darkModeToggle = document.getElementById("darkModeToggle");
const testAdhanBtn = document.getElementById("testAdhanBtn");

// Overlay
const overlay = document.getElementById("prayerOverlay");
const prayerText = document.getElementById("prayerText");

let prayerTimes = {};
let countdownInterval = null;
let notifiedPrayers = new Set();

const icons = {
  Fajr: "🌅",
  Dhuhr: "☀️",
  Asr: "🌇",
  Maghrib: "🌆",
  Isha: "🌙",
};

const backgrounds = {
  Fajr: "images/fajr.jpg",
  Dhuhr: "images/dhuhr.jpg",
  Asr: "images/asr.jpg",
  Maghrib: "images/maghrib.jpg",
  Isha: "images/isha.jpg",
};

// 🔊 Audios
const adhanFajr = new Audio("sounds/adhan_fajr.mp3");
const adhanNormal = new Audio("sounds/adhan1.mp3");
const duaAudio = new Audio("sounds/duaa.mp3");

// Test Adhan
let isPlaying = false;
testAdhanBtn.addEventListener("click", () => {
  if (!isPlaying) {
    adhanNormal.currentTime = 0;
    adhanNormal.play();
    isPlaying = true;
    testAdhanBtn.textContent = "⏹️";
  } else {
    adhanNormal.pause();
    adhanNormal.currentTime = 0;
    isPlaying = false;
    testAdhanBtn.textContent = "🔊";
  }
});

// 📅 Datum
function showDate() {
  const today = new Date();
  dateEl.textContent = today.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ⏰ Uhrzeit
function showCurrentTime() {
  let timeEl = document.getElementById("currentTime");
  if (!timeEl) {
    timeEl = document.createElement("p");
    timeEl.id = "currentTime";
    document.querySelector("header").appendChild(timeEl);
  }

  function updateTime() {
    const now = new Date();
    timeEl.textContent = "🕒 " + now.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// 📍 Standort
function getLocationAndFetchPrayers() {
  if (!navigator.geolocation) {
    locationEl.textContent = "📍 Standort nicht verfügbar";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const city =
          data.address.city ||
          data.address.town ||
          data.address.village ||
          "Unbekannt";
        locationEl.textContent = `📍 ${city}`;
      } catch {
        locationEl.textContent = "📍 Standort erkannt";
      }

      fetchPrayerTimes(latitude, longitude);
    },
    () => {
      locationEl.textContent = "📍 Standortzugriff verweigert";
    }
  );
}

async function fetchPrayerTimes(lat, lon) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const url = `https://api.aladhan.com/v1/calendar?latitude=${lat}&longitude=${lon}&method=2&month=${month}&year=${year}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 200) return;

    const timings = data.data[day - 1].timings;

    prayerTimes = {
      Fajr: parseTime(timings.Fajr),
      Dhuhr: parseTime(timings.Dhuhr),
      Asr: parseTime(timings.Asr),
      Maghrib: parseTime(timings.Maghrib),
      Isha: parseTime(timings.Isha),
    };

    renderPrayerTimes();
    startCountdown();
  } catch (err) {
    console.error("Fehler beim Abrufen der Gebetszeiten:", err);
  }
}

function parseTime(timeStr) {
  const clean = timeStr.split(" ")[0];
  const [h, m] = clean.split(":").map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
}

function renderPrayerTimes() {
  prayerTimesContainer.innerHTML = "";
  for (const [name, time] of Object.entries(prayerTimes)) {
    const timeStr = time.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const icon = icons[name] || "";
    const div = document.createElement("div");
    div.className = "prayer";
    div.innerHTML = `<span class="icon">${icon}</span><h3>${name}</h3><p>${timeStr}</p>`;
    prayerTimesContainer.appendChild(div);
  }
}

// Hintergrundwechsel
function setTemporaryBackground(prayerName) {
  document.body.style.backgroundImage = `url(${backgrounds[prayerName]})`;

  setTimeout(() => {
    applySavedTheme(); // zurück
  }, 10 * 60 * 1000);
}

// Notification
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}
requestNotificationPermission();

function playPrayerSequence(prayerName) {
  setTemporaryBackground(prayerName);

  let adhan = prayerName === "Fajr" ? adhanFajr : adhanNormal;
  adhan.currentTime = 0;
  adhan.play().catch((e) => console.warn("Adhan Fehler:", e));

  adhan.onended = () => {
    duaAudio.currentTime = 0;
    duaAudio.play().catch((e) => console.warn("Duaa Fehler:", e));
    showPrayerOverlay(prayerName);
  };
}

function showPrayerNotification(prayerName) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(`Gebet beginnt jetzt: ${prayerName}`);
  }
}

function checkPrayerNotifications(prayerTimes) {
  const now = new Date();
  for (const [prayerName, time] of Object.entries(prayerTimes)) {
    const diffMs = time - now;
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds <= 0 && diffSeconds > -5) {
      if (!notifiedPrayers.has(prayerName)) {
        showPrayerNotification(prayerName);
        playPrayerSequence(prayerName);
        notifiedPrayers.add(prayerName);
      }
    }
  }
}

// Countdown
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  function updateCountdown() {
    const now = new Date();

    const future = Object.entries(prayerTimes)
      .filter(([_, t]) => t > now)
      .sort((a, b) => a[1] - b[1]);

    let next;
    if (future.length > 0) {
      next = future[0];
    } else {
      const tomorrowFajr = new Date(
        prayerTimes.Fajr.getTime() + 24 * 3600 * 1000
      );
      next = ["Fajr", tomorrowFajr];
    }

    const [name, time] = next;
    nextPrayerNameEl.textContent = name;

    const diffSeconds = Math.floor((time - now) / 1000);
    const h = Math.floor(diffSeconds / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;

    countdownEl.textContent = `${h}h ${m}m ${s}s`;
    countdownSection.style.display = "block";

    checkPrayerNotifications(prayerTimes);
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

// ⚙️ Panel
settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.add("active");
});

closeSettings.addEventListener("click", () => {
  settingsPanel.classList.remove("active");
});

// 🌙 Dark Mode
darkModeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

function applySavedTheme() {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    document
    document.body.classList.remove("light");
  } else {
    document.body.classList.add("light");
    document.body.classList.remove("dark");
  }
}

// 🕌 Overlay für Duaa
function showPrayerOverlay(prayerName) {
  prayerText.textContent = `Jetzt ist ${prayerName} Gebet 🕌\nBitte bete!`;
  overlay.style.display = "flex";

  setTimeout(() => {
    overlay.style.display = "none";
  }, 2 * 60 * 1000); // nach 2 Minuten schließen
}

// Initialisierung
document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  showDate();
  showCurrentTime();
  getLocationAndFetchPrayers();
});
