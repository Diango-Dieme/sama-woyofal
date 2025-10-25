// Grille tarifaire
const TARIFF_GRID = {
  "domestique-pp": { t1: 91.17, t2: 136.49 },
  "domestique-mp": { t1: 111.23, t2: 143.54 },
  "pro-pp": { t1: 163.81, t2: 189.84 },
  "pro-mp": { t1: 165.01, t2: 191.01 }
};

// Data storage
let meterReadings = [];
let recharges = [];
let settings = {
  tariffType: "domestique-pp", // Valeur par défaut
  tva: 18,
  currentCredit: 0, // Ajout pour le suivi de crédit
  theme: 'system', // Ajout pour le thème
  goalType: 'fcfa', // AJOUT ('fcfa' ou 'kwh')
  goalValue: 0      // AJOUT (valeur numérique)
};

// Chart instance
let consumptionChartInstance = null;
let historyChartInstance = null; // Ajout pour le 2e graphique

// Daily tips
const tips = [
  "Débranchez vos appareils en veille pour économiser jusqu'à 10% sur votre facture !",
  "Utilisez des ampoules LED : elles consomment 80% moins d'énergie.",
  "Réglez votre climatiseur à 25°C pour optimiser la consommation.",
  "Éteignez les lumières quand vous quittez une pièce.",
  "Utilisez le lave-linge avec de l'eau froide quand c'est possible.",
  "Dégivrez régulièrement votre réfrigérateur pour améliorer son efficacité."
];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  initializeDates();
  initializeConsumptionChart();
  initializeHistoryChart(); // Ajout
  updateDashboard();
  showRandomTip();
  loadFromLocalStorage();
});

function initializeDates() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("meterDate").value = today;
  document.getElementById("rechargeDate").value = today;

  // Update current month display
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const now = new Date();
  document.getElementById("currentMonth").textContent =
    monthNames[now.getMonth()] + " " + now.getFullYear();
}

function showPage(pageId, event) {
  event.preventDefault(); // Empêche le lien de sauter en haut de page
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  // Remove active class from all nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // Show selected page
  document.getElementById(pageId).classList.add('active');

  // Add active class to selected nav link if event exists
  if (event) {
    // Gère le clic sur l'icône ou le texte
    const targetLink = event.target.closest('.nav-link');
    if (targetLink) {
      targetLink.classList.add('active');
    }
  }

  // Update page-specific content
  if (pageId === 'dashboard') {
    updateDashboard();
  } else if (pageId === 'history') {
    updateHistoryTable();
    updateRechargeHistoryTable();
    updateAnalysis(); // Mettre à jour l'analyse en affichant la page
  }
}

/**
 * Applique le thème (clair/sombre/système) en changeant la classe sur la balise <html>
 */
function applyTheme(theme) {
  const html = document.documentElement; // Cible la balise <html>

  // 1. Enlève d'abord les classes de forçage
  html.classList.remove('theme-light', 'theme-dark');

  // 2. Ajoute la classe de forçage si nécessaire
  if (theme === 'light') {
    html.classList.add('theme-light');
  } else if (theme === 'dark') {
    html.classList.add('theme-dark');
  }
  // Si theme === 'system', on ne fait rien, le CSS @media s'en occupe.

  // 3. Met à jour l'état "actif" des boutons
  document.getElementById('theme-btn-light').classList.toggle('active', theme === 'light');
  document.getElementById('theme-btn-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('theme-btn-system').classList.toggle('active', theme === 'system');
}

/**
 * Fonction appelée par les boutons pour définir et sauvegarder le thème
 */
function setTheme(theme) {
  settings.theme = theme;
  saveToLocalStorage();
  applyTheme(theme);
}

// --- Calcul de Coût (Modifié) ---
function calculateCost(kwh) {
  // Récupérer les bons tarifs en fonction du type sélectionné
  const tariffs = TARIFF_GRID[settings.tariffType] || TARIFF_GRID["domestique-pp"];
  const tariff1 = tariffs.t1;
  const tariff2 = tariffs.t2;
  const tva = settings.tva / 100;

  let cost = 0;

  // Hypothèse de palier : 150 kWh pour domestique, 250 kWh pour pro
  const palier = (settings.tariffType.startsWith("domestique")) ? 150 : 250;

  if (kwh <= palier) {
    cost = kwh * tariff1;
  } else {
    cost = (palier * tariff1) + ((kwh - palier) * tariff2);
  }

  return cost * (1 + tva);
}

// --- Nouvelle Fonction ---
function recalculateAllCosts() {
  meterReadings.forEach(reading => {
    reading.cost = calculateCost(reading.consumption);
  });
}

// Fonction Helper pour ajouter des jours à une date
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.floor(days)); // Utilise Math.floor pour jours entiers
  return result;
}


function addMeterReading() {
  const date = document.getElementById('meterDate').value;
  const reading = parseFloat(document.getElementById('meterReading').value);

  if (!date || !reading || reading <= 0) {
    showError('Veuillez remplir tous les champs avec des valeurs valides.');
    return;
  }

  // Calculate consumption if we have a previous reading
  let consumption = 0;
  if (meterReadings.length > 0) {
    // Trouver le dernier relevé par date
    const lastReading = [...meterReadings].sort((a, b) => new Date(a.date) - new Date(b.date)).pop();

    if (reading < lastReading.reading) {
      showError('La nouvelle valeur doit être supérieure à la dernière enregistrée.');
      return;
    }
    consumption = reading - lastReading.reading;

    // --- AJOUT : Soustraire la consommation du crédit ---
    if (consumption > 0) {
      settings.currentCredit -= consumption;
      if (settings.currentCredit < 0) {
        settings.currentCredit = 0;
      }
    }

  } else {
    // Premier relevé, pas de consommation à calculer
    consumption = 0;
  }

  const newReading = {
    date: date,
    reading: reading,
    consumption: consumption,
    cost: calculateCost(consumption) // Calculer le coût
  };

  meterReadings.push(newReading);

  // Sort by date
  meterReadings.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Reset form
  document.getElementById('meterReading').value = "";
  document.getElementById('meterDate').value = new Date().toISOString().split('T')[0];

  showMessage('inputMessage');
  updateDashboard(); // Mettre à jour le crédit affiché
  updateHistoryTable();
  saveToLocalStorage(); // Sauvegarde le settings.currentCredit mis à jour
}

function addRecharge() {
  const date = document.getElementById('rechargeDate').value;
  const amount = parseFloat(document.getElementById('rechargeAmount').value);
  const units = parseFloat(document.getElementById('rechargeUnits').value);

  if (!date || !amount || !units || amount <= 0 || units <= 0) {
    showError('Veuillez remplir tous les champs avec des valeurs valides.');
    return;
  }

  // --- AJOUT : Ajouter les unités au crédit ---
  settings.currentCredit += units;

  recharges.push({
    date: date,
    amount: amount,
    units: units,
    rate: amount / units
  });

  // Sort by date
  recharges.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Reset form
  document.getElementById('rechargeAmount').value = "";
  document.getElementById('rechargeUnits').value = "";
  document.getElementById('rechargeDate').value = new Date().toISOString().split('T')[0];

  showMessage('inputMessage');
  updateDashboard(); // Mettre à jour le crédit affiché
  updateRechargeHistoryTable(); // Ajout
  saveToLocalStorage(); // Sauvegarde le settings.currentCredit mis à jour
}

// --- Fonction saveSettings (remplace saveTariffs) ---
function saveSettings() {
  // Sauvegarde des tarifs et TVA
  settings.tariffType = document.getElementById('tariffType').value;
  settings.tva = parseFloat(document.getElementById('tva').value);

  // Sauvegarde du crédit actuel
  const creditInput = parseFloat(document.getElementById('currentCredit').value);
  if (!isNaN(creditInput) && creditInput >= 0) {
    settings.currentCredit = creditInput;
  }

  // AJOUT : Sauvegarde de l'objectif
  settings.goalType = document.getElementById('goalType').value;
  const goalInput = parseFloat(document.getElementById('goalValue').value);
  settings.goalValue = (!isNaN(goalInput) && goalInput > 0) ? goalInput : 0; // Met 0 si invalide ou vide

  showMessage('settingsMessage');

  recalculateAllCosts();
  updateDashboard(); // Mettre à jour le dashboard (coût, crédit, objectif)
  updateHistoryTable();
  saveToLocalStorage();
}

// NOUVELLE FONCTION pour mettre à jour le label de l'objectif
function updateGoalLabel() {
  const goalType = document.getElementById('goalType').value;
  const label = document.getElementById('goalValueLabel');
  const input = document.getElementById('goalValue');
  if (goalType === 'fcfa') {
    label.innerHTML = '<i class="fas fa-calculator"></i> Valeur de l\'objectif (FCFA)';
    input.placeholder = "Ex: 10000";
    input.step = "100"; // Pas de 100 pour FCFA
  } else {
    label.innerHTML = '<i class="fas fa-bolt"></i> Valeur de l\'objectif (kWh)';
    input.placeholder = "Ex: 200";
    input.step = "1"; // Pas de 1 pour kWh
  }
}


function showMessage(messageId) {
  const message = document.getElementById(messageId);
  message.style.display = 'block';
  setTimeout(() => {
    message.style.display = 'none';
  }, 3000);
}

function showError(message) {
  // Tente de trouver un conteneur de message d'erreur existant
  let errorDiv = document.getElementById('alert-error-popup');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'alert-error-popup';
    errorDiv.className = 'alert alert-error';
    // Style pour le mettre au-dessus de tout
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.zIndex = '1000';
    errorDiv.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    document.body.appendChild(errorDiv);
  }

  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  errorDiv.style.display = 'block';

  // Cache le message après 3 secondes
  setTimeout(() => {
    if (errorDiv) errorDiv.style.display = 'none';
  }, 3000);
}


function showRandomTip() {
  const randomIndex = Math.floor(Math.random() * tips.length);
  document.getElementById('dailyTip').textContent = tips[randomIndex];
}

function initializeConsumptionChart() {
  const ctx = document.getElementById('consumptionChart').getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(0, 122, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 122, 255, 0)');

  consumptionChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Consommation (kWh)',
        data: [],
        backgroundColor: gradient,
        borderColor: 'rgba(0, 122, 255, 1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: 'rgba(0, 122, 255, 1)',
        pointBorderWidth: 2,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: {}
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Consommation des 30 derniers relevés',
          font: { size: 16 }
        }
      }
    }
  });
}

// --- Nouvelle Fonction ---
function initializeHistoryChart() {
  const ctx = document.getElementById('historyChart').getContext('2d');
  historyChartInstance = new Chart(ctx, {
    type: 'bar', // Un graphique en barres est bien pour l'analyse
    data: {
      labels: [],
      datasets: [{
        label: 'Consommation (kWh)',
        data: [],
        backgroundColor: 'rgba(122, 92, 255, 0.6)', // Couleur secondaire
        borderColor: 'rgba(122, 92, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Consommation par jour',
          font: { size: 16 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'kWh' }
        },
        x: {
          title: { display: true, text: 'Date' }
        }
      }
    }
  });
}


function updateConsumptionChart() {
  if (!consumptionChartInstance) return;

  // On ne prend que les relevés qui ont une consommation (donc > 1er relevé)
  const consumptionData = meterReadings.filter(r => r.consumption > 0).slice(-30);

  const labels = consumptionData.map(reading => formatDate(reading.date));
  const data = consumptionData.map(reading => reading.consumption);

  consumptionChartInstance.data.labels = labels;
  consumptionChartInstance.data.datasets[0].data = data;

  const dayCount = consumptionData.length;
  consumptionChartInstance.options.plugins.title.text =
    `Consommation des ${dayCount} derniers relevés`;

  consumptionChartInstance.update();
}

function updateDashboard() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Filter readings for current month
  const monthReadings = meterReadings.filter(reading => {
    const readingDate = new Date(reading.date);
    return readingDate.getMonth() === currentMonth &&
           readingDate.getFullYear() === currentYear;
  });

  // On ne compte que les relevés qui ont une consommation
  const validReadings = monthReadings.filter(r => r.consumption > 0);
  const totalConsumption = validReadings.reduce((sum, reading) => sum + reading.consumption, 0);
  const totalCost = validReadings.reduce((sum, reading) => sum + reading.cost, 0);
  const daysCount = validReadings.length;
  const dailyAverage = daysCount > 0 ? (totalConsumption / daysCount) : 0;

  // --- Update dashboard stats ---
  document.getElementById('monthConsumption').textContent = totalConsumption.toFixed(2);
  document.getElementById('monthCost').textContent = Math.round(totalCost);
  document.getElementById('dailyAverage').textContent = dailyAverage.toFixed(2);
  document.getElementById('daysInMonth').textContent = daysCount;

  // --- Mise à jour du crédit et des jours restants ---
  const creditDisplay = document.getElementById('currentCreditDisplay');
  const daysDisplay = document.getElementById('daysRemainingDisplay');
  const daysCard = daysDisplay.closest('.stat-card');
  let daysRemaining = 0; // Variable pour la prévision

  creditDisplay.textContent = settings.currentCredit.toFixed(1);

  if (dailyAverage > 0 && settings.currentCredit > 0) {
    daysRemaining = settings.currentCredit / dailyAverage;
    daysDisplay.textContent = Math.floor(daysRemaining); // Arrondir aux jours pleins

    // Changer couleur jours restants
    if (daysRemaining <= 3) {
      daysCard.style.background = "linear-gradient(135deg, #FF3B30, #E02B20)"; // Rouge
    } else if (daysRemaining <= 7) {
      daysCard.style.background = "linear-gradient(135deg, #FF9500, #D98000)"; // Orange
    } else {
      daysCard.style.background = "linear-gradient(135deg, #667eea, #764ba2)"; // Bleu (défaut)
    }

  } else {
      daysDisplay.textContent = (settings.currentCredit <= 0) ? "0" : "-";
      daysCard.style.background = (settings.currentCredit <= 0) ? "linear-gradient(135deg, #FF3B30, #E02B20)" : "linear-gradient(135deg, #667eea, #764ba2)";
  }

  // --- Mise à jour de l'objectif mensuel ---
  const goalProgressText = document.getElementById('goalProgressText');
  const goalPercentageText = document.getElementById('goalPercentage');
  const goalProgressBar = document.getElementById('goalProgressBar');
  const goalStatusText = document.getElementById('goalStatusText');

  if (settings.goalValue > 0) {
    let currentProgress = (settings.goalType === 'fcfa') ? totalCost : totalConsumption;
    let goalUnit = (settings.goalType === 'fcfa') ? " FCFA" : " kWh";
    const percentage = Math.min(100, Math.round((currentProgress / settings.goalValue) * 100));

    goalProgressText.textContent = `${Math.round(currentProgress)} / ${settings.goalValue}${goalUnit}`;
    goalPercentageText.textContent = `${percentage}%`;
    goalProgressBar.style.width = `${percentage}%`;

    if (percentage >= 100) {
      goalProgressBar.style.backgroundColor = 'var(--color-danger)';
      goalStatusText.textContent = "⚠️ Objectif dépassé !";
      goalStatusText.style.color = 'var(--color-danger)';
    } else if (percentage >= 80) {
      goalProgressBar.style.backgroundColor = 'var(--color-warning)';
      goalStatusText.textContent = "🟠 Attention, vous approchez de l'objectif.";
      goalStatusText.style.color = 'var(--color-warning)';
    } else {
      goalProgressBar.style.backgroundColor = 'var(--color-success)';
      goalStatusText.textContent = "🟢 Vous êtes dans les clous.";
      goalStatusText.style.color = 'var(--color-success)';
    }
  } else {
    goalProgressText.textContent = "Aucun objectif défini";
    goalPercentageText.textContent = "-";
    goalProgressBar.style.width = `0%`;
    goalProgressBar.style.backgroundColor = 'var(--color-success)';
    goalStatusText.textContent = "Définissez un objectif dans les paramètres.";
    goalStatusText.style.color = 'var(--text-secondary)';
  }

  // --- NOUVEAU : Mise à jour du Suivi de Tranche ---
  const tierProgressText = document.getElementById('tierProgressText');
  const tierPercentageText = document.getElementById('tierPercentage');
  const tierProgressBar = document.getElementById('tierProgressBar');
  const tierStatusText = document.getElementById('tierStatusText');

  // Déterminer le seuil de la tranche 1
  const tier1Limit = (settings.tariffType.startsWith("domestique")) ? 150 : 250; // Seuil T1
  const consumptionInTier1 = Math.min(totalConsumption, tier1Limit);
  const tierPercentage = Math.round((consumptionInTier1 / tier1Limit) * 100);

  tierProgressText.textContent = `${consumptionInTier1.toFixed(1)} / ${tier1Limit} kWh`;
  tierPercentageText.textContent = `${tierPercentage}%`;
  tierProgressBar.style.width = `${tierPercentage}%`;

  if (totalConsumption > tier1Limit) {
    tierProgressBar.style.backgroundColor = 'var(--color-warning)'; // Ou danger si on préfère
    tierStatusText.textContent = `🟠 Vous êtes passé en Tranche 2 (${(totalConsumption - tier1Limit).toFixed(1)} kWh)`;
    tierStatusText.style.color = 'var(--color-warning)';
    tierPercentageText.style.backgroundColor = 'rgba(255, 149, 0, 0.1)'; // Fond orange clair
    tierPercentageText.style.color = 'var(--color-warning)';
  } else {
    tierProgressBar.style.backgroundColor = 'var(--color-success)';
    tierStatusText.textContent = `🟢 Vous êtes en Tranche 1. Encore ${(tier1Limit - totalConsumption).toFixed(1)} kWh avant la Tranche 2.`;
    tierStatusText.style.color = 'var(--color-success)';
    tierPercentageText.style.backgroundColor = 'rgba(52, 199, 89, 0.1)'; // Fond vert clair
    tierPercentageText.style.color = 'var(--color-success)';
  }
  // --- FIN Suivi de Tranche ---

  // --- NOUVEAU : Mise à jour de la Prévision de Recharge ---
  const predictionDateElement = document.getElementById('rechargePredictionDate');
  if (daysRemaining > 0) {
      const predictionDate = addDays(new Date(), daysRemaining);
      // Formatage de la date (ex: Mercredi 5 Novembre)
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      predictionDateElement.textContent = predictionDate.toLocaleDateString('fr-FR', options);
  } else if (settings.currentCredit <= 0) {
      predictionDateElement.textContent = "Crédit épuisé ! Rechargez maintenant.";
  } else {
      predictionDateElement.textContent = "Estimation indisponible (pas assez de données de consommation).";
  }
  // --- FIN Prévision Recharge ---

  // Mettre à jour le graphique consommation
  updateConsumptionChart();
}


function updateHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  // On n'affiche que les relevés avec une consommation
  const validReadings = meterReadings.filter(r => r.consumption > 0);

  if (validReadings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-database" style="font-size: 1.5em; margin-bottom: 10px; display: block;"></i>
          Aucune donnée de consommation
        </td>
      </tr>
    `;
    return;
  }

  // Afficher du plus récent au plus ancien
  [...validReadings].reverse().forEach((reading) => {
    // Trouver l'index original pour la suppression
    const originalIndex = meterReadings.findIndex(r => r.date === reading.date && r.reading === reading.reading);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Date">${formatDate(reading.date)}</td>
      <td data-label="Consommation">${reading.consumption.toFixed(2)} kWh</td>
      <td data-label="Coût estimé">${Math.round(reading.cost)} FCFA</td>
      <td data-label="Actions">
        <button class="btn btn-danger" onclick="deleteReading(${originalIndex})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// --- Nouvelle Fonction ---
function updateRechargeHistoryTable() {
  const tbody = document.getElementById('rechargeHistoryTableBody');
  tbody.innerHTML = '';

  if (recharges.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <i class="fas fa-database" style="font-size: 1.5em; margin-bottom: 10px; display: block;"></i>
          Aucune recharge enregistrée
        </td>
      </tr>
    `;
    return;
  }

  // Afficher du plus récent au plus ancien
  [...recharges].reverse().forEach((recharge, index) => {
    const originalIndex = recharges.length - 1 - index; // Index pour la suppression
    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Date">${formatDate(recharge.date)}</td>
      <td data-label="Montant">${recharge.amount.toLocaleString('fr-FR')} FCFA</td>
      <td data-label="Unités">${recharge.units.toFixed(2)} kWh</td>
      <td data-label="Coût">${recharge.rate.toFixed(2)} FCFA/kWh</td>
      <td data-label="Actions">
        <button class="btn btn-danger" onclick="deleteRecharge(${originalIndex})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}


function formatDate(dateString) {
  // Gérer le cas où dateString est invalide ou null
  if (!dateString) return "Date inconnue";
  const date = new Date(dateString);
  // Vérifier si la date est valide
  if (isNaN(date.getTime())) return "Date invalide";
  // Utiliser 'fr-FR' pour un format JJ/MM/AAAA
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}


function deleteReading(index) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce relevé ?')) {

    // --- AJOUT : Recréditer le crédit avant de supprimer ---
    const readingToCancel = meterReadings[index];
    if (readingToCancel && readingToCancel.consumption > 0) {
      settings.currentCredit += readingToCancel.consumption;
    }
    // --- Fin Ajout ---

    meterReadings.splice(index, 1);

    // Recalculer la consommation après suppression
    recalculateConsumption();

    updateHistoryTable();
    updateDashboard();
    saveToLocalStorage();
  }
}

// --- Nouvelle fonction pour recalculer la consommation ---
function recalculateConsumption() {
  // S'assurer que c'est trié par date
  meterReadings.sort((a, b) => new Date(a.date) - new Date(b.date));
  for (let i = 0; i < meterReadings.length; i++) {
    if (i === 0) {
      meterReadings[i].consumption = 0; // Le premier relevé n'a pas de conso
    } else {
      meterReadings[i].consumption = meterReadings[i].reading - meterReadings[i - 1].reading;
      // S'assurer qu'une consommation n'est pas négative (si données incohérentes)
      if (meterReadings[i].consumption < 0) meterReadings[i].consumption = 0;
    }
    // Recalculer le coût aussi
    meterReadings[i].cost = calculateCost(meterReadings[i].consumption);
  }
}


// --- Nouvelle Fonction ---
function deleteRecharge(index) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette recharge ?')) {

    // --- AJOUT : Décréditer le crédit avant de supprimer ---
    const rechargeToCancel = recharges[index];
    if (rechargeToCancel && rechargeToCancel.units > 0) {
      settings.currentCredit -= rechargeToCancel.units;
      if (settings.currentCredit < 0) settings.currentCredit = 0;
    }
    // --- Fin Ajout ---

    recharges.splice(index, 1);

    updateRechargeHistoryTable();
    updateDashboard(); // Mettre à jour le crédit
    saveToLocalStorage();
  }
}

// --- Fonction updateAnalysis (Modifiée) ---
function updateAnalysis() {
  const period = document.getElementById('analysisPeriod').value;
  const analysisResult = document.getElementById('analysisResult');

  const readingsWithConsumption = meterReadings.filter(r => r.consumption > 0);

  if (readingsWithConsumption.length < 1) {
    analysisResult.innerHTML = `
      <div class="alert alert-info" style="grid-column: 1 / -1;">
        <i class="fas fa-info-circle"></i> Pas assez de données pour l'analyse
      </div>
    `;
    // Vider le graphique
    if (historyChartInstance) {
      historyChartInstance.data.labels = [];
      historyChartInstance.data.datasets[0].data = [];
      historyChartInstance.update();
    }
    return;
  }

  let filteredReadings = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case '7days':
      const weekAgo = new Date(new Date(today).setDate(today.getDate() - 7));
      filteredReadings = readingsWithConsumption.filter(r => new Date(r.date) >= weekAgo);
      break;
    case '30days':
      const monthAgo = new Date(new Date(today).setDate(today.getDate() - 30));
      filteredReadings = readingsWithConsumption.filter(r => new Date(r.date) >= monthAgo);
      break;
    case 'all':
      filteredReadings = [...readingsWithConsumption];
      break;
  }

  if (filteredReadings.length === 0) {
    analysisResult.innerHTML = `
      <div class="alert alert-info" style="grid-column: 1 / -1;">
        <i class="fas fa-info-circle"></i> Aucune donnée pour la période sélectionnée
      </div>
    `;
    filteredReadings = []; // S'assurer que c'est vide pour le graphique
  }

  const totalConsumption = filteredReadings.reduce((sum, r) => sum + r.consumption, 0);
  const totalCost = filteredReadings.reduce((sum, r) => sum + r.cost, 0);
  const averageDaily = filteredReadings.length > 0 ? (totalConsumption / filteredReadings.length) : 0;
  const maxConsumption = filteredReadings.length > 0 ? Math.max(...filteredReadings.map(r => r.consumption)) : 0;

  // Utilise les styles des stat-card normales, mais sans couleur de fond
  analysisResult.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${totalConsumption.toFixed(2)}</div>
      <div class="stat-label">kWh Total</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${Math.round(totalCost)}</div>
      <div class="stat-label">FCFA Total</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${averageDaily.toFixed(2)}</div>
      <div class="stat-label">kWh/jour (Moy)</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${maxConsumption.toFixed(2)}</div>
      <div class="stat-label">Pic (kWh)</div>
    </div>
  `;

  // --- Mettre à jour le graphique de l'historique ---
  if (historyChartInstance) {
    const labels = filteredReadings.map(r => formatDate(r.date));
    const data = filteredReadings.map(r => r.consumption);

    historyChartInstance.data.labels = labels;
    historyChartInstance.data.datasets[0].data = data;
    historyChartInstance.options.plugins.title.text = `Consommation des ${filteredReadings.length} relevés`;
    historyChartInstance.update();
  }
}


function saveToLocalStorage() {
  localStorage.setItem('meterReadings', JSON.stringify(meterReadings));
  localStorage.setItem('recharges', JSON.stringify(recharges));
  localStorage.setItem('settings', JSON.stringify(settings));
}

// --- Fonction loadFromLocalStorage (Modifiée) ---
function loadFromLocalStorage() {
  const savedReadings = localStorage.getItem('meterReadings');
  const savedRecharges = localStorage.getItem('recharges');
  const savedSettings = localStorage.getItem('settings');

  if (savedReadings) meterReadings = JSON.parse(savedReadings);
  if (savedRecharges) recharges = JSON.parse(savedRecharges);

  if (savedSettings) {
    // Fusionner les paramètres sauvegardés avec les défauts
    const loadedSettings = JSON.parse(savedSettings);
    settings = { ...settings, ...loadedSettings }; // Utilise les valeurs par défaut si non trouvées

    // Assure la compatibilité avec anciennes versions
    if (loadedSettings.tariff1 && !loadedSettings.tariffType) {
      settings.tariffType = "domestique-pp";
    }
  }

  // --- Appliquer le thème sauvegardé ---
  applyTheme(settings.theme);
  // --- FIN ---

  // Mettre à jour les champs de paramètres
  document.getElementById('tariffType').value = settings.tariffType;
  document.getElementById('tva').value = settings.tva;
  document.getElementById('currentCredit').value = settings.currentCredit.toFixed(1);

  // AJOUT : Mettre à jour les champs de l'objectif
  document.getElementById('goalType').value = settings.goalType;
  document.getElementById('goalValue').value = settings.goalValue > 0 ? settings.goalValue : ""; // Ne pas afficher 0
  updateGoalLabel(); // Met à jour le label FCFA/kWh
  // FIN AJOUT

  recalculateAllCosts(); // S'assurer que les coûts sont à jour avec les tarifs chargés
  updateDashboard();
  updateHistoryTable();
  updateRechargeHistoryTable(); // Ajout
}

// --- Fonction exportData (pour la sauvegarde) ---
function exportData(event) {
  event.preventDefault(); // Empêche le lien de sauter
  const data = {
    meterReadings: meterReadings,
    recharges: recharges,
    settings: settings,
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sama-woyofal-sauvegarde-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- NOUVELLE FONCTION : Exporter les données en Fichier Texte (.txt) ---
function exportAsTXT(event) {
  event.preventDefault();

  let txtRows = [];
  const nl = "\r\n"; // Nouvelle Ligne

  txtRows.push("===== RAPPORT SAMA-WOYOFAL =====");
  txtRows.push(`Date du rapport: ${formatDate(new Date().toISOString())}`);
  txtRows.push(nl);

  // --- Section 1: État Actuel ---
  txtRows.push("--- État Actuel ---");
  txtRows.push(`Crédit restant estime: ${settings.currentCredit.toFixed(1)} kWh`);
  const dailyAvg = parseFloat(document.getElementById('dailyAverage').textContent) || 0;
  if (dailyAvg > 0) {
    const daysLeft = Math.floor(settings.currentCredit / dailyAvg);
    txtRows.push(`Jours restants estimes: ${daysLeft} jours`);
  } else {
    txtRows.push("Jours restants estimes: (pas assez de données)");
  }
  // Prévision
  const predictionText = document.getElementById('rechargePredictionDate').textContent;
  txtRows.push(`Prochaine recharge estimée: ${predictionText}`);

  txtRows.push(nl);

   // --- Section 1.5: Objectif & Tranche ---
   txtRows.push("--- Objectif & Tranche du Mois ---");
   const goalText = document.getElementById('goalProgressText').textContent;
   const goalPerc = document.getElementById('goalPercentage').textContent;
   const goalStat = document.getElementById('goalStatusText').textContent;
   txtRows.push(`Objectif: ${goalText} (${goalPerc}) - ${goalStat}`);

   const tierText = document.getElementById('tierProgressText').textContent;
   const tierPerc = document.getElementById('tierPercentage').textContent;
   const tierStat = document.getElementById('tierStatusText').textContent;
   txtRows.push(`Tranche 1: ${tierText} (${tierPerc}) - ${tierStat}`);
   txtRows.push(nl);


  // --- Section 2: Relevés de consommation ---
  txtRows.push("--- Historique des Consommations ---");
  txtRows.push("Date       | Consommé (kWh) | Coût (FCFA)");
  txtRows.push("-------------------------------------------");

  const validReadings = meterReadings.filter(r => r.consumption > 0);
  if (validReadings.length > 0) {
    [...validReadings].reverse().forEach(reading => { // Du plus récent au plus ancien
      const date = formatDate(reading.date).padEnd(10);
      const conso = reading.consumption.toFixed(2).padEnd(14);
      const cout = Math.round(reading.cost);
      txtRows.push(`${date} | ${conso} | ${cout}`);
    });
  } else {
    txtRows.push("Aucune donnée de consommation.");
  }
  txtRows.push(nl);

  // --- Section 3: Historique des Recharges ---
  txtRows.push("--- Historique des Recharges ---");
  txtRows.push("Date       | Montant (FCFA) | Unités (kWh)");
  txtRows.push("-------------------------------------------");

  if (recharges.length > 0) {
    [...recharges].reverse().forEach(recharge => { // Du plus récent au plus ancien
      const date = formatDate(recharge.date).padEnd(10);
      const montant = recharge.amount.toString().padEnd(14);
      const unites = recharge.units.toFixed(2);
      txtRows.push(`${date} | ${montant} | ${unites}`);
    });
  } else {
    txtRows.push("Aucune recharge enregistrée.");
  }

  // Joindre toutes les lignes
  const txtContent = txtRows.join(nl);

  // Créer le Blob
  const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `Rapport-Sama-Woyofal-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
  try {
    const data = JSON.parse(e.target.result);

    // Valider un peu les données
    if (data.meterReadings && data.recharges && data.settings) {
      if (confirm("Charger ce fichier écrasera vos données actuelles. Continuer ?")) {
        meterReadings = data.meterReadings;
        recharges = data.recharges;
        settings = data.settings;

        saveToLocalStorage(); // Sauvegarde les nouvelles données
        loadFromLocalStorage(); // Recharge tout pour être sûr

        showMessage('importMessage');
      }
    } else {
      showError('Fichier de sauvegarde invalide ou corrompu.');
    }

    event.target.value = ''; // Reset file input
  } catch (error) {
    showError('Erreur lors de la lecture du fichier.');
    event.target.value = ''; // Reset file input
  }
  };
  reader.readAsText(file);
}

// --- Fonction resetData (Modifiée) ---
function resetData(event) {
  event.preventDefault(); // Empêche le lien de sauter
  if (confirm('Êtes-vous sûr de vouloir réinitialiser TOUTES les données (relevés et recharges) ? Cette action est irréversible.')) {
    meterReadings = [];
    recharges = [];

    // Réinitialiser aussi le crédit et l'objectif
    settings.currentCredit = 0;
    settings.goalType = 'fcfa';
    settings.goalValue = 0;
    document.getElementById('currentCredit').value = ""; // Vider le champ
    document.getElementById('goalType').value = 'fcfa';
    document.getElementById('goalValue').value = "";
    updateGoalLabel();
    // FIN Réinitialisation

    localStorage.removeItem('meterReadings');
    localStorage.removeItem('recharges');
    // On sauvegarde les settings (pour garder crédit et objectif à 0)
    saveToLocalStorage();

    // Mettre à jour tous les affichages
    updateDashboard();
    updateHistoryTable();
    updateRechargeHistoryTable();
    updateAnalysis();

    showMessage('resetMessage');
  }
}