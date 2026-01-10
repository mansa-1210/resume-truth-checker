// backend/analyzer.js
console.log("Analyzer loaded with regex + scoring");

const genericPatterns = [
  {
    label: "hard working",
    regex: /hard\s*[-]?\s*working/i,
    suggestion: "Describe a result (example: completed 5 projects before deadline)."
  },
  {
    label: "team player",
    regex: /team\s*[-]?\s*player/i,
    suggestion: "Mention collaboration outcome (example: led a 4-member team to deliver a project)."
  },
  {
    label: "self motivated",
    regex: /self\s*[-]?\s*motivated/i,
    suggestion: "Show initiative (example: independently learned React and built an app)."
  },
  {
    label: "results driven",
    regex: /results?\s*[-]?\s*driven/i,
    suggestion: "Quantify impact (example: increased accuracy by 30%)."
  },
  {
    label: "passionate",
    regex: /passionate(\s*about)?/i,
    suggestion: "Explain how you applied the passion (example: built 3 personal projects)."
  },
  {
    label: "worked on",
    regex: /worked\s*on/i,
    suggestion: "Specify contribution (example: developed backend APIs using Node.js)."
  },
  {
    label: "helped with",
    regex: /helped\s*with/i,
    suggestion: "Clarify responsibility (example: assisted in testing and bug fixing)."
  }
];

function analyzeResume(text) {
  let issues = [];
  let suggestions = [];
  let matchedLabels = [];

  genericPatterns.forEach(item => {
    if (item.regex.test(text)) {
      matchedLabels.push(`"${item.label}"`);

      suggestions.push(
        `Replace "${item.label}": ${item.suggestion}`
      );
    }
  });

  // ✅ SINGLE consolidated issue
  if (matchedLabels.length > 0) {
    issues.push({
      type: "Generic Content",
      desc: `${matchedLabels.join(", ")} lack measurable impact and weaken the resume.`
    });
  }

  // ⭐ Resume Scoring
  let score = "";
  let rating = "";
  const count = matchedLabels.length;

  if (count === 0) {
    score = "★★★★★";
    rating = "Excellent Resume";
  } else if (count <= 2) {
    score = "★★★★";
    rating = "Good Resume";
  } else if (count <= 5) {
    score = "★★★";
    rating = "Average Resume";
  } else {
    score = "★★";
    rating = "Needs Improvement";
  }

  return { issues, suggestions, score, rating };
}

module.exports = analyzeResume;
