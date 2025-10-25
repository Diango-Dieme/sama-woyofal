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
  tva: 18
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

// --- Calcul de Coût (Modifié) ---
function calculateCost(kwh) {
  // Récupérer les bons tarifs en fonction du type sélectionné
  const tariffs = TARIFF_GRID[settings.tariffType] || TARIFF_GRID["domestique-pp"];
  const tariff1 = tariffs.t1;
  const tariff2 = tariffs.t2;
  const tva = settings.tva / 100;

  let cost = 0;
  
  // Note: La tranche pro est souvent différente (ex: 0-250 kWh)
  // Pour l'instant, on garde 150 kWh comme palier simple pour usage domestique
  const palier = (settings.tariffType.startsWith("domestique")) ? 150 : 250; // Hypothèse d'un palier pro

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
  updateDashboard();
  updateHistoryTable();
  saveToLocalStorage();
}

function addRecharge() {
  const date = document.getElementById('rechargeDate').value;
  const amount = parseFloat(document.getElementById('rechargeAmount').value);
  const units = parseFloat(document.getElementById('rechargeUnits').value);

  if (!date || !amount || !units || amount <= 0 || units <= 0) {
    showError('Veuillez remplir tous les champs avec des valeurs valides.');
    return;
  }

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
  updateRechargeHistoryTable(); // Ajout
  saveToLocalStorage();
}

// --- Fonction saveTariffs (Modifiée) ---
function saveTariffs() {
  settings.tariffType = document.getElementById('tariffType').value;
  settings.tva = parseFloat(document.getElementById('tva').value);

  showMessage('settingsMessage');
  
  // Recalculer les coûts existants avec les nouveaux tarifs
  recalculateAllCosts(); 
  
  updateDashboard(); // Mettre à jour le dashboard (coût estimé)
  updateHistoryTable(); // Mettre à jour l'historique (coûts)
  saveToLocalStorage();
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
  gradient.addColorStop(0, 'rgba(66, 133, 244, 0.4)');
  gradient.addColorStop(0.5, 'rgba(66, 133, 244, 0.2)');
  gradient.addColorStop(1, 'rgba(66, 133, 244, 0.05)');

  consumptionChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Consommation (kWh)',
        data: [],
        backgroundColor: gradient,
        borderColor: 'rgba(66, 133, 244, 1)',
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: 'rgba(66, 133, 244, 1)',
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
        backgroundColor: 'rgba(118, 75, 162, 0.6)', // Couleur violette
        borderColor: 'rgba(118, 75, 162, 1)',
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
  const dailyAverage = daysCount > 0 ? (totalConsumption / daysCount).toFixed(2) : 0;

  // Update dashboard stats
  document.getElementById('monthConsumption').textContent = totalConsumption.toFixed(2);
  document.getElementById('monthCost').textContent = Math.round(totalCost);
  document.getElementById('dailyAverage').textContent = dailyAverage;
  document.getElementById('daysInMonth').textContent = daysCount;

  // Mettre à jour le graphique
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
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-database"></i> Aucune donnée de consommation
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
        <button class="btn btn-danger" onclick="deleteReading(${originalIndex})" style="padding: 5px 10px; font-size: 14px;">
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
        <td colspan="5" style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-database"></i> Aucune recharge enregistrée
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
        <button class="btn btn-danger" onclick="deleteRecharge(${originalIndex})" style="padding: 5px 10px; font-size: 14px;">
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
    }
    // Recalculer le coût aussi
    meterReadings[i].cost = calculateCost(meterReadings[i].consumption);
  }
}


// --- Nouvelle Fonction ---
function deleteRecharge(index) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette recharge ?')) {
    recharges.splice(index, 1);
    updateRechargeHistoryTable();
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

  analysisResult.innerHTML = `
    <div class="stat-card" style="background: #f8f9fa; color: #333; box-shadow: none; border: 1px solid #eee;">
      <div class="stat-number">${totalConsumption.toFixed(2)}</div>
      <div class="stat-label">kWh Total</div>
    </div>
    <div class="stat-card" style="background: #f8f9fa; color: #333; box-shadow: none; border: 1px solid #eee;">
      <div class="stat-number">${Math.round(totalCost)}</div>
      <div class="stat-label">FCFA Total</div>
    </div>
    <div class="stat-card" style="background: #f8f9fa; color: #333; box-shadow: none; border: 1px solid #eee;">
      <div class="stat-number">${averageDaily.toFixed(2)}</div>
      <div class="stat-label">kWh/jour (Moy)</div>
    </div>
    <div class="stat-card" style="background: #f8f9fa; color: #333; box-shadow: none; border: 1px solid #eee;">
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
    settings = JSON.parse(savedSettings);
    // Ajout d'une vérification pour les anciens utilisateurs qui avaient tariff1/tariff2
    if (!settings.tariffType) {
      settings.tariffType = "domestique-pp";
      settings.tva = settings.tva || 18; // Garde l'ancienne TVA si elle existe
    }
  }

  // Mettre à jour les champs de paramètres
  document.getElementById('tariffType').value = settings.tariffType;
  document.getElementById('tva').value = settings.tva;

  recalculateAllCosts(); // S'assurer que les coûts sont à jour avec les tarifs chargés
  updateDashboard();
  updateHistoryTable();
  updateRechargeHistoryTable(); // Ajout
}

// --- Fonction exportData (Modifiée) ---
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
  a.download = `sama-woyofal-backup-${new Date().toISOString().split('T')[0]}.json`;
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
      if (confirm("Importer ce fichier écrasera vos données actuelles. Continuer ?")) {
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
  if (confirm('Êtes-vous sûr de vouloir réinitialiser TOUTES les données ? Cette action est irréversible.')) {
    meterReadings = [];
    recharges = [];
    // Ne pas réinitialiser les settings, seulement les données
    localStorage.removeItem('meterReadings');
    localStorage.removeItem('recharges');
    
    // Mettre à jour tous les affichages
    updateDashboard();
    updateHistoryTable();
    updateRechargeHistoryTable();
    updateAnalysis();
    
    showMessage('resetMessage');
  }
}