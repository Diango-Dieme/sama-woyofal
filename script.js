// Data storage
let meterReadings = [];
let recharges = [];
let settings = {
  tariff1: 91.17,
  tariff2: 136.49,
  tva: 18
};

// Chart instance
let consumptionChartInstance = null;

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
  } else if (pageId === 'analysis') {
    updateAnalysis();
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
  saveToLocalStorage();
}

function saveTariffs() {
  settings.tariff1 = parseFloat(document.getElementById('tariff1').value);
  settings.tariff2 = parseFloat(document.getElementById('tariff2').value);
  settings.tva = parseFloat(document.getElementById('tva').value);

  showMessage('settingsMessage');
  updateDashboard();
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

function initializeConsumptionChart() {
  const ctx = document.getElementById('consumptionChart').getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(66, 133, 244, 0.4)');
  gradient.addColorStop(0.5, 'rgba(66, 133, 244, 0.2)');
  gradient.addColorStop(1, 'rgba(66, 133, 244, 0.05)');

  const data = {
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
      pointBorderWidth: 3,
      pointRadius: 5,
      pointHoverRadius: 8,
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: 'rgba(66, 133, 244, 1)',
      pointHoverBorderWidth: 4
    }]
  };

  const config = {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#2c3e50',
            font: {
              size: 13,
              weight: '600',
              family: "'Segoe UI', 'Roboto', sans-serif"
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        title: {
          display: true,
          text: ' ÉVOLUTION DE VOTRE CONSOMMATION',
          color: '#2c3e50',
          font: {
            size: 16,
            weight: 'bold',
            family: "'Segoe UI', 'Roboto', sans-serif"
          },
          padding: {
            top: 10,
            bottom: 25
          }
        },
        tooltip: {
          backgroundColor: 'rgba(44, 62, 80, 0.95)',
          titleColor: '#ecf0f1',
          bodyColor: '#ecf0f1',
          borderColor: 'rgba(66, 133, 244, 0.8)',
          borderWidth: 2,
          padding: 15,
          cornerRadius: 10,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            title: function(tooltipItems) {
              return tooltipItems[0].label;
            },
            label: function(context) {
              return `Consommation: ${context.parsed.y} kWh`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.08)',
            drawBorder: false
          },
          ticks: {
            color: '#7f8c8d',
            font: {
              size: 12,
              family: "'Segoe UI', 'Roboto', sans-serif"
            },
            padding: 10
          },
          title: {
            display: true,
            text: 'KILOWATT-HEURE (KWH)',
            color: '#7f8c8d',
            font: {
              size: 12,
              weight: '600',
              family: "'Segoe UI', 'Roboto', sans-serif"
            },
            padding: {
              top: 10,
              bottom: 10
            }
          }
        },
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#7f8c8d',
            font: {
              size: 11,
              family: "'Segoe UI', 'Roboto', sans-serif"
            },
            maxRotation: 45,
            minRotation: 45
          },
          title: {
            display: true,
            text: 'DATE',
            color: '#7f8c8d',
            font: {
              size: 12,
              weight: '600',
              family: "'Segoe UI', 'Roboto', sans-serif"
            },
            padding: {
              top: 15,
              bottom: 5
            }
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      animations: {
        tension: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      },
      elements: {
        line: {
          tension: 0.4
        }
      }
    }
  };

  consumptionChartInstance = new Chart(ctx, config);
  updateConsumptionChart();
}

function updateConsumptionChart() {
  if (meterReadings.length === 0) {
    // Afficher le message "à venir" si pas de données
    document.querySelector('.chart-container div').style.display = 'block';
    return;
  }
  
  // Cacher le message "à venir"
  document.querySelector('.chart-container div').style.display = 'none';
  
  // Prendre les 30 derniers jours ou moins si pas assez de données
  const displayData = meterReadings.slice(-30);
  
  const labels = displayData.map(reading => {
    const date = new Date(reading.date);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short',
      year: meterReadings.length > 365 ? '2-digit' : undefined
    });
  });
  
  const data = displayData.map(reading => reading.consumption);

  if (consumptionChartInstance) {
    consumptionChartInstance.data.labels = labels;
    consumptionChartInstance.data.datasets[0].data = data;
    
    // Mettre à jour le titre avec le nombre de jours affichés
    const dayCount = displayData.length;
    consumptionChartInstance.options.plugins.title.text = 
      `📊 CONSOMMATION DES ${dayCount} DERNIERS JOURS`;
    
    consumptionChartInstance.update('active');
  }
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

  // Mettre à jour le graphique
  updateConsumptionChart();
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

  meterReadings.forEach((reading, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(reading.date)}</td>
      <td>${reading.reading.toFixed(2)}</td>
      <td>${reading.consumption.toFixed(2)}</td>
      <td>${Math.round(reading.cost)} FCFA</td>
      <td>
        <button class="btn btn-danger" onclick="deleteReading(${index})" style="padding: 5px 10px; font-size: 14px;">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR');
}

function deleteReading(index) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette lecture ?')) {
    meterReadings.splice(index, 1);
    updateHistoryTable();
    updateDashboard();
    saveToLocalStorage();
  }
}

function updateAnalysis() {
  const period = document.getElementById('analysisPeriod').value;
  const analysisResult = document.getElementById('analysisResult');
  
  if (meterReadings.length < 2) {
    analysisResult.innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-info-circle"></i> Pas assez de données pour l'analyse
      </div>
    `;
    return;
  }

  let filteredReadings = [];
  const now = new Date();

  switch (period) {
    case '7days':
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      filteredReadings = meterReadings.filter(r => new Date(r.date) >= weekAgo);
      break;
    case '30days':
      const monthAgo = new Date(now.setDate(now.getDate() - 30));
      filteredReadings = meterReadings.filter(r => new Date(r.date) >= monthAgo);
      break;
    case 'all':
      filteredReadings = [...meterReadings];
      break;
  }

  if (filteredReadings.length === 0) {
    analysisResult.innerHTML = `
      <div class="alert alert-info">
        <i class="fas fa-info-circle"></i> Aucune donnée pour la période sélectionnée
      </div>
    `;
    return;
  }

  const totalConsumption = filteredReadings.reduce((sum, r) => sum + r.consumption, 0);
  const totalCost = filteredReadings.reduce((sum, r) => sum + r.cost, 0);
  const averageDaily = totalConsumption / filteredReadings.length;
  const maxConsumption = Math.max(...filteredReadings.map(r => r.consumption));
  const minConsumption = Math.min(...filteredReadings.map(r => r.consumption));

  analysisResult.innerHTML = `
    <div class="analysis-stats">
      <div class="stat-card">
        <h4>Consommation totale</h4>
        <p class="stat-value">${totalConsumption.toFixed(2)} kWh</p>
      </div>
      <div class="stat-card">
        <h4>Coût total</h4>
        <p class="stat-value">${Math.round(totalCost)} FCFA</p>
      </div>
      <div class="stat-card">
        <h4>Moyenne journalière</h4>
        <p class="stat-value">${averageDaily.toFixed(2)} kWh/jour</p>
      </div>
      <div class="stat-card">
        <h4>Pic de consommation</h4>
        <p class="stat-value">${maxConsumption.toFixed(2)} kWh</p>
      </div>
    </div>
  `;
}

function saveToLocalStorage() {
  localStorage.setItem('meterReadings', JSON.stringify(meterReadings));
  localStorage.setItem('recharges', JSON.stringify(recharges));
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadFromLocalStorage() {
  const savedReadings = localStorage.getItem('meterReadings');
  const savedRecharges = localStorage.getItem('recharges');
  const savedSettings = localStorage.getItem('settings');

  if (savedReadings) meterReadings = JSON.parse(savedReadings);
  if (savedRecharges) recharges = JSON.parse(savedRecharges);
  if (savedSettings) settings = JSON.parse(savedSettings);

  // Mettre à jour les champs de paramètres
  document.getElementById('tariff1').value = settings.tariff1;
  document.getElementById('tariff2').value = settings.tariff2;
  document.getElementById('tva').value = settings.tva;

  updateDashboard();
  updateHistoryTable();
}

function exportData() {
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
  a.download = `consommation-export-${new Date().toISOString().split('T')[0]}.json`;
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
    
    if (data.meterReadings) meterReadings = data.meterReadings;
    if (data.recharges) recharges = data.recharges;
    if (data.settings) settings = data.settings;

    saveToLocalStorage();
    updateDashboard();
    updateHistoryTable();
    
    showMessage('importMessage');
    event.target.value = ''; // Reset file input
  } catch (error) {
    showError('Erreur lors de l\'import du fichier');
  }
  };
  reader.readAsText(file);
}

function resetData() {
  if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes les données ? Cette action est irréversible.')) {
    meterReadings = [];
    recharges = [];
    localStorage.removeItem('meterReadings');
    localStorage.removeItem('recharges');
    updateDashboard();
    updateHistoryTable();
    showMessage('resetMessage');
  }
}