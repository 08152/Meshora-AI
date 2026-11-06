const serverStatus = document.getElementById("serverStatus");
const trainingStatus = document.getElementById("trainingStatus");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const startButton = document.getElementById("startTraining");
const message = document.getElementById("message");
const epochsInput = document.getElementById("epochs");

async function checkServer() {
    try {
        const response = await fetch("/health");
        if (!response.ok) throw new Error();

        const data = await response.json();
        serverStatus.textContent = data.status === "ok" ? "ONLINE" : "UNBEKANNT";
    } catch {
        serverStatus.textContent = "OFFLINE";
    }
}

async function startTraining() {
    const epochs = Math.max(
        1,
        Math.min(1000, Number(epochsInput.value) || 50)
    );

    startButton.disabled = true;
    trainingStatus.textContent = "LÄUFT";
    message.textContent = "Training wird gestartet ...";
    progressBar.style.width = "0%";
    progressText.textContent = "0 %";

    try {
        const response = await fetch("/train", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ epochs })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Training fehlgeschlagen.");
        }

        progressBar.style.width = "100%";
        progressText.textContent = "100 %";
        trainingStatus.textContent = "ABGESCHLOSSEN";
        message.textContent = data.message || "Demo-Training abgeschlossen.";
    } catch (error) {
        trainingStatus.textContent = "FEHLER";
        message.textContent = error.message;
    } finally {
        startButton.disabled = false;
    }
}

startButton?.addEventListener("click", startTraining);
checkServer();
