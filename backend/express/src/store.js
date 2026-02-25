const users = new Map();
const optimizationResults = new Map();
let latestResultId = null;

function setLatestResultId(resultId) {
  latestResultId = resultId;
}

function getLatestResultId() {
  return latestResultId;
}

module.exports = {
  users,
  optimizationResults,
  setLatestResultId,
  getLatestResultId,
};
