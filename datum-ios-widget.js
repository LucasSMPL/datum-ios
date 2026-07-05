// --- Cache Config ---
const CACHE_FILE = "datum-hashrate-cache.json";
const MAX_DATA_POINTS = 15;

// --- Configure Your DATUM API ---
async function fetchDatumStats() {
  const url = "https://example.com/api/datum-stats";
  const req = new Request(url);
  const res = await req.loadJSON();
  return res;
}

// --- Parse Hashrate ---
function parseHashrate(hashrateString) {
  const match = hashrateString.match(/([\d.]+)\s*Th\/sec/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

// --- Format Hashrate ---
function formatHashrate(hashrateString) {
  const thValue = parseHashrate(hashrateString);
  if (thValue >= 1000000) {
    // Exahash
    const ehValue = (thValue / 1000000).toFixed(2);
    return `${ehValue} EH/s`;
  } else if (thValue >= 1000) {
    // Petahash
    const phValue = (thValue / 1000).toFixed(2);
    return `${phValue} PH/s`;
  } else {
    // Terahash
    return `${thValue.toFixed(2)} TH/s`;
  }
}

// --- Load Cache ---
function loadCache() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);

  if (fm.fileExists(cachePath)) {
    try {
      const data = fm.readString(cachePath);
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveCache(dataPoints) {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
  fm.writeString(cachePath, JSON.stringify(dataPoints));
}

function addDataPoint(dataPoints, hashrateValue) {
  const now = new Date().getTime();
  dataPoints.push({
    timestamp: now,
    hashrate: hashrateValue,
  });

  if (dataPoints.length > MAX_DATA_POINTS) {
    dataPoints.shift();
  }

  return dataPoints;
}

// --- Chart ---
function createChart(dataPoints, width, height) {
  if (dataPoints.length === 0) return null;

  const ctx = new DrawContext();
  ctx.size = new Size(width, height);

  ctx.setFillColor(new Color("#1A1A1A"));
  ctx.fillRect(new Rect(0, 0, width, height));

  if (dataPoints.length < 2) {
    return ctx.getImage();
  }

  const hashrates = dataPoints.map((d) => d.hashrate);
  const minHashrate = Math.min(...hashrates);
  const maxHashrate = Math.max(...hashrates);
  const range = maxHashrate - minHashrate || 1;

  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  ctx.setStrokeColor(new Color("#252525"));
  ctx.setLineWidth(1);
  for (let i = 0; i <= 3; i++) {
    const y = padding + (chartHeight / 3) * i;
    const gridPath = new Path();
    gridPath.move(new Point(padding, y));
    gridPath.addLine(new Point(width - padding, y));
    ctx.addPath(gridPath);
    ctx.strokePath();
  }

  ctx.setStrokeColor(new Color("#007AFF"));
  ctx.setLineWidth(2);

  const stepX =
    dataPoints.length > 1 ? chartWidth / (dataPoints.length - 1) : 0;

  const chartPath = new Path();
  for (let i = 0; i < dataPoints.length; i++) {
    const x = padding + stepX * i;
    const y =
      padding +
      chartHeight -
      ((dataPoints[i].hashrate - minHashrate) / range) * chartHeight;

    if (i === 0) {
      chartPath.move(new Point(x, y));
    } else {
      chartPath.addLine(new Point(x, y));
    }
  }
  ctx.addPath(chartPath);
  ctx.strokePath();

  ctx.setFillColor(new Color("#007AFF"));
  for (let i = 0; i < dataPoints.length; i++) {
    const x = padding + stepX * i;
    const y =
      padding +
      chartHeight -
      ((dataPoints[i].hashrate - minHashrate) / range) * chartHeight;
    ctx.fillEllipse(new Rect(x - 2, y - 2, 4, 4));
  }

  return ctx.getImage();
}

// --- Main ---
async function main() {
  const stats = await fetchDatumStats();
  const currentHashrate = parseHashrate(stats.estimatedHashrate);

  let dataPoints = loadCache();
  dataPoints = addDataPoint(dataPoints, currentHashrate);
  saveCache(dataPoints);

  const widget = await createWidget(stats, dataPoints);

  if (config.runsInWidget) {
    Script.setWidget(widget);
    Script.complete();
  } else {
    widget.presentMedium();
  }
}

// --- Widget ---
async function createWidget(stats, dataPoints) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1A1A1A");
  widget.setPadding(16, 50, 15, 25);

  // Stats row - horizontal
  const statsRow = widget.addStack();
  statsRow.layoutHorizontally();

  function addStat(label, value) {
    const statStack = statsRow.addStack();
    statStack.layoutVertically();

    const labelText = statStack.addText(label);
    labelText.textColor = Color.gray();
    labelText.font = Font.systemFont(12);
    labelText.textOpacity = 0.7;

    const valueText = statStack.addText(value);
    valueText.textColor = Color.white();
    valueText.font = Font.boldSystemFont(15);
    valueText.textOpacity = 0.9;
  }

  addStat("DATUM Hashrate", formatHashrate(stats.estimatedHashrate));

  statsRow.addSpacer();

  addStat("DATUM Miners", stats.totalConnections);

  widget.addSpacer(12);

  const chartImage = createChart(dataPoints, 340, 100);
  if (chartImage) {
    const chartImageItem = widget.addImage(chartImage);
    chartImageItem.imageSize = new Size(340, 100);
    chartImageItem.cornerRadius = 10;
  }

  return widget;
}

await main();
