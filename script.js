function analyzeResume() {
    const text = document.getElementById("resumeText").value;

    fetch("http://127.0.0.1:3000/analyze", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: text })
    })
    .then(res => res.json())
    .then(data => {
    let html = `<h2>Resume Truth Checker</h2>`;

    // Dynamic colors based on score
    let strength = "";
    let color = "";
    if (data.score >= 80) {
        strength = "Strong Resume 💪";
        color = "green";
    } else if (data.score >= 50) {
        strength = "Average Resume ⚖️";
        color = "orange";
    } else {
        strength = "Needs Improvement ⚠️";
        color = "red";
    }

    // Score display
    html += `<h3>Resume Score</h3>`;
    html += `<p style="color:${color}; font-weight:bold;">${data.score}/100</p>`;
    html += `<p style="color:${color}; font-weight:bold;">${strength}</p>`;

    // Issues
    if (data.issues.length > 0) {
        html += `<h3>Issues Found</h3><ul>`;
        data.issues.forEach(issue => {
            html += `<li>${issue.desc}</li>`;
        });
        html += `</ul>`;
    } else {
        html += `<p>No issues found ✅</p>`;
    }

    // Suggestions
    if (data.suggestions.length > 0) {
        html += `<h3>Suggestions</h3><ul>`;
        data.suggestions.forEach(s => {
            html += `<li>${s}</li>`;
        });
        html += `</ul>`;
    }

    // Change output box border based on score
    const outputBox = document.getElementById("output");
    if (data.score >= 80) outputBox.style.border = "3px solid green";
    else if (data.score >= 50) outputBox.style.border = "3px solid orange";
    else outputBox.style.border = "3px solid red";

    // Set output HTML
    outputBox.innerHTML = html;
})

}
