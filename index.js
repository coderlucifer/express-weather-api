import promptSync from "prompt-sync";
import { fetchWeatherApi } from "openmeteo";
import fs from "fs";

const prompt = promptSync();

const lat = prompt("Enter latitude: ");
const lon = prompt("Enter longitude: ");
const start = prompt("Enter start date (YYYY-MM-DD): ");
const end = prompt("Enter end date (YYYY-MM-DD): ");

async function getWeather(lat, lon, startDate, endDate) {
  const url = endDate > new Date().toISOString().split("T")[0]
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
    start_date: startDate,
    end_date: endDate,
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
    dayData[day].soilMoisture.push(soilMoisture[i]);
  });

  const dailyData = [];
  for (const day in dayData) {
    const d = dayData[day];
    dailyData.push({
      date: day,
      temperature_2m: d.temp.reduce((a,b)=>a+b,0)/d.temp.length,
      relative_humidity_2m: d.humidity.reduce((a,b)=>a+b,0)/d.humidity.length,
      precipitation: d.precipitation,
      soil_moisture_1_to_3cm: d.soilMoisture.reduce((a,b)=>a+b,0)/d.soilMoisture.length
    });
  }

  console.log("\nSample Daily Data (first 10 days):");
  dailyData.slice(0,10).forEach(d => console.log(d));

  fs.writeFileSync("weatherDaily.json", JSON.stringify(dailyData, null, 2));
  console.log("\n✅ Full day-wise weather data saved to weatherDaily.json");
}

getWeather(lat, lon, start, end);
