import express from "express";
import { fetchWeatherApi } from "openmeteo";
import cors from "cors";



const app = express();
const port = process.env.PORT || 3000;
app.use(cors()); 

// Root route for testing
app.get("/", (req, res) => {
  res.send("Weather API is running! Use /weather?lat=..&lon=..&start=..&end=..");
});

app.get("/weather", async (req, res) => {
  try {
    let { lat, lon, start, end } = req.query;

    // Validate input
    if (!lat || !lon || !start || !end) {
      return res.status(400).json({ error: "Missing required query parameters: lat, lon, start, end" });
    }

    lat = lat.trim();
    lon = lon.trim();
    start = start.trim();
    end = end.trim();

    // Normalize dates to YYYY-MM-DD
    const normalizeDate = d => {
      const parts = d.split("-").map(p => p.padStart(2, "0"));
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    };
    start = normalizeDate(start);
    end = normalizeDate(end);

    // Validate format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    lat = Number(lat);
    lon = Number(lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: "Latitude and longitude must be numbers" });
    }

    // Choose API
    const url = end > new Date().toISOString().split("T")[0]
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

    const hourlyVars = [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "soil_moisture_1_to_3cm"
    ];

    const params = {
      latitude: lat,
      longitude: lon,
      hourly: hourlyVars,
      start_date: start,
      end_date: end,
      timezone: "auto"
    };

    const responses = await fetchWeatherApi(url, params);
    const response = responses[0];
    const hourly = response.hourly();
    const utcOffset = response.utcOffsetSeconds();

    const timestamps = [...Array((Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval())].map(
      (_, i) => new Date((Number(hourly.time()) + i * hourly.interval() + utcOffset) * 1000)
    );

    const temp = hourly.variables(0).valuesArray();
    const humidity = hourly.variables(1).valuesArray();
    const precipitation = hourly.variables(2).valuesArray();
    const soilMoisture = hourly.variables(3).valuesArray();

    // Aggregate day-wise
    const dayData = {};
    timestamps.forEach((t, i) => {
      const day = t.toISOString().split("T")[0];
      if (!dayData[day]) dayData[day] = { temp: [], humidity: [], precipitation: 0, soilMoisture: [] };

      dayData[day].temp.push(temp[i]);
      dayData[day].humidity.push(humidity[i]);
      dayData[day].precipitation += precipitation[i];
      if (!isNaN(soilMoisture[i])) dayData[day].soilMoisture.push(soilMoisture[i]);
    });

    const dailyData = [];
    for (const day in dayData) {
      const d = dayData[day];
      dailyData.push({
        date: day,
        temperature_2m: d.temp.reduce((a,b)=>a+b,0)/d.temp.length,
        relative_humidity_2m: d.humidity.reduce((a,b)=>a+b,0)/d.humidity.length,
        precipitation: d.precipitation,
        soil_moisture_1_to_3cm: d.soilMoisture.length > 0
          ? d.soilMoisture.reduce((a,b)=>a+b,0)/d.soilMoisture.length
          : null
      });
    }

    res.json(dailyData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch weather data", details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Weather API running on http://localhost:${port}`);
});
