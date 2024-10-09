console.log("Starting import test");

try {
  console.log("Importing client from ./utils");
  const utils = require("./utils");
  console.log("utils imported successfully");
  console.log("utils contents:", Object.keys(utils));

  if (utils.client) {
    console.log("client found in utils");
    console.log("client type:", typeof utils.client);
  } else {
    console.log("client not found in utils");
  }
} catch (error) {
  console.error("Error during import:", error);
}

console.log("Import test complete");
