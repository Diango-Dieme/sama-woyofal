// Data storage
let meterReadings = [];
let recharges = [];
let settings = {
  tariff1: 91.17,
  tariff2: 136.49,
  tva: 18
};

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
  updateDashboard();
  showRandomTip();
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
    event.target.classList.add('active');
  }

  // Update page-specific content
  if (pageId === 'dashboard') {
    updateDashboard();
  } else if (pageId === 'history') {
    updateHistoryTable();
  }
}

function calculateCost(kwh) {
  const tariff1 = settings.tariff1;
  const tariff2 = settings.tariff2;
  const tva = settings.tva / 100;

  let cost = 0;

  if (kwh <= 150) {
    cost = kwh * tariff1;
  } else {
    cost = (150 * tariff1) + ((kwh - 150) * tariff2);
  }

  return cost * (1 + tva);
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
    const lastReading = meterReadings[meterReadings.length - 1];
    consumption = reading - lastReading.reading;

    if (consumption < 0) {
      showError('La nouvelle valeur doit être supérieure à la précédente.');
      return;
    }
  }

  meterReadings.push({
    date: date,
    reading: reading,
    consumption: consumption,
    cost: calculateCost(consumption)
  });

  // Sort by date
  meterReadings.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Reset form
  document.getElementById('meterReading').value = "";
  document.getElementById('meterDate').value = new Date().toISOString().split('T')[0];

  showMessage('inputMessage');
  updateDashboard();
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
}

function saveTariffs() {
  settings.tariff1 = parseFloat(document.getElementById('tariff1').value);
  settings.tariff2 = parseFloat(document.getElementById('tariff2').value);
  settings.tva = parseFloat(document.getElementById('tva').value);

  showMessage('settingsMessage');
  updateDashboard();
}

function showMessage(messageId) {
  const message = document.getElementById(messageId);
  message.style.display = 'block';
  setTimeout(() => {
    message.style.display = 'none';
  }, 3000);
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-error';
  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 3000);
}

function showRandomTip() {
  const randomIndex = Math.floor(Math.random() * tips.length);
  document.getElementById('dailyTip').textContent = tips[randomIndex];
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

  const totalConsumption = monthReadings.reduce((sum, reading) => sum + reading.consumption, 0);
  const totalCost = monthReadings.reduce((sum, reading) => sum + reading.cost, 0);
  const daysCount = monthReadings.length;
  const dailyAverage = daysCount > 0 ? (totalConsumption / daysCount).toFixed(2) : 0;

  // Update dashboard stats
  document.getElementById('monthConsumption').textContent = totalConsumption.toFixed(2);
  document.getElementById('monthCost').textContent = Math.round(totalCost);
  document.getElementById('dailyAverage').textContent = dailyAverage;
  document.getElementById('daysInMonth').textContent = daysCount;
}

function updateHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';

  if (meterReadings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-database"></i> Aucune donnée enregistrée
        </td>
      </tr>
    `;
    return;
  }

  meterReadings.forEach(reading => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${reading.date}</td>
      <td>${reading.consumption.toFixed(2)}</td>
      <td>${Math.round(reading.cost)}</td>
      <td>
        <button class="btn" style="padding: 5px 10px; font-size: 14px;">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function updateAnalysis() {
  // To be implemented with chart integration
  const period = document.getElementById('analysisPeriod').value;
  console.log("Analyzing period:", period);
}