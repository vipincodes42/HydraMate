const fs = require("fs");

const ITEM_ID = "124bd539314e486196290a6dd743cded";

async function main() {
  const itemDataUrl = `https://www.arcgis.com/sharing/rest/content/items/${ITEM_ID}/data?f=json`;

  const itemRes = await fetch(itemDataUrl);
  const itemData = await itemRes.json();

  const layers = itemData.operationalLayers || [];

  console.log("Layers found:");
  layers.forEach((layer, i) => {
    console.log(`${i}: ${layer.title}`);
  });

  const refillLayer =
    layers.find((layer) =>
      layer.title?.toLowerCase().includes("water")
    ) || layers[0];

  if (!refillLayer?.url) {
    throw new Error("Could not find a FeatureServer layer URL.");
  }

  const queryUrl =
    `${refillLayer.url}/query?` +
    new URLSearchParams({
      f: "json",
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
    });

  const queryRes = await fetch(queryUrl);
  const queryData = await queryRes.json();

  if (!queryData.features) {
    console.log(queryData);
    throw new Error("No features returned.");
  }

  const stations = queryData.features.map((feature, index) => {
    const attrs = feature.attributes || {};
    const geom = feature.geometry || {};

    return {
      id: attrs.OBJECTID || index + 1,
      name:
        attrs.Name ||
        attrs.name ||
        attrs.Title ||
        attrs.title ||
        `Water Refill Station ${index + 1}`,
      latitude: geom.y,
      longitude: geom.x,
      description:
        attrs.Description ||
        attrs.description ||
        attrs.Location ||
        attrs.location ||
        "Water refill station",
    };
  });

  const output = `export const refillStations = ${JSON.stringify(
    stations,
    null,
    2
  )};
`;

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/refillStations.js", output);

  console.log(`Saved ${stations.length} stations to data/refillStations.js`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});