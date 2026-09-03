// Free chart-image generation via QuickChart.io (no API key required).

function seriesToDateLabel(series) {
  return series.map((p) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(p.t * 1000)),
  );
}

// Normalizes each series to % change from its first point so two indices
// with very different absolute scales (e.g. Nasdaq vs Dow) can share one axis.
function normalize(series) {
  const base = series[0].close;
  return series.map((p) => Number((((p.close - base) / base) * 100).toFixed(2)));
}

function buildComparisonChartUrl(title, seriesA, seriesB) {
  const labels = seriesToDateLabel(
    seriesA.series.length >= seriesB.series.length ? seriesA.series : seriesB.series,
  );

  const config = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: seriesA.label,
          data: normalize(seriesA.series),
          borderColor: "#2563eb",
          backgroundColor: "#2563eb",
          fill: false,
          tension: 0.25,
          pointRadius: 3,
        },
        {
          label: seriesB.label,
          data: normalize(seriesB.series),
          borderColor: "#ea580c",
          backgroundColor: "#ea580c",
          fill: false,
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      title: { display: true, text: title },
      legend: { display: true, position: "bottom" },
      scales: {
        yAxes: [
          {
            ticks: {
              callback: function (value) {
                return value + "%";
              },
            },
          },
        ],
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?width=600&height=350&backgroundColor=white&c=${encoded}`;
}

module.exports = { buildComparisonChartUrl };
