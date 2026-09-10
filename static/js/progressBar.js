let tasksDone = [];
let progressBarNumSteps = 5;
let progressBarError = false;
let currentProgressMessage = '';

function completeTask(task, timeTaken) {
    tasksDone.push(task);
    console.log("Task " + task + " completed in " + timeTaken + " milliseconds");

    // Allow the browser to repaint after the task completes
    setTimeout(updateProgressBar, 0);
}

function setProgressMessage(message) {
    currentProgressMessage = message;
    const messageEl = document.getElementById("progressBarMessage");
    if (messageEl) {
        messageEl.textContent = message;
    }
}

function getNumTasksDone() {
    return tasksDone.length;
}

async function updateProgressBar() {
    const bar = document.getElementById("progressBar");
    const inner = document.getElementById("progressBarInner");
    if (!bar || !inner) return;

    const totalTasks = Math.max(1, progressBarNumSteps);
    const done = getNumTasksDone();
    const progress = Math.min(100, Math.round((done / totalTasks) * 100));
    const finished = !progressBarError && progress >= 100;

    inner.style.width = progress + "%";
    bar.classList.toggle("is-error", progressBarError);
    bar.classList.toggle("is-done", finished);

    const percentEl = document.getElementById("progressBarPercent");
    if (percentEl) {
        percentEl.textContent = finished
            ? "100%"
            : Math.min(done, totalTasks) + " of " + totalTasks + " · " + progress + "%";
    }

    const reloadLabel = document.getElementById("reloadLabel");
    if (reloadLabel) {
        reloadLabel.textContent = progressBarError
            ? "Error · reload"
            : (finished ? "Up to date · reload" : "Loading…");
    }

    await new Promise(resolve => setTimeout(resolve, 0));
}

function setProgressBarNumSteps(num) {
    progressBarNumSteps = num;
}

function setProgressBarError() {
    progressBarError = true;
    updateProgressBar();
}

function finishProgressBar(message) {
    setProgressBarNumSteps(Math.max(1, getNumTasksDone()));
    if (message) setProgressMessage(message);
    updateProgressBar();
}

function resetProgressBar() {
    tasksDone = [];
    progressBarError = false;
    setProgressMessage('');
    updateProgressBar();
}
